"use server";

import { createClient } from "@/lib/supabase/server";
import type { EngagementContract } from "./types";
import {
  isDepositSatisfied,
  requiredDepositAmount,
} from "./status";

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

function num(v: unknown): number {
  return Number(v ?? 0);
}

export type ContractListRow = EngagementContract & {
  customer_name: string;
  deposits_received_total: number;
  deposit_status: "not_required" | "pending" | "satisfied" | "partial";
  next_milestone_label: string | null;
  next_milestone_due: string | null;
  action_hint: string | null;
  /** Σ invoice.total excluding void/canceled/draft */
  billed_to_date: number;
  /** Σ payment_applications on those invoices */
  paid_to_date: number;
  /** Σ (invoice.total − apps) for open A/R statuses */
  open_ar: number;
  /** GREATEST(0, contract_value − billed_to_date) */
  unbilled_remaining: number;
};

export type ContractActivityItem = {
  id: string;
  event_type: string;
  summary: string;
  actor_label: string;
  from_status: string | null;
  to_status: string | null;
  created_at: string;
  href?: string | null;
};

export type ContractInvoiceSummary = {
  id: string;
  invoice_number: string;
  status: string;
  total: number;
  paid: number;
  outstanding: number;
  due_date: string;
  issue_date: string;
  recognition_status: string;
};

export type ContractPaymentSummary = {
  id: string;
  payment_id: string;
  invoice_id: string;
  invoice_number: string;
  amount: number;
  paid_at: string;
  method: string | null;
  reference: string | null;
};

export type ContractDepositSummary = {
  id: string;
  amount: number;
  status: string;
  received_at: string;
};

const EXCLUDED_INVOICE_STATUSES = new Set(["void", "canceled", "draft"]);
const OPEN_AR_STATUSES = new Set([
  "issued",
  "unpaid",
  "partially_paid",
  "disputed",
]);

export type DepositInfo = {
  required: number;
  received: number;
  status: "not_required" | "pending" | "satisfied" | "partial";
};

export async function getDepositInfo(contract: {
  id: string;
  deposit_required: boolean;
  deposit_percent: number;
  original_contract_value?: number | null;
  contract_value: number;
  minimum_deposit_amount?: number | null;
}): Promise<DepositInfo> {
  const supabase = createClient();
  const { data } = await supabase
    .from("deposits")
    .select("amount, status")
    .eq("contract_id", contract.id)
    .in("status", ["unearned", "applied"]);
  const received = (data ?? []).reduce((s, d) => s + num(d.amount), 0);
  const slice = {
    status: "active",
    deposit_required: contract.deposit_required,
    deposit_percent: num(contract.deposit_percent),
    original_contract_value: num(
      contract.original_contract_value ?? contract.contract_value,
    ),
    contract_value: num(contract.contract_value),
    minimum_deposit_amount: contract.minimum_deposit_amount,
  };
  const required = requiredDepositAmount(slice);
  if (!contract.deposit_required) {
    return { required: 0, received, status: "not_required" };
  }
  if (isDepositSatisfied(slice, received)) {
    return { required, received, status: "satisfied" };
  }
  if (received > 0) return { required, received, status: "partial" };
  return { required, received, status: "pending" };
}

async function depositTotalsByContract(): Promise<Map<string, number>> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("deposits")
    .select("contract_id, amount, status");
  if (error) throw error;
  const map = new Map<string, number>();
  for (const d of data ?? []) {
    if (d.status === "refunded") continue;
    map.set(d.contract_id, (map.get(d.contract_id) ?? 0) + num(d.amount));
  }
  return map;
}

type CashPosition = { billed: number; paid: number; open_ar: number };

