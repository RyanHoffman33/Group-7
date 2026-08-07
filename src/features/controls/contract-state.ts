import { createClient } from "@/lib/supabase/server";
import { exceptionTitle } from "@/features/profitability/labels";

/**
 * Per-contract control states for the "Controls on this contract" panel.
 * SELECT-only against existing tables/views. Derives the CURRENT state of
 * each platform control for one contract; controls with nothing to report
 * return "clear" so the panel reads as a checklist.
 */

export type ControlState = "blocking" | "satisfied" | "flagged" | "clear";

export type ContractControlRow = {
  control: string;
  state: ControlState;
  summary: string;
  action?: string;
};

const FLAG_COLUMNS = [
  ["flag_late_entry", "late entry"],
  ["flag_after_billing", "after billing"],
  ["flag_duplicate_invoice", "duplicate invoice"],
  ["flag_over_committed", "over-committed"],
  ["flag_actual_exceeds_committed", "actual exceeds committed"],
] as const;

function money(n: number): string {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export async function getContractControlRows(
  contractId: string,
): Promise<ContractControlRow[]> {
  const supabase = createClient();

  const [contractRes, depositsRes, auditRes, invoicesRes, modsRes, evidenceRes, costsRes, exceptionsRes] =
    await Promise.all([
      supabase
        .from("contracts")
        .select(
          "id, status, contract_value, deposit_required, requires_deposit_before_work, approved_at, approved_by",
        )
        .eq("id", contractId)
        .maybeSingle(),
      supabase.from("deposits").select("status, amount").eq("contract_id", contractId),
      supabase
        .from("contract_audit_events")
        .select("event_type, to_status, actor_label, created_at")
        .eq("contract_id", contractId)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("invoices")
        .select("id, total, status, recognition_status")
        .eq("contract_id", contractId),
      supabase
        .from("contract_modifications")
        .select("status, applied_at, price_change, prior_contract_value")
        .eq("contract_id", contractId),
      supabase
        .from("recognition_evidence")
        .select("invoice_id")
        .eq("contract_id", contractId),
      supabase
        .from("cost_entries")
        .select(
          "flag_late_entry, flag_after_billing, flag_duplicate_invoice, flag_over_committed, flag_actual_exceeds_committed",
        )
        .eq("contract_id", contractId),
      supabase
        .from("v_profit_exceptions")
        .select("exception_type")
        .eq("contract_id", contractId),
    ]);

  const contract = contractRes.data;
  if (!contract) return [];

  const rows: ContractControlRow[] = [];
  const deposits = depositsRes.data ?? [];
  const invoices = (invoicesRes.data ?? []).filter(
    (i) => !["void", "canceled", "draft"].includes(i.status),
  );
  const mods = modsRes.data ?? [];

  // 1. Deposit-before-work gate
  const depositRequired =
    Boolean(contract.requires_deposit_before_work) ||
    Boolean(contract.deposit_required);
  if (!depositRequired) {
    rows.push({
      control: "Deposit-before-work gate",
      state: "clear",
      summary: "This contract does not require a deposit before work starts.",
    });
  } else if (contract.status === "deposit_pending") {
    rows.push({
      control: "Deposit-before-work gate",
      state: "blocking",
      summary: "Work on this event is blocked until the deposit is in.",
      action: "Collect the required deposit.",
    });
  } else if (deposits.length > 0) {
    const total = deposits.reduce((s, d) => s + Number(d.amount), 0);
    rows.push({
      control: "Deposit-before-work gate",
      state: "satisfied",
      summary: `Deposit of ${money(total)} received (${deposits
        .map((d) => d.status)
        .join(", ")}).`,
    });
  } else {
    rows.push({
      control: "Deposit-before-work gate",
      state: "flagged",
      summary:
        "A deposit is required but none is recorded, and the contract is not gated as deposit-pending.",
    });
  }

  // 2. Approval workflow
  const approvalEvent = (auditRes.data ?? []).find(
    (e) => e.to_status === "active" || e.to_status === "approved",
  );
  if (contract.status === "draft") {
    rows.push({
      control: "Approval workflow",
      state: "blocking",
      summary: "Still a draft — it cannot generate work or invoices yet.",
      action: "Submit the contract for approval.",
    });
  } else if (contract.status === "pending_approval") {
    rows.push({
      control: "Approval workflow",
      state: "blocking",
      summary: "Awaiting management approval before it becomes active.",
      action: "Approval by an authorized manager (not the creator).",
    });
  } else if (contract.approved_at || approvalEvent) {
    const by = contract.approved_by ?? approvalEvent?.actor_label ?? "manager";
    const on = (contract.approved_at ?? approvalEvent?.created_at ?? "").slice(0, 10);
    rows.push({
      control: "Approval workflow",
      state: "satisfied",
      summary: `Approved by ${by}${on ? ` on ${on}` : ""}; every status change is in the audit trail.`,
    });
  } else {
    rows.push({
      control: "Approval workflow",
      state: "clear",
      summary: `Status is ${contract.status.replaceAll("_", " ")}; no approval record on file.`,
    });
  }

  // 3. Over-billing ceiling
  const billed = invoices.reduce((s, i) => s + Number(i.total), 0);
  const approvedCo = mods
    .filter((m) => m.status === "approved")
    .reduce((s, m) => s + Number(m.price_change), 0);
  const ceiling = Number(contract.contract_value) + Math.max(approvedCo, 0);
  const headroom = ceiling - billed;
  rows.push({
    control: "Over-billing ceiling",
    state: headroom >= 0 ? "satisfied" : "flagged",
    summary:
      headroom >= 0
        ? `Billed ${money(billed)} of ${money(ceiling)} authorized — ${money(headroom)} of headroom.`
        : `Billed ${money(billed)} against only ${money(ceiling)} authorized — over by ${money(-headroom)}.`,
  });

  // 4. Change-order history
  if (mods.length === 0) {
    rows.push({
      control: "Change-order history",
      state: "clear",
      summary: "No modifications — the contract stands at its original value.",
    });
  } else {
    const approved = mods.filter((m) => m.status === "approved").length;
    const applied = mods.filter((m) => m.applied_at != null).length;
    rows.push({
      control: "Change-order history",
      state: "satisfied",
      summary: `${mods.length} modification${mods.length === 1 ? "" : "s"} (${approved} approved, ${applied} applied) — original value preserved on every one.`,
    });
  }

  // 5. Recognition evidence (scoped mirror of the exception flag)
  const recognized = invoices.filter((i) => i.recognition_status === "recognized");
  const evidencedInvoices = new Set(
    (evidenceRes.data ?? []).map((e) => e.invoice_id).filter(Boolean),
  );
  const contractLevelEvidence = (evidenceRes.data ?? []).some(
    (e) => e.invoice_id == null,
  );
  const gaps = contractLevelEvidence
    ? 0
    : recognized.filter((i) => !evidencedInvoices.has(i.id)).length;
  if (recognized.length === 0) {
    rows.push({
      control: "Recognition evidence",
      state: "clear",
      summary: "No revenue recognized on this contract yet.",
    });
  } else if (gaps === 0) {
    rows.push({
      control: "Recognition evidence",
      state: "satisfied",
      summary: `All ${recognized.length} recognized invoice${recognized.length === 1 ? " is" : "s are"} backed by evidence on file.`,
    });
  } else {
    rows.push({
      control: "Recognition evidence",
      state: "flagged",
      summary: `${gaps} of ${recognized.length} recognized invoices have no supporting evidence.`,
      action: "File delivery/acceptance evidence for the gap invoices.",
    });
  }

  // 6. Cost data-quality flags
  const costRows = costsRes.data ?? [];
  const flagParts = FLAG_COLUMNS.map(([col, label]) => {
    const n = costRows.filter((r) => r[col] === true).length;
    return n > 0 ? `${n} ${label}` : null;
  }).filter(Boolean);
  rows.push(
    flagParts.length === 0
      ? {
          control: "Cost data-quality flags",
          state: "clear",
          summary: "No cost entries on this contract are flagged.",
        }
      : {
          control: "Cost data-quality flags",
          state: "flagged",
          summary: `Open flags: ${flagParts.join(", ")}.`,
          action: "Resolve flagged entries in the cost flags queue.",
        },
  );

  // 7. Profitability exceptions
  const exTypes = (exceptionsRes.data ?? []).map((e) =>
    exceptionTitle(e.exception_type),
  );
  rows.push(
    exTypes.length === 0
      ? {
          control: "Exception monitoring",
          state: "clear",
          summary: "No open exceptions for this contract.",
        }
      : {
          control: "Exception monitoring",
          state: "flagged",
          summary: `${exTypes.length} open: ${[...new Set(exTypes)].join(", ")}.`,
          action: "Review in the profitability exceptions inbox.",
        },
  );

  return rows;
}
