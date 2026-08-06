"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/features/users/session";
import {
  listCustomerFacingContracts,
  resolveCustomerIdForPortalSession,
} from "@/features/involvement/queries";
import {
  allocationReconciles,
  type PoDraftInput,
} from "./types";
import {
  getPerformanceObligation,
  isLastPo,
  listPerformanceObligations,
  nextPo,
  poHasInstallmentPaid,
} from "./queries";

export type PoActionResult =
  | { ok: true; id?: string; message?: string }
  | { ok: false; error: string };

function revalidatePo(contractId?: string) {
  revalidatePath("/contracts");
  revalidatePath("/contracts/list");
  revalidatePath("/compliance");
  revalidatePath("/compliance/recognition");
  revalidatePath("/compliance/deposits-retainers");
  revalidatePath("/billing");
  revalidatePath("/billing/deposits");
  revalidatePath("/billing/invoices");
  revalidatePath("/dashboard/customer");
  revalidatePath("/dashboard/customer/obligations");
  revalidatePath("/dashboard/customer/actions");
  if (contractId) {
    revalidatePath(`/contracts/${contractId}`);
  }
}

async function nextInvoiceNumber(
  supabase: ReturnType<typeof createClient>,
): Promise<string> {
  const prefix = `INV-PO-${new Date().getFullYear()}-`;
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

/** Replace all draft/active POs for a contract (negotiation / setup). */
export async function saveContractPerformanceObligations(input: {
  contractId: string;
  obligations: PoDraftInput[];
  lockActive?: boolean;
}): Promise<PoActionResult> {
  try {
    const session = await getSessionUser();
    if (!session) return { ok: false, error: "Sign in required." };
    if (session.roleKey === "customer" || session.roleKey === "vendor") {
      return { ok: false, error: "Customers cannot define performance obligations." };
    }
    if (!input.obligations.length) {
      return { ok: false, error: "Add at least one performance obligation." };
    }

    for (const o of input.obligations) {
      if (!o.title?.trim()) {
        return { ok: false, error: "Each PO needs a title." };
      }
      if (!o.completion_definition?.trim()) {
        return { ok: false, error: "Each PO needs completion criteria." };
      }
      if (!(Number(o.amount) > 0)) {
        return { ok: false, error: "Each PO amount must be greater than zero." };
      }
    }

    const supabase = createClient();
    const { data: contract, error: cErr } = await supabase
      .from("contracts")
      .select("id, contract_value, status")
      .eq("id", input.contractId)
      .single();
    if (cErr) throw cErr;

    const allocated = input.obligations.reduce(
      (s, o) => s + Number(o.amount),
      0,
    );
    const contractValue = Number(contract.contract_value);
    if (!allocationReconciles(allocated, contractValue)) {
      return {
        ok: false,
        error: `PO amounts ($${allocated.toFixed(2)}) must equal contract value ($${contractValue.toFixed(2)}). Variance: $${(allocated - contractValue).toFixed(2)}.`,
      };
    }

    const existing = await listPerformanceObligations(input.contractId);
    if (existing.some((p) => p.status === "completed" || p.status === "awaiting_approval")) {
      return {
        ok: false,
        error:
          "Cannot rewrite POs after one has been sent for approval or completed. Add change orders instead.",
      };
    }

    // Soft-cancel prior rows with unique seq (constraint is contract_id+seq)
    if (existing.length) {
      for (const p of existing) {
        const { error: delErr } = await supabase
          .from("contract_performance_obligations")
          .update({
            status: "cancelled",
            seq: p.seq + 100000 + Math.floor(Math.random() * 9000),
            updated_at: new Date().toISOString(),
          })
          .eq("id", p.id);
        if (delErr) throw delErr;
      }
    }

    const status = input.lockActive ? "active" : "draft";
    const rows = input.obligations.map((o, i) => ({
      contract_id: input.contractId,
      seq: i + 1,
      title: o.title.trim(),
      description: o.description?.trim() || null,
      completion_definition: o.completion_definition.trim(),
      amount: Number(o.amount),
      service_keys: Array.isArray(o.service_keys)
        ? o.service_keys.map(String).filter(Boolean)
        : [],
      status,
    }));

    const { error: insErr } = await supabase
      .from("contract_performance_obligations")
      .insert(rows);
    if (insErr) throw insErr;

    await supabase.from("contract_audit_events").insert({
      contract_id: input.contractId,
      event_type: "performance_obligations_defined",
      actor_label: session.fullName,
      summary: `Defined ${rows.length} ASC 606 performance obligations totaling $${allocated.toFixed(2)}.`,
      payload: {
        obligations: rows.map((r) => ({
          seq: r.seq,
          title: r.title,
          amount: r.amount,
        })),
      },
    });

    revalidatePo(input.contractId);
    return {
      ok: true,
      message: `Saved ${rows.length} performance obligations (sum $${allocated.toFixed(2)}).`,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to save performance obligations.",
    };
  }
}

/** Record initial installment (down payment) for PO 1 — unearned until approved. */
export async function recordPoInstallment(input: {
  performanceObligationId: string;
  amount?: number;
  receivedAt?: string;
}): Promise<PoActionResult> {
  try {
    const session = await getSessionUser();
    if (!session) return { ok: false, error: "Sign in required." };
    if (session.roleKey === "customer" || session.roleKey === "vendor") {
      return { ok: false, error: "Internal roles record installments on behalf of billing." };
    }

    const po = await getPerformanceObligation(input.performanceObligationId);
    if (!po) return { ok: false, error: "Performance obligation not found." };
    if (po.status === "completed" || po.status === "cancelled") {
      return { ok: false, error: "Cannot record installment for a closed PO." };
    }
    if (poHasInstallmentPaid(po)) {
      return { ok: false, error: "An installment is already linked to this PO." };
    }

    const amount = input.amount != null ? Number(input.amount) : po.amount;
    if (Math.abs(amount - po.amount) > 0.01) {
      return {
        ok: false,
        error: `Installment must equal the PO amount ($${po.amount.toFixed(2)}).`,
      };
    }

    const supabase = createClient();
    const { data: contract, error: cErr } = await supabase
      .from("contracts")
      .select("id, customer_id")
      .eq("id", po.contract_id)
      .single();
    if (cErr) throw cErr;

    const { data: dep, error: dErr } = await supabase
      .from("deposits")
      .insert({
        contract_id: po.contract_id,
        customer_id: contract.customer_id,
        amount,
        received_at: input.receivedAt || new Date().toISOString().slice(0, 10),
        status: "unearned",
        performance_obligation_id: po.id,
      })
      .select("id")
      .single();
    if (dErr) throw dErr;

    await supabase.from("ar_ledger_entries").insert({
      invoice_id: null,
      entry_type: "deposit_receive",
      debit: amount,
      credit: 0,
      memo: `Unearned installment for PO ${po.seq} (${po.title})`,
    });

    const { error: uErr } = await supabase
      .from("contract_performance_obligations")
      .update({
        installment_deposit_id: dep.id,
        status: po.status === "draft" ? "active" : po.status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", po.id);
    if (uErr) throw uErr;

    revalidatePo(po.contract_id);
    return { ok: true, id: dep.id, message: "Installment recorded as unearned deposit." };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to record installment.",
    };
  }
}

/** PM marks work complete → customer may approve (subject to payment gate). */
export async function markPoReadyForApproval(input: {
  performanceObligationId: string;
  actor?: string;
}): Promise<PoActionResult> {
  try {
    const session = await getSessionUser();
    if (!session) return { ok: false, error: "Sign in required." };
    if (session.roleKey === "customer" || session.roleKey === "vendor") {
      return { ok: false, error: "Only internal roles can release POs for approval." };
    }

    const po = await getPerformanceObligation(input.performanceObligationId);
    if (!po) return { ok: false, error: "Performance obligation not found." };
    if (po.status === "completed") {
      return { ok: false, error: "Already completed." };
    }
    if (po.status === "awaiting_approval") {
      return { ok: false, error: "Already awaiting customer approval." };
    }
    if (!poHasInstallmentPaid(po)) {
      return {
        ok: false,
        error:
          po.seq === 1
            ? "Record the initial installment (PO 1 amount) before releasing for approval."
            : "This PO’s installment is paid when the prior PO is approved. Prior PO must be completed first.",
      };
    }

    // Prior POs must be completed (sequential ASC 606 demo)
    const all = await listPerformanceObligations(po.contract_id);
    const priorOpen = all.filter(
      (p) => p.seq < po.seq && p.status !== "completed",
    );
    if (priorOpen.length) {
      return {
        ok: false,
        error: `Complete prior performance obligation(s) first: ${priorOpen.map((p) => `PO ${p.seq}`).join(", ")}.`,
      };
    }

    const supabase = createClient();
    const { error } = await supabase
      .from("contract_performance_obligations")
      .update({
        status: "awaiting_approval",
        ready_for_approval_at: new Date().toISOString(),
        ready_for_approval_by: input.actor || session.fullName,
        updated_at: new Date().toISOString(),
      })
      .eq("id", po.id);
    if (error) throw error;

    await supabase.from("contract_audit_events").insert({
      contract_id: po.contract_id,
      event_type: "po_ready_for_approval",
      actor_label: input.actor || session.fullName,
      summary: `PO ${po.seq} "${po.title}" released for customer approval.`,
      payload: { po_id: po.id, completion_definition: po.completion_definition },
    });

    revalidatePo(po.contract_id);
    return { ok: true, message: "Customer can now approve this performance obligation." };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to mark ready for approval.",
    };
  }
}

/**
 * Customer approves PO completion.
 * - Not last: must pay installment = next PO amount (unearned until that PO completes).
 * - Last: no new payment; contract already fully prepaid via prior installments.
 * On success: mark completed, recognize revenue (invoice + evidence + apply deposit).
 */
export async function approvePerformanceObligation(input: {
  performanceObligationId: string;
  confirmationText: string;
}): Promise<PoActionResult> {
  try {
    const session = await getSessionUser();
    if (!session) return { ok: false, error: "Sign in required." };
    if (session.roleKey !== "customer") {
      return { ok: false, error: "Only the customer can approve performance obligations." };
    }

    const confirmation = input.confirmationText?.trim() ?? "";
    if (confirmation.length < 4) {
      return {
        ok: false,
        error: 'Type "APPROVE" (or a short confirmation) to confirm completion.',
      };
    }

    const customerId = await resolveCustomerIdForPortalSession({
      organization: session.organization,
      email: session.email,
    });
    if (!customerId) {
      return { ok: false, error: "No customer record linked to this account." };
    }
    const contracts = await listCustomerFacingContracts(customerId);
    const allowed = new Set(contracts.map((c) => c.id));

    const po = await getPerformanceObligation(input.performanceObligationId);
    if (!po || !allowed.has(po.contract_id)) {
      return { ok: false, error: "Performance obligation not found for your events." };
    }
    if (po.status !== "awaiting_approval") {
      return { ok: false, error: "This PO is not awaiting your approval." };
    }
    if (!poHasInstallmentPaid(po)) {
      return {
        ok: false,
        error: "Installment for this PO is not on file — cannot approve.",
      };
    }

    const all = await listPerformanceObligations(po.contract_id);
    const nxt = nextPo(all, po);
    const final = isLastPo(all, po);

    const supabase = createClient();
    const today = new Date().toISOString().slice(0, 10);
    const now = new Date().toISOString();

    let nextDepositId: string | null = null;
    let installmentAmount = 0;

    if (!final && nxt) {
      // Gate: pay installment for the NEXT PO
      installmentAmount = nxt.amount;
      if (poHasInstallmentPaid(nxt)) {
        return {
          ok: false,
          error: "Next PO already has an installment on file — contact your PM.",
        };
      }

      const { data: dep, error: dErr } = await supabase
        .from("deposits")
        .insert({
          contract_id: po.contract_id,
          customer_id: customerId,
          amount: installmentAmount,
          received_at: today,
          status: "unearned",
          performance_obligation_id: nxt.id,
        })
        .select("id")
        .single();
      if (dErr) throw dErr;
      nextDepositId = dep.id as string;

      await supabase.from("ar_ledger_entries").insert({
        invoice_id: null,
        entry_type: "deposit_receive",
        debit: installmentAmount,
        credit: 0,
        memo: `Customer installment for PO ${nxt.seq} (paid to approve PO ${po.seq})`,
      });

      await supabase
        .from("contract_performance_obligations")
        .update({
          installment_deposit_id: nextDepositId,
          status: nxt.status === "draft" ? "active" : nxt.status,
          updated_at: now,
        })
        .eq("id", nxt.id);
    } else {
      // Final PO: verify progressive coverage ≈ contract value
      const { data: deps } = await supabase
        .from("deposits")
        .select("amount, status")
        .eq("contract_id", po.contract_id)
        .in("status", ["unearned", "applied"]);
      const paid = (deps ?? []).reduce((s, d) => s + Number(d.amount), 0);
      const contractValue = contracts.find((c) => c.id === po.contract_id)
        ?.contract_value;
      const cv = Number(contractValue ?? 0);
      if (cv > 0 && paid + 0.01 < cv) {
        return {
          ok: false,
          error: `Final approval blocked: total installments paid ($${paid.toFixed(2)}) are less than contract value ($${cv.toFixed(2)}).`,
        };
      }
    }

    // Recognize revenue for THIS PO
    const invoiceNumber = await nextInvoiceNumber(supabase);
    const { data: inv, error: iErr } = await supabase
      .from("invoices")
      .insert({
        contract_id: po.contract_id,
        customer_id: customerId,
        invoice_number: invoiceNumber,
        issue_date: today,
        due_date: today,
        subtotal: po.amount,
        tax: 0,
        total: po.amount,
        status: "paid",
        recognition_status: "recognized",
        billing_method: "fixed_price",
        milestone_key: `po-${po.seq}`,
        created_by: "po-approval",
      })
      .select("id")
      .single();
    if (iErr) throw iErr;

    await supabase.from("invoice_lines").insert({
      invoice_id: inv.id,
      description: `ASC 606 — PO ${po.seq}: ${po.title}`,
      quantity: 1,
      unit_rate: po.amount,
      amount: po.amount,
      performance_obligation_ref: `PO-${po.seq}`,
    });

    const { data: evidence, error: eErr } = await supabase
      .from("recognition_evidence")
      .insert({
        contract_id: po.contract_id,
        invoice_id: inv.id,
        evidence_type: "customer_approval",
        evidence_date: today,
        description: `Customer approved PO ${po.seq} "${po.title}" — ${po.completion_definition}`,
        supporting_ref: `po-approval:${po.id}`,
        created_by: session.fullName,
      })
      .select("id")
      .single();
    if (eErr) throw eErr;

    // Apply this PO's unearned deposit → paid / earned
    if (po.installment_deposit_id) {
      const { data: payment, error: pErr } = await supabase
        .from("payments")
        .insert({
          customer_id: customerId,
          amount: po.amount,
          paid_at: today,
          method: "deposit_apply",
          reference: `PO-${po.seq}-APPROVAL`,
        })
        .select("id")
        .single();
      if (pErr) throw pErr;

      await supabase.from("payment_applications").insert({
        payment_id: payment.id,
        invoice_id: inv.id,
        amount: po.amount,
      });

      await supabase
        .from("deposits")
        .update({
          status: "applied",
          applied_to_invoice_id: inv.id,
        })
        .eq("id", po.installment_deposit_id);

      await supabase.from("ar_ledger_entries").insert({
        invoice_id: inv.id,
        entry_type: "deposit_apply",
        debit: 0,
        credit: po.amount,
        memo: `Unearned → earned on customer approval of PO ${po.seq}`,
      });
    }

    await supabase.from("ar_ledger_entries").insert({
      invoice_id: inv.id,
      entry_type: "revenue_recognize",
      debit: 0,
      credit: po.amount,
      memo: `ASC 606 revenue recognized — PO ${po.seq} satisfied`,
    });

    const { error: poUpd } = await supabase
      .from("contract_performance_obligations")
      .update({
        status: "completed",
        approved_at: now,
        approved_by: session.fullName,
        recognized_at: now,
        recognized_amount: po.amount,
        invoice_id: inv.id,
        recognition_evidence_id: evidence.id,
        updated_at: now,
      })
      .eq("id", po.id);
    if (poUpd) throw poUpd;

    const { error: apprErr } = await supabase.from("po_approvals").insert({
      performance_obligation_id: po.id,
      contract_id: po.contract_id,
      approved_by: session.fullName,
      approved_at: now,
      confirmation_text: confirmation,
      is_final_po: final,
      installment_amount: installmentAmount,
      installment_for_po_id: nxt?.id ?? null,
      installment_deposit_id: nextDepositId,
      recognized_amount: po.amount,
      recognition_evidence_id: evidence.id,
      invoice_id: inv.id,
      notes: final
        ? "Final PO approval — no additional installment required."
        : `Installment of $${installmentAmount.toFixed(2)} recorded for next PO.`,
    });
    if (apprErr) throw apprErr;

    // If all POs completed, mark contract performance complete
    const remaining = all.filter(
      (p) => p.id !== po.id && p.status !== "completed",
    );
    if (remaining.length === 0) {
      await supabase
        .from("contracts")
        .update({
          performance_complete: true,
          completed_at: now,
        })
        .eq("id", po.contract_id);
    }

    await supabase.from("contract_audit_events").insert({
      contract_id: po.contract_id,
      event_type: "po_approved_recognized",
      actor_label: session.fullName,
      summary: `PO ${po.seq} approved; $${po.amount.toFixed(2)} revenue recognized.`,
      payload: {
        po_id: po.id,
        final,
        installment_amount: installmentAmount,
        next_po_seq: nxt?.seq ?? null,
        invoice_id: inv.id,
      },
    });

    revalidatePo(po.contract_id);
    return {
      ok: true,
      id: po.id,
      message: final
        ? `Final PO approved. $${po.amount.toFixed(2)} recognized as revenue.`
        : `PO approved. $${po.amount.toFixed(2)} recognized. Installment of $${installmentAmount.toFixed(2)} recorded for the next PO (unearned until that PO completes).`,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to approve performance obligation.",
    };
  }
}