async function billingCashByContract(): Promise<Map<string, CashPosition>> {
  const supabase = createClient();
  const { data: invoices, error } = await supabase
    .from("invoices")
    .select("id, contract_id, total, status");
  if (error) throw error;

  const active = (invoices ?? []).filter(
    (i) => !EXCLUDED_INVOICE_STATUSES.has(String(i.status)),
  );
  const paidByInvoice = new Map<string, number>();
  const ids = active.map((i) => i.id as string);
  if (ids.length) {
    const { data: apps, error: appErr } = await supabase
      .from("payment_applications")
      .select("invoice_id, amount")
      .in("invoice_id", ids);
    if (appErr) throw appErr;
    for (const a of apps ?? []) {
      paidByInvoice.set(
        a.invoice_id as string,
        (paidByInvoice.get(a.invoice_id as string) ?? 0) + num(a.amount),
      );
    }
  }

  const map = new Map<string, CashPosition>();
  for (const inv of active) {
    const cid = inv.contract_id as string;
    const billed = num(inv.total);
    const paid = paidByInvoice.get(inv.id as string) ?? 0;
    const cur = map.get(cid) ?? { billed: 0, paid: 0, open_ar: 0 };
    cur.billed += billed;
    cur.paid += paid;
    if (OPEN_AR_STATUSES.has(String(inv.status))) {
      cur.open_ar += Math.max(0, billed - paid);
    }
    map.set(cid, cur);
  }
  return map;
}

function actionHint(
  c: EngagementContract,
  depositStatus: DepositInfo["status"],
): string | null {
  if (c.status === "draft") return "Complete and submit for approval";
  if (c.status === "pending_approval") return "Awaiting PM approval";
  if (c.status === "deposit_pending" || depositStatus === "pending") {
    return "Collect required deposit";
  }
  if (depositStatus === "partial") return "Deposit incomplete";
  if (c.status === "active" && c.performance_complete) {
    return "Mark completed / prepare closeout";
  }
  if (c.status === "completed") return "Review for closeout";
  if (c.status === "canceled") return "Cancellation documentation on file";
  return null;
}

export async function listCustomersForContracts() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("customers")
    .select("id, name, billing_email, status")
    .order("name");
  if (error) throw error;
  return data ?? [];
}

export async function listContractsDetailed(): Promise<ContractListRow[]> {
  const supabase = createClient();
  const [{ data: contracts, error }, { data: customers }, deposits, cash] =
    await Promise.all([
      supabase.from("contracts").select("*").order("created_at", {
        ascending: false,
      }),
      supabase.from("customers").select("id, name"),
      depositTotalsByContract(),
      billingCashByContract(),
    ]);
  if (error) throw error;

  const customerMap = new Map(
    (customers ?? []).map((c) => [c.id, c.name as string]),
  );

  const ids = (contracts ?? []).map((c) => c.id as string);
  const { data: milestones } = ids.length
    ? await supabase
        .from("contract_milestones")
        .select("contract_id, label, due_date, completed, amount, sequence_no")
        .in("contract_id", ids)
    : { data: [] as never[] };

  const nextByContract = new Map<
    string,
    { label: string; due: string | null }
  >();
  for (const m of milestones ?? []) {
    if (m.completed) continue;
    const prev = nextByContract.get(m.contract_id);
    const due = m.due_date as string | null;
    if (
      !prev ||
      (due && (!prev.due || due < prev.due)) ||
      (!prev.due && !due)
    ) {
      nextByContract.set(m.contract_id, {
        label: m.label as string,
        due,
      });
    }
  }

  return (contracts ?? []).map((raw) => {
    const c = raw as EngagementContract;
    const received = deposits.get(c.id) ?? 0;
    const position = cash.get(c.id) ?? { billed: 0, paid: 0, open_ar: 0 };
    const slice = {
      status: c.status,
      deposit_required: Boolean(c.deposit_required),
      deposit_percent: num(c.deposit_percent),
      original_contract_value: num(
        c.original_contract_value ?? c.contract_value,
      ),
      contract_value: num(c.contract_value),
      minimum_deposit_amount: c.minimum_deposit_amount,
    };
    let deposit_status: DepositInfo["status"] = "not_required";
    if (c.deposit_required) {
      if (isDepositSatisfied(slice, received)) deposit_status = "satisfied";
      else if (received > 0) deposit_status = "partial";
      else deposit_status = "pending";
    }
    const next = nextByContract.get(c.id);
    const contractValue = num(c.contract_value);
    return {
      ...c,
      original_contract_value: slice.original_contract_value,
      change_order_value_total: num(c.change_order_value_total),
      contract_value: contractValue,
      customer_name: customerMap.get(c.customer_id) ?? "Unknown",
      deposits_received_total: received,
      deposit_status,
      next_milestone_label: next?.label ?? null,
      next_milestone_due: next?.due ?? null,
      action_hint: actionHint(c, deposit_status),
      billed_to_date: position.billed,
      paid_to_date: position.paid,
      open_ar: position.open_ar,
      unbilled_remaining: Math.max(0, contractValue - position.billed),
    };
  });
}

