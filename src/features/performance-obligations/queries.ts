import { createClient } from "@/lib/supabase/server";
import type {
  ContractPerformanceObligation,
  ContractPoSummary,
  PoApproval,
  PoStatus,
} from "./types";
import { isPoStatus } from "./types";

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function mapPo(row: Record<string, unknown>): ContractPerformanceObligation {
  const status = String(row.status);
  return {
    id: String(row.id),
    contract_id: String(row.contract_id),
    seq: num(row.seq),
    title: String(row.title),
    description: row.description != null ? String(row.description) : null,
    completion_definition: String(row.completion_definition ?? ""),
    amount: num(row.amount),
    status: isPoStatus(status) ? status : "draft",
    installment_deposit_id:
      row.installment_deposit_id != null
        ? String(row.installment_deposit_id)
        : null,
    invoice_id: row.invoice_id != null ? String(row.invoice_id) : null,
    recognition_evidence_id:
      row.recognition_evidence_id != null
        ? String(row.recognition_evidence_id)
        : null,
    ready_for_approval_at:
      row.ready_for_approval_at != null
        ? String(row.ready_for_approval_at)
        : null,
    ready_for_approval_by:
      row.ready_for_approval_by != null
        ? String(row.ready_for_approval_by)
        : null,
    approved_at: row.approved_at != null ? String(row.approved_at) : null,
    approved_by: row.approved_by != null ? String(row.approved_by) : null,
    recognized_at:
      row.recognized_at != null ? String(row.recognized_at) : null,
    recognized_amount:
      row.recognized_amount != null ? num(row.recognized_amount) : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export async function listPerformanceObligations(
  contractId: string,
): Promise<ContractPerformanceObligation[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("contract_performance_obligations")
    .select("*")
    .eq("contract_id", contractId)
    .neq("status", "cancelled")
    .order("seq", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => mapPo(r as Record<string, unknown>));
}

export async function listPerformanceObligationsForContracts(
  contractIds: string[],
): Promise<ContractPerformanceObligation[]> {
  if (!contractIds.length) return [];
  const supabase = createClient();
  const { data, error } = await supabase
    .from("contract_performance_obligations")
    .select("*")
    .in("contract_id", contractIds)
    .neq("status", "cancelled")
    .order("seq", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => mapPo(r as Record<string, unknown>));
}

export async function getPerformanceObligation(
  id: string,
): Promise<ContractPerformanceObligation | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("contract_performance_obligations")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return mapPo(data as Record<string, unknown>);
}

export async function getContractPoSummary(
  contractId: string,
): Promise<ContractPoSummary | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("v_contract_po_summary")
    .select("*")
    .eq("contract_id", contractId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const r = data as Record<string, unknown>;
  return {
    contract_id: String(r.contract_id),
    customer_id: String(r.customer_id),
    event_name: String(r.event_name),
    contract_value: num(r.contract_value),
    po_allocated_total: num(r.po_allocated_total),
    allocation_variance: num(r.allocation_variance),
    po_count: num(r.po_count),
    po_completed_count: num(r.po_completed_count),
    recognized_from_pos: num(r.recognized_from_pos),
    remaining_po_amount: num(r.remaining_po_amount),
  };
}

export async function listPoApprovals(
  contractId: string,
): Promise<PoApproval[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("po_approvals")
    .select("*")
    .eq("contract_id", contractId)
    .order("approved_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    return {
      id: String(r.id),
      performance_obligation_id: String(r.performance_obligation_id),
      contract_id: String(r.contract_id),
      approved_by: String(r.approved_by),
      approved_at: String(r.approved_at),
      confirmation_text:
        r.confirmation_text != null ? String(r.confirmation_text) : null,
      is_final_po: Boolean(r.is_final_po),
      installment_amount: num(r.installment_amount),
      installment_for_po_id:
        r.installment_for_po_id != null
          ? String(r.installment_for_po_id)
          : null,
      installment_deposit_id:
        r.installment_deposit_id != null
          ? String(r.installment_deposit_id)
          : null,
      recognized_amount: num(r.recognized_amount),
      recognition_evidence_id:
        r.recognition_evidence_id != null
          ? String(r.recognition_evidence_id)
          : null,
      invoice_id: r.invoice_id != null ? String(r.invoice_id) : null,
      notes: r.notes != null ? String(r.notes) : null,
      created_at: String(r.created_at),
    };
  });
}

export async function listRecentPoApprovals(limit = 25): Promise<
  (PoApproval & { po_title?: string; event_name?: string })[]
> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("po_approvals")
    .select(
      "*, contract_performance_obligations(title), contracts(event_name)",
    )
    .order("approved_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    const po = r.contract_performance_obligations as
      | { title?: string }
      | null;
    const c = r.contracts as { event_name?: string } | null;
    return {
      id: String(r.id),
      performance_obligation_id: String(r.performance_obligation_id),
      contract_id: String(r.contract_id),
      approved_by: String(r.approved_by),
      approved_at: String(r.approved_at),
      confirmation_text:
        r.confirmation_text != null ? String(r.confirmation_text) : null,
      is_final_po: Boolean(r.is_final_po),
      installment_amount: num(r.installment_amount),
      installment_for_po_id:
        r.installment_for_po_id != null
          ? String(r.installment_for_po_id)
          : null,
      installment_deposit_id:
        r.installment_deposit_id != null
          ? String(r.installment_deposit_id)
          : null,
      recognized_amount: num(r.recognized_amount),
      recognition_evidence_id:
        r.recognition_evidence_id != null
          ? String(r.recognition_evidence_id)
          : null,
      invoice_id: r.invoice_id != null ? String(r.invoice_id) : null,
      notes: r.notes != null ? String(r.notes) : null,
      created_at: String(r.created_at),
      po_title: po?.title,
      event_name: c?.event_name,
    };
  });
}

export function nextPo(
  pos: ContractPerformanceObligation[],
  current: ContractPerformanceObligation,
): ContractPerformanceObligation | null {
  const sorted = [...pos].sort((a, b) => a.seq - b.seq);
  const idx = sorted.findIndex((p) => p.id === current.id);
  if (idx < 0 || idx >= sorted.length - 1) return null;
  return sorted[idx + 1] ?? null;
}

export function isLastPo(
  pos: ContractPerformanceObligation[],
  current: ContractPerformanceObligation,
): boolean {
  return nextPo(pos, current) == null;
}

export function poHasInstallmentPaid(
  po: ContractPerformanceObligation,
): boolean {
  return Boolean(po.installment_deposit_id);
}

export type CustomerPoView = ContractPerformanceObligation & {
  event_name: string;
  contract_value: number;
  is_last: boolean;
  next_po: ContractPerformanceObligation | null;
  can_approve: boolean;
  gate_message: string;
  installment_required: number;
};

export function buildCustomerPoViews(
  pos: ContractPerformanceObligation[],
  contracts: { id: string; event_name: string; contract_value: number }[],
): CustomerPoView[] {
  const byContract = new Map<string, ContractPerformanceObligation[]>();
  for (const po of pos) {
    const list = byContract.get(po.contract_id) ?? [];
    list.push(po);
    byContract.set(po.contract_id, list);
  }
  const contractMap = new Map(contracts.map((c) => [c.id, c]));
  const views: CustomerPoView[] = [];

  for (const [contractId, list] of byContract) {
    const sorted = [...list].sort((a, b) => a.seq - b.seq);
    const c = contractMap.get(contractId);
    for (const po of sorted) {
      const nxt = nextPo(sorted, po);
      const last = nxt == null;
      const installmentPaid = poHasInstallmentPaid(po);
      let can_approve = false;
      let gate_message = "";
      let installment_required = 0;

      if (po.status === "completed") {
        gate_message = "Completed — revenue recognized.";
      } else if (po.status !== "awaiting_approval") {
        gate_message =
          "Not yet ready for your approval. Your project manager will release this PO when work is complete.";
      } else if (!installmentPaid && po.seq === 1) {
        gate_message =
          "Initial installment for this PO has not been recorded yet. Contact your project manager.";
      } else if (!installmentPaid) {
        gate_message =
          "Installment for this PO is not on file yet (paid when the prior PO was approved).";
      } else if (!last) {
        can_approve = true;
        installment_required = nxt!.amount;
        gate_message = `To approve PO ${po.seq}, pay the installment for the next performance obligation (PO ${nxt!.seq}: ${nxt!.title}) of $${nxt!.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}. That payment is recorded as unearned until PO ${nxt!.seq} is completed.`;
      } else {
        can_approve = true;
        installment_required = 0;
        gate_message =
          "Final performance obligation — the contract should already be fully paid through prior installments. No additional payment is required to approve.";
      }

      views.push({
        ...po,
        event_name: c?.event_name ?? "Event",
        contract_value: c?.contract_value ?? 0,
        is_last: last,
        next_po: nxt,
        can_approve,
        gate_message,
        installment_required,
      });
    }
  }

  return views.sort((a, b) => {
    if (a.contract_id !== b.contract_id) {
      return a.event_name.localeCompare(b.event_name);
    }
    return a.seq - b.seq;
  });
}

export function statusTone(
  status: PoStatus,
): "neutral" | "ok" | "warn" | "danger" | "accent" {
  if (status === "completed") return "ok";
  if (status === "awaiting_approval") return "danger";
  if (status === "active") return "accent";
  if (status === "cancelled") return "neutral";
  return "warn";
}
