"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { invoiceOutstanding } from "./queries";
import { recomputeCustomerPaymentStats } from "./stats";
import { runAgingCheck } from "./aging-check";

function revalidateBilling() {
  revalidatePath("/billing");
  revalidatePath("/billing/invoices");
  revalidatePath("/billing/payments");
  revalidatePath("/billing/deposits");
  revalidatePath("/billing/aging");
  revalidatePath("/billing/alerts");
  revalidatePath("/billing/determine");
  revalidatePath("/billing/recurring");
}

async function nextInvoiceNumber(): Promise<string> {
  const supabase = createClient();
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-`;
  const { data, error } = await supabase
    .from("invoices")
    .select("invoice_number")
    .like("invoice_number", `${prefix}%`)
    .order("invoice_number", { ascending: false })
    .limit(1);
  if (error) throw error;
  let seq = 1;
  if (data?.[0]?.invoice_number) {
    const part = String(data[0].invoice_number).split("-").pop();
    seq = (Number(part) || 0) + 1;
  }
  return `${prefix}${String(seq).padStart(4, "0")}`;
}

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

export async function createAndIssueInvoice(input: {
  contract_id: string;
  customer_id: string;
  subtotal: number;
  tax?: number;
  due_date: string;
  milestone_key?: string;
  description: string;
  performance_obligation_ref?: string;
  billing_method?: string;
  issue?: boolean;
}): Promise<ActionResult> {
  try {
    const supabase = createClient();
    const { data: contract, error: cErr } = await supabase
      .from("contracts")
      .select("*")
      .eq("id", input.contract_id)
      .single();
    if (cErr) throw cErr;

    if (input.milestone_key) {
      const { data: existing } = await supabase
        .from("invoices")
        .select("id")
        .eq("contract_id", input.contract_id)
        .eq("milestone_key", input.milestone_key)
        .not("status", "in", '("void","canceled")')
        .maybeSingle();
      if (existing) {
        return {
          ok: false,
          error:
            "An open invoice already exists for this contract milestone (duplicate control).",
        };
      }
    }

    const total = Number(input.subtotal) + Number(input.tax ?? 0);
    const invoiceNumber = await nextInvoiceNumber();
    const issue = input.issue !== false;
    const recognition =
      contract.performance_complete && issue ? "recognized" : "deferred";
    const status = issue ? "unpaid" : "draft";

    const { data: inv, error } = await supabase
      .from("invoices")
      .insert({
        contract_id: input.contract_id,
        customer_id: input.customer_id,
        invoice_number: invoiceNumber,
        issue_date: new Date().toISOString().slice(0, 10),
        due_date: input.due_date,
        subtotal: input.subtotal,
        tax: input.tax ?? 0,
        total,
        status,
        recognition_status: recognition,
        billing_method:
          input.billing_method ?? contract.billing_method ?? "fixed_price",
        milestone_key: input.milestone_key || null,
        created_by: "billing-user",
      })
      .select("id")
      .single();
    if (error) throw error;

    const { error: lineErr } = await supabase.from("invoice_lines").insert({
      invoice_id: inv.id,
      description: input.description,
      amount: input.subtotal,
      performance_obligation_ref: input.performance_obligation_ref ?? null,
      line_type: "fixed",
      quantity: 1,
      unit_rate: input.subtotal,
    });
    if (lineErr) throw lineErr;

    if (issue) {
      const { error: ledErr } = await supabase.from("ar_ledger_entries").insert({
        invoice_id: inv.id,
        entry_type: "invoice_issue",
        debit: total,
        credit: 0,
        memo:
          recognition === "recognized"
            ? "AR debit / revenue (performance complete)"
            : "AR debit / deferred revenue (liability until earned)",
      });
      if (ledErr) throw ledErr;

      await supabase.from("ar_bucket_state").upsert({
        invoice_id: inv.id,
        current_bucket: "current",
        outstanding_amount: total,
        updated_at: new Date().toISOString(),
      });
    }

    revalidateBilling();
    return { ok: true, id: inv.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function recognizeRevenue(invoiceId: string): Promise<ActionResult> {
  try {
    const supabase = createClient();
    const { data: inv, error } = await supabase
      .from("invoices")
      .select("*, contracts(performance_complete)")
      .eq("id", invoiceId)
      .single();
    if (error) throw error;
    if (inv.status === "void" || inv.status === "draft" || inv.status === "canceled") {
      return { ok: false, error: "Cannot recognize draft, void, or canceled invoices." };
    }
    if (inv.recognition_status === "recognized") {
      return { ok: false, error: "Revenue already recognized." };
    }

    // ASC 606 evidence gate — at least one recognition_evidence row for invoice or contract
    const { count: invEvidence, error: e1 } = await supabase
      .from("recognition_evidence")
      .select("id", { count: "exact", head: true })
      .eq("invoice_id", invoiceId);
    if (e1) throw e1;
    const { count: contractEvidence, error: e2 } = await supabase
      .from("recognition_evidence")
      .select("id", { count: "exact", head: true })
      .eq("contract_id", inv.contract_id);
    if (e2) throw e2;
    if ((invEvidence ?? 0) < 1 && (contractEvidence ?? 0) < 1) {
      return {
        ok: false,
        error:
          "Recognition requires evidence (customer approval, event completion, milestone sign-off, etc.). Add evidence under GAAP Compliance → Recognition.",
      };
    }

    const { assertCanRecognizeRevenue } = await import(
      "@/features/gaap/actions"
    );
    const gate = await assertCanRecognizeRevenue("billing-user");
    if (!gate.allowed) {
      return { ok: false, error: gate.reason ?? "Not authorized to recognize revenue." };
    }

    const contract = inv.contracts as { performance_complete: boolean } | null;
    if (!contract?.performance_complete) {
      const { error: updC } = await supabase
        .from("contracts")
        .update({ performance_complete: true })
        .eq("id", inv.contract_id);
      if (updC) throw updC;
    }

    const { error: upd } = await supabase
      .from("invoices")
      .update({ recognition_status: "recognized" })
      .eq("id", invoiceId);
    if (upd) throw upd;

    await supabase.from("ar_ledger_entries").insert({
      invoice_id: invoiceId,
      entry_type: "revenue_recognize",
      debit: 0,
      credit: 0,
      memo: "Deferred revenue → earned revenue (performance obligation satisfied; evidence on file)",
    });

    revalidateBilling();
    revalidatePath("/compliance");
    revalidatePath("/compliance/recognition");
    revalidatePath("/compliance/audit");
    return { ok: true, id: invoiceId };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function voidInvoice(invoiceId: string): Promise<ActionResult> {
  try {
    const outstanding = await invoiceOutstanding(invoiceId);
    const supabase = createClient();
    const { data: inv, error } = await supabase
      .from("invoices")
      .select("*")
      .eq("id", invoiceId)
      .single();
    if (error) throw error;
    if (inv.status === "void") return { ok: false, error: "Already void." };
    if (inv.status === "paid" || inv.status === "partially_paid") {
      const { data: apps } = await supabase
        .from("payment_applications")
        .select("id")
        .eq("invoice_id", invoiceId)
        .limit(1);
      if (apps && apps.length > 0) {
        return {
          ok: false,
          error: "Unapply payments before voiding this invoice.",
        };
      }
    }

    const { error: upd } = await supabase
      .from("invoices")
      .update({
        status: "void",
        voided_at: new Date().toISOString(),
      })
      .eq("id", invoiceId);
    if (upd) throw upd;

    if (outstanding > 0 && inv.status !== "draft") {
      await supabase.from("ar_ledger_entries").insert({
        invoice_id: invoiceId,
        entry_type: "invoice_void",
        debit: 0,
        credit: outstanding,
        memo: "Reverse open AR",
      });
    }

    await supabase.from("ar_bucket_state").delete().eq("invoice_id", invoiceId);

    revalidateBilling();
    return { ok: true, id: invoiceId };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function recordPaymentAndApply(input: {
  customer_id: string;
  amount: number;
  paid_at: string;
  method: string;
  reference?: string;
  invoice_id: string;
  apply_amount: number;
}): Promise<ActionResult> {
  try {
    const supabase = createClient();
    const { data: inv, error: invErr } = await supabase
      .from("invoices")
      .select("*")
      .eq("id", input.invoice_id)
      .single();
    if (invErr) throw invErr;
    if (inv.status === "void" || inv.status === "draft" || inv.status === "canceled") {
      return { ok: false, error: "Cannot apply payment to draft, void, or canceled invoice." };
    }
    if (inv.customer_id !== input.customer_id) {
      return { ok: false, error: "Payment customer must match invoice customer." };
    }

    const outstanding = await invoiceOutstanding(input.invoice_id);
    if (input.apply_amount > outstanding + 0.001) {
      return {
        ok: false,
        error: `Apply amount exceeds outstanding (${outstanding.toFixed(2)}).`,
      };
    }
    if (input.apply_amount > input.amount + 0.001) {
      return { ok: false, error: "Apply amount cannot exceed payment amount." };
    }

    const { data: payment, error: pErr } = await supabase
      .from("payments")
      .insert({
        customer_id: input.customer_id,
        amount: input.amount,
        paid_at: input.paid_at,
        method: input.method,
        reference: input.reference ?? null,
      })
      .select("id")
      .single();
    if (pErr) throw pErr;

    const { error: aErr } = await supabase.from("payment_applications").insert({
      payment_id: payment.id,
      invoice_id: input.invoice_id,
      amount: input.apply_amount,
    });
    if (aErr) throw aErr;

    await supabase.from("ar_ledger_entries").insert({
      invoice_id: input.invoice_id,
      entry_type: "payment_apply",
      debit: 0,
      credit: input.apply_amount,
      memo: `Payment ${payment.id.slice(0, 8)} applied`,
    });

    const remaining = outstanding - input.apply_amount;
    let newStatus: string =
      remaining <= 0.001 ? "paid" : "partially_paid";
    // Paying a disputed invoice clears dispute when settled; otherwise stays disputed
    if (inv.status === "disputed" && remaining > 0.001) {
      newStatus = "disputed";
    }
    await supabase
      .from("invoices")
      .update({
        status: newStatus,
        disputed_at: newStatus === "disputed" ? inv.disputed_at : null,
      })
      .eq("id", input.invoice_id);

    if (remaining <= 0.001) {
      await supabase.from("ar_bucket_state").delete().eq("invoice_id", input.invoice_id);
    } else {
      await supabase
        .from("ar_bucket_state")
        .update({
          outstanding_amount: remaining,
          updated_at: new Date().toISOString(),
        })
        .eq("invoice_id", input.invoice_id);
    }

    await recomputeCustomerPaymentStats(input.customer_id);
    revalidateBilling();
    return { ok: true, id: payment.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function recordDeposit(input: {
  contract_id: string;
  customer_id: string;
  amount: number;
  received_at: string;
}): Promise<ActionResult> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("deposits")
      .insert({
        contract_id: input.contract_id,
        customer_id: input.customer_id,
        amount: input.amount,
        received_at: input.received_at,
        status: "unearned",
      })
      .select("id")
      .single();
    if (error) throw error;

    await supabase.from("ar_ledger_entries").insert({
      invoice_id: null,
      entry_type: "deposit_receive",
      debit: input.amount,
      credit: 0,
      memo: `Unearned revenue liability — contract ${input.contract_id.slice(0, 8)}`,
    });

    revalidateBilling();
    return { ok: true, id: data.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function applyDepositToInvoice(input: {
  deposit_id: string;
  invoice_id: string;
}): Promise<ActionResult> {
  try {
    const supabase = createClient();
    const { data: dep, error: dErr } = await supabase
      .from("deposits")
      .select("*")
      .eq("id", input.deposit_id)
      .single();
    if (dErr) throw dErr;
    if (dep.status !== "unearned") {
      return { ok: false, error: "Deposit is not unearned." };
    }

    const { data: inv, error: iErr } = await supabase
      .from("invoices")
      .select("*")
      .eq("id", input.invoice_id)
      .single();
    if (iErr) throw iErr;
    if (inv.status === "void" || inv.status === "draft" || inv.status === "canceled") {
      return { ok: false, error: "Invalid invoice for deposit application." };
    }
    if (inv.customer_id !== dep.customer_id) {
      return { ok: false, error: "Deposit and invoice customers must match." };
    }

    const outstanding = await invoiceOutstanding(input.invoice_id);
    const applyAmt = Math.min(Number(dep.amount), outstanding);
    if (applyAmt <= 0) {
      return { ok: false, error: "Nothing outstanding to apply." };
    }

    const { data: payment, error: pErr } = await supabase
      .from("payments")
      .insert({
        customer_id: dep.customer_id,
        amount: applyAmt,
        paid_at: new Date().toISOString().slice(0, 10),
        method: "deposit_apply",
        reference: `DEPOSIT-${dep.id.slice(0, 8)}`,
      })
      .select("id")
      .single();
    if (pErr) throw pErr;

    await supabase.from("payment_applications").insert({
      payment_id: payment.id,
      invoice_id: input.invoice_id,
      amount: applyAmt,
    });

    await supabase
      .from("deposits")
      .update({
        status: "applied",
        applied_to_invoice_id: input.invoice_id,
      })
      .eq("id", input.deposit_id);

    await supabase.from("ar_ledger_entries").insert({
      invoice_id: input.invoice_id,
      entry_type: "deposit_apply",
      debit: 0,
      credit: applyAmt,
      memo: "Unearned deposit applied against AR (liability relieved)",
    });

    const remaining = outstanding - applyAmt;
    await supabase
      .from("invoices")
      .update({ status: remaining <= 0.001 ? "paid" : "partially_paid" })
      .eq("id", input.invoice_id);

    revalidateBilling();
    return { ok: true, id: dep.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function acknowledgeAlert(alertId: string): Promise<ActionResult> {
  try {
    const supabase = createClient();
    const { error } = await supabase
      .from("billing_alerts")
      .update({ acknowledged_at: new Date().toISOString() })
      .eq("id", alertId);
    if (error) throw error;
    revalidateBilling();
    return { ok: true, id: alertId };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function triggerAgingCheckAction(): Promise<
  ActionResult & { transitions?: number }
> {
  try {
    const result = await runAgingCheck();
    revalidateBilling();
    return { ok: true, transitions: result.transitions };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function markInvoiceDisputed(
  invoiceId: string,
  note?: string,
): Promise<ActionResult> {
  try {
    const supabase = createClient();
    const { data: inv, error } = await supabase
      .from("invoices")
      .select("status")
      .eq("id", invoiceId)
      .single();
    if (error) throw error;
    if (!["unpaid", "partially_paid"].includes(inv.status)) {
      return { ok: false, error: "Only unpaid / partially paid invoices can be disputed." };
    }
    const { error: upd } = await supabase
      .from("invoices")
      .update({
        status: "disputed",
        disputed_at: new Date().toISOString(),
        status_note: note ?? "Customer dispute opened",
      })
      .eq("id", invoiceId);
    if (upd) throw upd;
    await supabase.from("ar_ledger_entries").insert({
      invoice_id: invoiceId,
      entry_type: "dispute_open",
      debit: 0,
      credit: 0,
      memo: note ?? "Invoice marked disputed — unresolved A/R",
    });
    revalidateBilling();
    return { ok: true, id: invoiceId };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function resolveInvoiceDispute(
  invoiceId: string,
): Promise<ActionResult> {
  try {
    const supabase = createClient();
    const { data: inv, error } = await supabase
      .from("invoices")
      .select("total, status")
      .eq("id", invoiceId)
      .single();
    if (error) throw error;
    if (inv.status !== "disputed") {
      return { ok: false, error: "Invoice is not disputed." };
    }
    const outstanding = await invoiceOutstanding(invoiceId);
    const total = Number(inv.total);
    const paid = total - outstanding;
    let status: "unpaid" | "partially_paid" | "paid" = "unpaid";
    if (outstanding <= 0.001) status = "paid";
    else if (paid > 0.001) status = "partially_paid";

    const { error: upd } = await supabase
      .from("invoices")
      .update({
        status,
        disputed_at: null,
        status_note: "Dispute resolved",
      })
      .eq("id", invoiceId);
    if (upd) throw upd;
    await supabase.from("ar_ledger_entries").insert({
      invoice_id: invoiceId,
      entry_type: "dispute_resolve",
      debit: 0,
      credit: 0,
      memo: `Dispute resolved → ${status}`,
    });
    revalidateBilling();
    return { ok: true, id: invoiceId };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function cancelInvoice(
  invoiceId: string,
  note?: string,
): Promise<ActionResult> {
  try {
    const supabase = createClient();
    const { data: apps } = await supabase
      .from("payment_applications")
      .select("id")
      .eq("invoice_id", invoiceId)
      .limit(1);
    if (apps && apps.length > 0) {
      return { ok: false, error: "Cannot cancel after payments applied — void after unapply, or issue credit." };
    }
    const outstanding = await invoiceOutstanding(invoiceId);
    const { data: inv, error } = await supabase
      .from("invoices")
      .select("status")
      .eq("id", invoiceId)
      .single();
    if (error) throw error;
    if (["canceled", "void", "paid"].includes(inv.status)) {
      return { ok: false, error: `Cannot cancel invoice in status ${inv.status}.` };
    }
    const { error: upd } = await supabase
      .from("invoices")
      .update({
        status: "canceled",
        canceled_at: new Date().toISOString(),
        status_note: note ?? "Canceled / unresolved closed",
      })
      .eq("id", invoiceId);
    if (upd) throw upd;
    if (outstanding > 0 && inv.status !== "draft") {
      await supabase.from("ar_ledger_entries").insert({
        invoice_id: invoiceId,
        entry_type: "invoice_cancel",
        debit: 0,
        credit: outstanding,
        memo: note ?? "Cancel open AR",
      });
    }
    await supabase.from("ar_bucket_state").delete().eq("invoice_id", invoiceId);
    revalidateBilling();
    return { ok: true, id: invoiceId };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function issueDeterminedBill(input: {
  contract_id: string;
  method: string;
  due_date: string;
  service_quantity?: number;
  placement_base?: number;
  auto_apply_draft?: boolean;
}): Promise<ActionResult> {
  try {
    const { buildDeterminationForContract } = await import("./determination-service");
    const built = await buildDeterminationForContract(
      input.contract_id,
      input.method as import("@/lib/supabase/types").BillingMethod,
      {
        serviceQuantity: input.service_quantity,
        placementBase: input.placement_base,
      },
    );
    if (!built.ok) return built;
    const { determination, contract } = built;

    if (determination.total <= 0 && !determination.depositMode) {
      return { ok: false, error: "Determined bill amount is $0 — nothing to invoice." };
    }

    if (determination.depositMode) {
      const dep = await recordDeposit({
        contract_id: contract.id,
        customer_id: contract.customer_id,
        amount: determination.total,
        received_at: new Date().toISOString().slice(0, 10),
      });
      return dep;
    }

    const supabase = createClient();
    const invoiceNumber = await nextInvoiceNumber();
    const recognition = contract.performance_complete ? "recognized" : "deferred";

    if (determination.milestone_key) {
      const { data: existing } = await supabase
        .from("invoices")
        .select("id")
        .eq("contract_id", contract.id)
        .eq("milestone_key", determination.milestone_key)
        .not("status", "in", '("void","canceled")')
        .maybeSingle();
      if (existing) {
        return { ok: false, error: "Duplicate open milestone/progress invoice blocked." };
      }
    }

    const { data: inv, error } = await supabase
      .from("invoices")
      .insert({
        contract_id: contract.id,
        customer_id: contract.customer_id,
        invoice_number: invoiceNumber,
        issue_date: new Date().toISOString().slice(0, 10),
        due_date: input.due_date,
        subtotal: determination.subtotal,
        tax: determination.tax,
        total: determination.total,
        status: "unpaid",
        recognition_status: recognition,
        billing_method: determination.method,
        milestone_key: determination.milestone_key ?? null,
        created_by: "billing-user",
      })
      .select("id")
      .single();
    if (error) throw error;

    const lineRows = determination.lines.map((l) => ({
      invoice_id: inv.id,
      description: l.description,
      amount: l.amount,
      performance_obligation_ref: l.performance_obligation_ref ?? null,
      line_type: l.line_type,
      quantity: l.quantity ?? 1,
      unit_rate: l.unit_rate ?? l.amount,
      hours: l.hours ?? 0,
      cost_basis: l.cost_basis ?? 0,
      markup_percent: l.markup_percent ?? 0,
    }));
    const { error: lineErr } = await supabase.from("invoice_lines").insert(lineRows);
    if (lineErr) throw lineErr;

    await supabase.from("ar_ledger_entries").insert({
      invoice_id: inv.id,
      entry_type: "invoice_issue",
      debit: determination.total,
      credit: 0,
      memo: `Billed via ${determination.methodLabel}: ${determination.explanation[0] ?? ""}`,
    });

    await supabase.from("ar_bucket_state").upsert({
      invoice_id: inv.id,
      current_bucket: "current",
      outstanding_amount: determination.total,
      updated_at: new Date().toISOString(),
    });

    // Mark source time/costs/milestones as billed
    for (const line of determination.lines) {
      for (const tid of line.source_ids?.time ?? []) {
        await supabase
          .from("billable_time_entries")
          .update({ billed_invoice_id: inv.id })
          .eq("id", tid);
      }
      for (const cid of line.source_ids?.costs ?? []) {
        await supabase
          .from("billable_costs")
          .update({ billed_invoice_id: inv.id })
          .eq("id", cid);
      }
      for (const mid of line.source_ids?.milestones ?? []) {
        await supabase
          .from("contract_milestones")
          .update({ billed_invoice_id: inv.id })
          .eq("id", mid);
      }
    }

    if (input.auto_apply_draft) {
      const { data: draft } = await supabase
        .from("payment_drafts")
        .insert({
          invoice_id: inv.id,
          customer_id: contract.customer_id,
          amount: determination.total,
          draft_date: new Date().toISOString().slice(0, 10),
          status: "simulated",
          reference: `AUTO-DRAFT-${invoiceNumber}`,
        })
        .select("id")
        .single();

      if (draft) {
        await recordPaymentAndApply({
          customer_id: contract.customer_id,
          invoice_id: inv.id,
          amount: determination.total,
          apply_amount: determination.total,
          paid_at: new Date().toISOString().slice(0, 10),
          method: "simulated_ach_draft",
          reference: `AUTO-DRAFT-${invoiceNumber}`,
        });
        await supabase
          .from("payment_drafts")
          .update({ status: "applied" })
          .eq("id", draft.id);
      }
    }

    revalidateBilling();
    return { ok: true, id: inv.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function runDueBillingSchedules(): Promise<
  ActionResult & { created?: number }
> {
  try {
    const supabase = createClient();
    const today = new Date().toISOString().slice(0, 10);
    const { data: schedules, error } = await supabase
      .from("billing_schedules")
      .select("*")
      .eq("active", true)
      .lte("next_run_date", today);
    if (error) throw error;

    let created = 0;
    for (const s of schedules ?? []) {
      const result = await issueDeterminedBill({
        contract_id: s.contract_id,
        method: s.billing_method,
        due_date: new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10),
        auto_apply_draft: Boolean(s.auto_draft),
      });
      if (result.ok) {
        created += 1;
        const next = new Date(s.next_run_date + "T00:00:00");
        next.setMonth(next.getMonth() + 1);
        await supabase
          .from("billing_schedules")
          .update({ next_run_date: next.toISOString().slice(0, 10) })
          .eq("id", s.id);

        if (result.id) {
          await supabase.from("payment_drafts").insert({
            schedule_id: s.id,
            invoice_id: result.id,
            customer_id: s.customer_id,
            amount: Number(s.amount),
            draft_date: today,
            status: s.auto_draft ? "applied" : "simulated",
            reference: `SCHED-${s.id.slice(0, 8)}`,
          });
        }
      }
    }

    revalidateBilling();
    return { ok: true, created };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