/** Resolve by UUID primary key or human contract_number (e.g. ME-2026-…). */
export async function getContract(
  idOrNumber: string,
): Promise<ContractListRow | null> {
  const rows = await listContractsDetailed();
  const key = idOrNumber.trim();
  return (
    rows.find((r) => r.id === key) ??
    rows.find((r) => r.contract_number === key) ??
    null
  );
}

export async function listMilestones(contractId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("contract_milestones")
    .select("*")
    .eq("contract_id", contractId)
    .order("sequence_no")
    .order("due_date");
  if (error) throw error;
  return data ?? [];
}

export async function listLineItems(contractId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("contract_line_items")
    .select("*")
    .eq("contract_id", contractId)
    .order("sort_order")
    .order("line_number");
  if (error) throw error;
  return data ?? [];
}

export async function listDeliverables(contractId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("contract_deliverables")
    .select("*")
    .eq("contract_id", contractId)
    .order("sort_order");
  if (error) throw error;
  return data ?? [];
}

export async function listApprovals(contractId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("contract_approvals")
    .select("*")
    .eq("contract_id", contractId)
    .order("acted_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function listDocuments(contractId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("contract_documents")
    .select("*")
    .eq("contract_id", contractId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function listAuditEvents(
  contractId: string,
): Promise<ContractActivityItem[]> {
  return listContractActivity(contractId);
}

/** Unified timeline: contract audit + invoices, payments, deposits, change orders. */
export async function listContractActivity(
  contractId: string,
): Promise<ContractActivityItem[]> {
  const supabase = createClient();
  const [
    { data: audit, error: auditErr },
    { data: invoices, error: invErr },
    { data: deposits, error: depErr },
  ] = await Promise.all([
    supabase
      .from("contract_audit_events")
      .select("*")
      .eq("contract_id", contractId)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("invoices")
      .select("id, invoice_number, status, total, created_at, issue_date")
      .eq("contract_id", contractId),
    supabase
      .from("deposits")
      .select("id, amount, status, received_at, created_at")
      .eq("contract_id", contractId),
  ]);
  if (auditErr) throw auditErr;
  if (invErr) throw invErr;
  if (depErr) throw depErr;

  const items: ContractActivityItem[] = [];

  for (const e of audit ?? []) {
    items.push({
      id: `audit-${e.id}`,
      event_type: String(e.event_type),
      summary: String(e.summary),
      actor_label: String(e.actor_label ?? "System"),
      from_status: (e.from_status as string) ?? null,
      to_status: (e.to_status as string) ?? null,
      created_at: String(e.created_at),
      href: null,
    });
  }

  const invIds = (invoices ?? []).map((i) => i.id as string);
  const paidByInvoice = new Map<string, number>();
  type AppRow = {
    id: string;
    invoice_id: string;
    amount: number;
    created_at?: string;
    payments?: {
      paid_at?: string;
      method?: string;
      reference?: string | null;
    } | null;
  };
  let apps: AppRow[] = [];
  if (invIds.length) {
    const { data: appRows, error: appErr } = await supabase
      .from("payment_applications")
      .select("id, invoice_id, amount, created_at, payments(paid_at, method, reference)")
      .in("invoice_id", invIds);
    if (appErr) throw appErr;
    apps = (appRows ?? []) as AppRow[];
    for (const a of apps) {
      paidByInvoice.set(
        a.invoice_id,
        (paidByInvoice.get(a.invoice_id) ?? 0) + num(a.amount),
      );
    }
  }

  for (const inv of invoices ?? []) {
    const total = num(inv.total);
    const paid = paidByInvoice.get(inv.id as string) ?? 0;
    items.push({
      id: `invoice-${inv.id}`,
      event_type: "invoice",
      summary: `Invoice ${inv.invoice_number} · ${String(inv.status)} · $${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${paid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} paid)`,
      actor_label: "Billing",
      from_status: null,
      to_status: String(inv.status),
      created_at: String(inv.created_at ?? inv.issue_date),
      href: `/billing/invoices/${inv.id}`,
    });
  }

  const invNumber = new Map(
    (invoices ?? []).map((i) => [i.id as string, String(i.invoice_number)]),
  );
  for (const a of apps) {
    const paidAt = a.payments?.paid_at ?? a.created_at ?? new Date().toISOString();
    const method = a.payments?.method ? ` via ${a.payments.method}` : "";
    items.push({
      id: `payment-${a.id}`,
      event_type: "payment",
      summary: `Payment $${num(a.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} applied to ${invNumber.get(a.invoice_id) ?? "invoice"}${method}`,
      actor_label: "Billing",
      from_status: null,
      to_status: null,
      created_at: String(paidAt),
      href: `/billing/invoices/${a.invoice_id}`,
    });
  }

  for (const d of deposits ?? []) {
    items.push({
      id: `deposit-${d.id}`,
      event_type: "deposit",
      summary: `Deposit $${num(d.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} · ${String(d.status)}`,
      actor_label: "Billing",
      from_status: null,
      to_status: String(d.status),
      created_at: String(d.received_at ?? d.created_at),
      href: "/billing/deposits",
    });
  }

  items.sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  return items.slice(0, 150);
}

export async function listContractInvoices(
  contractId: string,
): Promise<ContractInvoiceSummary[]> {
  const supabase = createClient();
  const { data: invoices, error } = await supabase
    .from("invoices")
    .select("id, invoice_number, status, total, due_date, issue_date, recognition_status")
    .eq("contract_id", contractId)
    .order("issue_date", { ascending: false });
  if (error) throw error;

  const ids = (invoices ?? []).map((i) => i.id as string);
  const paidByInvoice = new Map<string, number>();
  if (ids.length) {
    const { data: apps, error: appErr } = await supabase
      .from("payment_applications")
      .select("invoice_id, amount")
      .in("invoice_id", ids);
    if (appErr) throw appErr;
    for (const a of apps ?? []) {
      paidByInvoice.set(
        a.invoice_id as string,
        (paidByInvoice.get(a.invoice_id as string) ?? 0) + num(a.amount),
      );
    }
  }

  return (invoices ?? []).map((inv) => {
    const total = num(inv.total);
    const paid = EXCLUDED_INVOICE_STATUSES.has(String(inv.status))
      ? 0
      : (paidByInvoice.get(inv.id as string) ?? 0);
    return {
      id: inv.id as string,
      invoice_number: String(inv.invoice_number),
      status: String(inv.status),
      total,
      paid,
      outstanding: EXCLUDED_INVOICE_STATUSES.has(String(inv.status))
        ? 0
        : Math.max(0, total - paid),
      due_date: String(inv.due_date),
      issue_date: String(inv.issue_date),
      recognition_status: String(inv.recognition_status),
    };
  });
}

export async function listContractPayments(
  contractId: string,
): Promise<ContractPaymentSummary[]> {
  const invoices = await listContractInvoices(contractId);
  if (invoices.length === 0) return [];
  const supabase = createClient();
  const invMap = new Map(invoices.map((i) => [i.id, i.invoice_number]));
  const { data: apps, error } = await supabase
    .from("payment_applications")
    .select("id, invoice_id, amount, payments(id, paid_at, method, reference)")
    .in(
      "invoice_id",
      invoices.map((i) => i.id),
    );
  if (error) throw error;

  return (apps ?? [])
    .map((a) => {
      const p = a.payments as {
        id?: string;
        paid_at?: string;
        method?: string;
        reference?: string | null;
      } | null;
      return {
        id: a.id as string,
        payment_id: String(p?.id ?? a.id),
        invoice_id: a.invoice_id as string,
        invoice_number: invMap.get(a.invoice_id as string) ?? "—",
        amount: num(a.amount),
        paid_at: String(p?.paid_at ?? ""),
        method: p?.method ?? null,
        reference: p?.reference ?? null,
      };
    })
    .sort(
      (a, b) =>
        new Date(b.paid_at || 0).getTime() - new Date(a.paid_at || 0).getTime(),
    );
}

export async function listContractDeposits(
  contractId: string,
): Promise<ContractDepositSummary[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("deposits")
    .select("id, amount, status, received_at")
    .eq("contract_id", contractId)
    .order("received_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((d) => ({
    id: d.id as string,
    amount: num(d.amount),
    status: String(d.status),
    received_at: String(d.received_at),
  }));
}

export async function listChangeOrders(contractId?: string) {
  const supabase = createClient();
  let q = supabase
    .from("contract_modifications")
    .select("*")
    .order("created_at", { ascending: false });
  if (contractId) q = q.eq("contract_id", contractId);
  const { data, error } = await q;
  if (error) throw error;

  const mods = data ?? [];
  const cids = [...new Set(mods.map((m) => m.contract_id as string))];
  const { data: contracts } = cids.length
    ? await supabase
        .from("contracts")
        .select("id, event_name, contract_number, customer_id")
        .in("id", cids)
    : { data: [] };
  const { data: customers } = await supabase.from("customers").select("id, name");
  const cMap = new Map((contracts ?? []).map((c) => [c.id, c]));
  const nMap = new Map((customers ?? []).map((c) => [c.id, c.name]));

  return mods.map((m) => {
    const c = cMap.get(m.contract_id as string);
    return {
      ...m,
      event_name: (c?.event_name as string) ?? "—",
      contract_number: (c?.contract_number as string) ?? "—",
      customer_name: c ? (nMap.get(c.customer_id as string) as string) : "—",
    };
  });
}

export async function listPendingApprovals() {
  const all = await listContractsDetailed();
  return all.filter((c) => c.status === "pending_approval");
}

export type DashboardMetrics = {
  activeCount: number;
  pendingApprovalCount: number;
  depositPendingCount: number;
  upcomingEvents: ContractListRow[];
  totalCurrentValue: number;
  totalChangeOrderValue: number;
  atRisk: ContractListRow[];
  requiringAction: ContractListRow[];
  upcomingMilestones: {
    contract_id: string;
    contract_number: string;
    event_name: string;
    label: string;
    due_date: string | null;
    amount: number;
  }[];
  readyForCloseout: ContractListRow[];
  canceledRecent: ContractListRow[];
};

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const rows = await listContractsDetailed();
  const now = Date.now();
  const in45 = now + 45 * 86400000;

  const upcomingEvents = rows
    .filter((r) => {
      if (!r.event_start) return false;
      if (!["active", "deposit_pending", "approved"].includes(r.status)) {
        return false;
      }
      const t = new Date(r.event_start).getTime();
      return t >= now - 86400000 && t <= in45;
    })
    .sort(
      (a, b) =>
        new Date(a.event_start!).getTime() - new Date(b.event_start!).getTime(),
    )
    .slice(0, 8);

  const atRisk = rows.filter(
    (r) =>
      r.action_hint?.includes("Deposit") ||
      r.status === "deposit_pending" ||
      r.deposit_status === "partial" ||
      r.status === "pending_approval",
  );

  const requiringAction = rows.filter((r) => r.action_hint != null).slice(0, 12);

  const readyForCloseout = rows.filter(
    (r) => r.status === "completed" || (r.status === "active" && r.performance_complete),
  );

  const supabase = createClient();
  const { data: ms } = await supabase
    .from("contract_milestones")
    .select("contract_id, label, due_date, amount, completed")
    .eq("completed", false)
    .order("due_date", { ascending: true })
    .limit(20);

  const cById = new Map(rows.map((r) => [r.id, r]));
  const upcomingMilestones = (ms ?? [])
    .map((m) => {
      const c = cById.get(m.contract_id as string);
      if (!c) return null;
      return {
        contract_id: c.id,
        contract_number: c.contract_number ?? c.id.slice(0, 8),
        event_name: c.event_name,
        label: m.label as string,
        due_date: m.due_date as string | null,
        amount: num(m.amount),
      };
    })
    .filter(Boolean) as DashboardMetrics["upcomingMilestones"];

  return {
    activeCount: rows.filter((r) => r.status === "active").length,
    pendingApprovalCount: rows.filter((r) => r.status === "pending_approval")
      .length,
    depositPendingCount: rows.filter(
      (r) => r.status === "deposit_pending" || r.deposit_status === "pending",
    ).length,
    upcomingEvents,
    totalCurrentValue: rows
      .filter((r) => !["canceled", "closed"].includes(r.status))
      .reduce((s, r) => s + num(r.contract_value), 0),
    totalChangeOrderValue: rows.reduce(
      (s, r) => s + num(r.change_order_value_total),
      0,
    ),
    atRisk,
    requiringAction,
    upcomingMilestones,
    readyForCloseout,
    canceledRecent: rows.filter((r) => r.status === "canceled"),
  };
}

