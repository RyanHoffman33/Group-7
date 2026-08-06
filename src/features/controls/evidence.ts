import { createClient } from "@/lib/supabase/server";
import type { EvidenceKey } from "@/features/controls/registry";

/**
 * Live enforcement evidence for the controls page. SELECT-only against
 * existing tables/views; each result is a short badge string plus a tone.
 * Counting/aggregation here is presentation of live rows — margin and
 * classification math stays in the v_profit_* views.
 */

export type Evidence = { label: string; tone: "ok" | "warn" | "danger" };

const FLAG_COLUMNS = [
  ["flag_late_entry", "late entry"],
  ["flag_after_billing", "after billing"],
  ["flag_duplicate_invoice", "duplicate invoice"],
  ["flag_over_committed", "over-committed"],
  ["flag_actual_exceeds_committed", "actual > committed"],
] as const;

export async function getControlEvidence(): Promise<
  Partial<Record<EvidenceKey, Evidence>>
> {
  const supabase = createClient();

  const [exceptionsRes, contractsRes, modsRes, invoicesRes, pendingRes, appsRes, paymentsRes] =
    await Promise.all([
      supabase.from("v_profit_exceptions").select("exception_type, contract_id"),
      supabase.from("contracts").select("id, contract_value"),
      supabase
        .from("contract_modifications")
        .select("contract_id, price_change")
        .eq("status", "approved"),
      supabase
        .from("invoices")
        .select("contract_id, total, status")
        .not("status", "in", '("void","canceled","draft")'),
      supabase
        .from("cost_entries")
        .select("id", { count: "exact", head: true })
        .eq("approval_status", "pending_approval"),
      supabase.from("payment_applications").select("payment_id, invoice_id, amount"),
      supabase.from("payments").select("id, amount"),
    ]);

  const flagCounts = await Promise.all(
    FLAG_COLUMNS.map(([col]) =>
      supabase
        .from("cost_entries")
        .select("id", { count: "exact", head: true })
        .eq(col, true),
    ),
  );

  const exceptions = exceptionsRes.data ?? [];
  const byType = new Map<string, number>();
  for (const e of exceptions) {
    byType.set(e.exception_type, (byType.get(e.exception_type) ?? 0) + 1);
  }

  // Over-billing: billed per contract vs contract_value + approved COs.
  const billed = new Map<string, number>();
  for (const i of invoicesRes.data ?? []) {
    billed.set(i.contract_id, (billed.get(i.contract_id) ?? 0) + Number(i.total));
  }
  const coByContract = new Map<string, number>();
  for (const m of modsRes.data ?? []) {
    coByContract.set(
      m.contract_id,
      (coByContract.get(m.contract_id) ?? 0) + Number(m.price_change),
    );
  }
  const contracts = contractsRes.data ?? [];
  let overbilled = 0;
  for (const c of contracts) {
    const cap =
      Number(c.contract_value) + Math.max(coByContract.get(c.id) ?? 0, 0);
    if ((billed.get(c.id) ?? 0) > cap) overbilled += 1;
  }

  // Payment application integrity: applications vs invoice totals and payments.
  const appliedByInvoice = new Map<string, number>();
  const appliedByPayment = new Map<string, number>();
  for (const a of appsRes.data ?? []) {
    appliedByInvoice.set(
      a.invoice_id,
      (appliedByInvoice.get(a.invoice_id) ?? 0) + Number(a.amount),
    );
    appliedByPayment.set(
      a.payment_id,
      (appliedByPayment.get(a.payment_id) ?? 0) + Number(a.amount),
    );
  }
  const invoiceTotals = new Map<string, number>();
  const { data: invTotals } = await supabase
    .from("invoices")
    .select("id, total");
  for (const i of invTotals ?? []) invoiceTotals.set(i.id, Number(i.total));
  let paymentViolations = 0;
  for (const [inv, amt] of appliedByInvoice) {
    if (amt > (invoiceTotals.get(inv) ?? Infinity) + 0.001) paymentViolations += 1;
  }
  const paymentAmounts = new Map(
    (paymentsRes.data ?? []).map((p) => [p.id, Number(p.amount)]),
  );
  for (const [pay, amt] of appliedByPayment) {
    if (amt > (paymentAmounts.get(pay) ?? Infinity) + 0.001) paymentViolations += 1;
  }

  const totalFlags = flagCounts.reduce((s, r) => s + (r.count ?? 0), 0);
  const flagDetail = FLAG_COLUMNS.map(
    ([, label], i) => `${flagCounts[i].count ?? 0} ${label}`,
  ).join(", ");

  const recFlags = byType.get("recognized_without_evidence") ?? 0;
  const suspected = byType.get("suspected_duplicate_cost") ?? 0;
  const exceptionDetail = [...byType.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([t, n]) => `${n} ${t.replaceAll("_", " ")}`)
    .join(", ");

  return {
    recognition_flags: {
      label: `${recFlags} open evidence-gap flag${recFlags === 1 ? "" : "s"}`,
      tone: recFlags === 0 ? "ok" : "warn",
    },
    overbilling: {
      label: `${overbilled} violations across ${contracts.length} contracts`,
      tone: overbilled === 0 ? "ok" : "danger",
    },
    cost_flags: {
      label: `${totalFlags} open flags (${flagDetail})`,
      tone: totalFlags === 0 ? "ok" : "warn",
    },
    dedup: {
      label: `${suspected} suspected duplicate${suspected === 1 ? "" : "s"} under review; exact matches auto-excluded`,
      tone: suspected === 0 ? "ok" : "warn",
    },
    pending_approvals: {
      label: `${pendingRes.count ?? 0} entries awaiting approval`,
      tone: (pendingRes.count ?? 0) === 0 ? "ok" : "warn",
    },
    exceptions: {
      label: `${exceptions.length} open exceptions (${exceptionDetail})`,
      tone: exceptions.length === 0 ? "ok" : "warn",
    },
    payment_integrity: {
      label: `${paymentViolations} violations across ${(appsRes.data ?? []).length} applications`,
      tone: paymentViolations === 0 ? "ok" : "danger",
    },
  };
}