export type CloseoutCheck = {
  key: string;
  label: string;
  ok: boolean;
  detail: string;
};

export async function getCloseoutChecks(
  contractId: string,
): Promise<{ contract: ContractListRow; checks: CloseoutCheck[]; canClose: boolean }> {
  const contract = await getContract(contractId);
  if (!contract) throw new Error("Contract not found");

  const supabase = createClient();
  const [
    { data: invoices },
    { data: mods },
    { data: docs },
    { count: costCount },
  ] = await Promise.all([
    supabase
      .from("invoices")
      .select("id, status, total, recognition_status")
      .eq("contract_id", contractId),
    supabase
      .from("contract_modifications")
      .select("id, status, mod_number")
      .eq("contract_id", contractId),
    supabase
      .from("contract_documents")
      .select("id, doc_type")
      .eq("contract_id", contractId),
    supabase
      .from("cost_entries")
      .select("id", { count: "exact", head: true })
      .eq("contract_id", contractId),
  ]);

  const invs = invoices ?? [];
  const openStatuses = ["issued", "unpaid", "partially_paid", "disputed", "draft"];
  const openAr = invs.filter((i) => openStatuses.includes(i.status as string));
  const disputed = invs.filter((i) => i.status === "disputed");
  const hasFinalish = invs.some(
    (i) =>
      !["void", "canceled", "draft"].includes(i.status as string) &&
      num(i.total) > 0,
  );
  const openMods = (mods ?? []).filter((m) =>
    ["draft", "approved"].includes(m.status as string),
  );
  const eventDone =
    Boolean(contract.performance_complete) ||
    contract.status === "completed" ||
    (contract.event_end
      ? new Date(contract.event_end).getTime() < Date.now()
      : false);

  const checks: CloseoutCheck[] = [
    {
      key: "event",
      label: "Event completed / performance complete",
      ok: eventDone,
      detail: eventDone
        ? "Performance complete or event end has passed"
        : "Mark performance complete or complete the engagement first",
    },
    {
      key: "approval",
      label: "Contract approved (not draft/pending)",
      ok: !["draft", "pending_approval"].includes(contract.status),
      detail: `Status is ${contract.status}`,
    },
    {
      key: "costs",
      label: "Costs recorded or acknowledged",
      ok: (costCount ?? 0) > 0 || Boolean(contract.closeout_notes),
      detail:
        (costCount ?? 0) > 0
          ? `${costCount} cost entries on contract`
          : "No cost entries — add closeout notes if costs are N/A",
    },
    {
      key: "invoice",
      label: "Final / material invoice activity",
      ok: hasFinalish || contract.status === "canceled",
      detail: hasFinalish
        ? `${invs.length} invoice(s) on contract`
        : "No issued invoices found for this contract",
    },
    {
      key: "ar",
      label: "No material open customer balance",
      ok: openAr.length === 0,
      detail:
        openAr.length === 0
          ? "No open A/R on this contract"
          : `${openAr.length} open invoice(s) remain`,
    },
    {
      key: "cos",
      label: "No open change orders",
      ok: openMods.length === 0,
      detail:
        openMods.length === 0
          ? "All change orders applied or none open"
          : `${openMods.length} CO(s) still draft/approved (not applied)`,
    },
    {
      key: "docs",
      label: "Documentation present",
      ok: (docs ?? []).length > 0 || Boolean(contract.closeout_notes),
      detail:
        (docs ?? []).length > 0
          ? `${docs!.length} document(s)`
          : "Add closeout notes or attach a document",
    },
    {
      key: "disputes",
      label: "No disputed invoices",
      ok: disputed.length === 0,
      detail:
        disputed.length === 0
          ? "No disputes"
          : `${disputed.length} disputed invoice(s)`,
    },
  ];

  const required = checks.filter((c) =>
    ["event", "approval", "ar", "cos", "disputes"].includes(c.key),
  );
  const canClose =
    contract.status !== "closed" &&
    contract.status !== "canceled" &&
    required.every((c) => c.ok);

  return { contract, checks, canClose };
}

export async function listCloseoutCandidates() {
  const rows = await listContractsDetailed();
  const candidates = rows.filter(
    (r) =>
      r.status === "completed" ||
      (r.status === "active" && r.performance_complete) ||
      r.status === "closed",
  );
  const withChecks = await Promise.all(
    candidates.map(async (c) => {
      try {
        const detail = await getCloseoutChecks(c.id);
        return { ...c, canClose: detail.canClose, checks: detail.checks };
      } catch {
        return { ...c, canClose: false, checks: [] as CloseoutCheck[] };
      }
    }),
  );
  return withChecks;
}
