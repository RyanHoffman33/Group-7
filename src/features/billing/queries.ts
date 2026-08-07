import { createClient } from "@/lib/supabase/server";
import type {
  AgingBucket,
  ArLedgerEntry,
  BillingAlert,
  CustomerPaymentStats,
  Deposit,
  Invoice,
  InvoiceLine,
  Payment,
  PaymentApplication,
} from "@/lib/supabase/types";
import { agingBucket, collectionProbability } from "./aging";

export type OutstandingRow = {
  invoice_id: string;
  invoice_number: string;
  customer_id: string;
  contract_id: string;
  due_date: string;
  status: string;
  recognition_status: string;
  total: number;
  amount_paid: number;
  outstanding: number;
};

export type AgingRow = OutstandingRow & {
  customer_name: string;
  event_name: string;
  bucket: AgingBucket;
  p_collect: number;
  expected_collection: number;
  days_past_due: number;
};

export async function listInvoices(filters?: {
  contractId?: string;
  customerId?: string;
  status?: string;
  recognitionStatus?: string;
  q?: string;
}): Promise<(Invoice & { customer_name?: string; event_name?: string })[]> {
  const supabase = createClient();
  let q = supabase
    .from("invoices")
    .select("*, customers(name), contracts(event_name, contract_number)")
    .order("issue_date", { ascending: false });
  if (filters?.contractId) {
    q = q.eq("contract_id", filters.contractId);
  }
  if (filters?.customerId) {
    q = q.eq("customer_id", filters.customerId);
  }
  if (filters?.status) {
    q = q.eq("status", filters.status);
  }
  if (filters?.recognitionStatus) {
    q = q.eq("recognition_status", filters.recognitionStatus);
  }
  if (filters?.q?.trim()) {
    q = q.ilike("invoice_number", `%${filters.q.trim()}%`);
  }
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((row) => {
    const r = row as Invoice & {
      customers?: { name: string } | null;
      contracts?: { event_name: string; contract_number?: string } | null;
    };
    return {
      ...r,
      customer_name: r.customers?.name,
      event_name: r.contracts?.event_name,
    };
  });
}

export async function getInvoice(id: string): Promise<Invoice | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data as Invoice | null;
}

export async function getInvoiceLines(
  invoiceId: string,
): Promise<InvoiceLine[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("invoice_lines")
    .select("*")
    .eq("invoice_id", invoiceId);
  if (error) throw error;
  return (data ?? []) as InvoiceLine[];
}

export async function getLedger(invoiceId: string): Promise<ArLedgerEntry[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("ar_ledger_entries")
    .select("*")
    .eq("invoice_id", invoiceId)
    .order("created_at");
  if (error) throw error;
  return (data ?? []) as ArLedgerEntry[];
}

export async function getApplicationsForInvoice(
  invoiceId: string,
): Promise<(PaymentApplication & { payment?: Payment })[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("payment_applications")
    .select("*, payments(*)")
    .eq("invoice_id", invoiceId);
  if (error) throw error;
  return (data ?? []).map((row) => {
    const r = row as PaymentApplication & { payments?: Payment };
    return { ...r, payment: r.payments };
  });
}

export async function invoiceOutstanding(invoiceId: string): Promise<number> {
  const supabase = createClient();
  const { data: inv, error } = await supabase
    .from("invoices")
    .select("total, status")
    .eq("id", invoiceId)
    .single();
  if (error) throw error;
  if (inv.status === "void" || inv.status === "draft" || inv.status === "canceled") return 0;

  const { data: apps, error: appErr } = await supabase
    .from("payment_applications")
    .select("amount")
    .eq("invoice_id", invoiceId);
  if (appErr) throw appErr;
  const paid = (apps ?? []).reduce(
    (s, a) => s + Number(a.amount),
    0,
  );
  return Math.max(0, Number(inv.total) - paid);
}

export async function listOutstanding(): Promise<OutstandingRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase.from("v_ar_outstanding").select("*");
  if (error) throw error;
  return (data ?? []).map((r) => ({
    ...r,
    total: Number(r.total),
    amount_paid: Number(r.amount_paid),
    outstanding: Number(r.outstanding),
  })) as OutstandingRow[];
}

export async function listDeposits(): Promise<
  (Deposit & { customer_name?: string; event_name?: string })[]
> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("deposits")
    .select("*, customers(name), contracts(event_name)")
    .order("received_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => {
    const r = row as Deposit & {
      customers?: { name: string } | null;
      contracts?: { event_name: string } | null;
    };
    return {
      ...r,
      amount: Number(r.amount),
      customer_name: r.customers?.name,
      event_name: r.contracts?.event_name,
    };
  });
}

export async function listPayments(): Promise<
  (Payment & { customer_name?: string })[]
> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("payments")
    .select("*, customers(name)")
    .order("paid_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => {
    const r = row as Payment & { customers?: { name: string } | null };
    return {
      ...r,
      amount: Number(r.amount),
      customer_name: r.customers?.name,
    };
  });
}

export async function listAlerts(includeAcked = false): Promise<
  (BillingAlert & { customer_name?: string; invoice_number?: string })[]
> {
  const supabase = createClient();
  let q = supabase
    .from("billing_alerts")
    .select("*, customers(name), invoices(invoice_number)")
    .order("created_at", { ascending: false });
  if (!includeAcked) q = q.is("acknowledged_at", null);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((row) => {
    const r = row as BillingAlert & {
      customers?: { name: string } | null;
      invoices?: { invoice_number: string } | null;
    };
    return {
      ...r,
      outstanding_amount: Number(r.outstanding_amount),
      customer_name: r.customers?.name,
      invoice_number: r.invoices?.invoice_number,
    };
  });
}

export async function getPaymentStatsMap(): Promise<
  Map<string, CustomerPaymentStats>
> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("customer_payment_stats")
    .select("*");
  if (error) throw error;
  const map = new Map<string, CustomerPaymentStats>();
  for (const row of data ?? []) {
    const s = row as CustomerPaymentStats;
    map.set(s.customer_id, {
      ...s,
      bucket_survival: s.bucket_survival as Record<string, number> | null,
    });
  }
  return map;
}

export async function buildAgingReport(): Promise<AgingRow[]> {
  const [outstanding, statsMap, supabase] = await Promise.all([
    listOutstanding(),
    getPaymentStatsMap(),
    Promise.resolve(createClient()),
  ]);

  const customerIds = [...new Set(outstanding.map((o) => o.customer_id))];
  const contractIds = [...new Set(outstanding.map((o) => o.contract_id))];

  const [{ data: customers }, { data: contracts }] = await Promise.all([
    supabase.from("customers").select("id, name").in("id", customerIds),
    supabase.from("contracts").select("id, event_name").in("id", contractIds),
  ]);

  const custName = new Map(
    (customers ?? []).map((c) => [c.id as string, c.name as string]),
  );
  const eventName = new Map(
    (contracts ?? []).map((c) => [c.id as string, c.event_name as string]),
  );

  return outstanding.map((o) => {
    const bucket = agingBucket(o.due_date);
    const stats = statsMap.get(o.customer_id) ?? null;
    const p = collectionProbability(bucket, stats);
    const dpd = Math.max(
      0,
      Math.floor(
        (Date.now() - new Date(o.due_date + "T00:00:00").getTime()) /
          (1000 * 60 * 60 * 24),
      ),
    );
    return {
      ...o,
      customer_name: custName.get(o.customer_id) ?? "Unknown",
      event_name: eventName.get(o.contract_id) ?? "Unknown",
      bucket,
      p_collect: p,
      expected_collection: o.outstanding * p,
      days_past_due: dpd,
    };
  });
}

export type DashboardMetrics = {
  totalOutstanding: number;
  expectedCollections: number;
  unearnedDeposits: number;
  openAlertCount: number;
  byBucket: Record<AgingBucket, number>;
  deferredRevenue: number;
  recognizedOpenAr: number;
};

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const [aging, deposits, alerts] = await Promise.all([
    buildAgingReport(),
    listDeposits(),
    listAlerts(false),
  ]);

  const byBucket = {
    current: 0,
    "1-30": 0,
    "31-60": 0,
    "61-90": 0,
    "90+": 0,
  } as Record<AgingBucket, number>;

  let totalOutstanding = 0;
  let expectedCollections = 0;
  let deferredRevenue = 0;
  let recognizedOpenAr = 0;

  for (const row of aging) {
    totalOutstanding += row.outstanding;
    expectedCollections += row.expected_collection;
    byBucket[row.bucket] += row.outstanding;
    if (row.recognition_status === "deferred") deferredRevenue += row.outstanding;
    else recognizedOpenAr += row.outstanding;
  }

  const unearnedDeposits = deposits
    .filter((d) => d.status === "unearned")
    .reduce((s, d) => s + Number(d.amount), 0);

  return {
    totalOutstanding,
    expectedCollections,
    unearnedDeposits,
    openAlertCount: alerts.length,
    byBucket,
    deferredRevenue,
    recognizedOpenAr,
  };
}

export async function listBillingSchedules() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("billing_schedules")
    .select("*, customers(name), contracts(event_name)")
    .order("next_run_date");
  if (error) throw error;
  return (data ?? []).map((row) => {
    const r = row as {
      id: string;
      contract_id: string;
      customer_id: string;
      label: string;
      billing_method: "recurring" | "retainer";
      amount: number;
      cadence: string;
      next_run_date: string;
      auto_draft: boolean;
      active: boolean;
      created_at: string;
      customers?: { name: string } | null;
      contracts?: { event_name: string } | null;
    };
    return {
      ...r,
      amount: Number(r.amount),
      customer_name: r.customers?.name,
      event_name: r.contracts?.event_name,
    };
  });
}

export async function listPaymentDrafts() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("payment_drafts")
    .select("*, customers(name), invoices(invoice_number)")
    .order("draft_date", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => {
    const r = row as {
      id: string;
      schedule_id: string | null;
      invoice_id: string | null;
      customer_id: string;
      amount: number;
      draft_date: string;
      status: string;
      reference: string | null;
      created_at: string;
      customers?: { name: string } | null;
      invoices?: { invoice_number: string } | null;
    };
    return {
      ...r,
      amount: Number(r.amount),
      customer_name: r.customers?.name,
      invoice_number: r.invoices?.invoice_number,
    };
  });
}

export async function listUnbilledInputs(contractId: string) {
  const supabase = createClient();
  const [time, costs, milestones] = await Promise.all([
    supabase
      .from("billable_time_entries")
      .select("*")
      .eq("contract_id", contractId)
      .is("billed_invoice_id", null),
    supabase
      .from("billable_costs")
      .select("*")
      .eq("contract_id", contractId)
      .is("billed_invoice_id", null),
    supabase.from("contract_milestones").select("*").eq("contract_id", contractId),
  ]);
  if (time.error) throw time.error;
  if (costs.error) throw costs.error;
  if (milestones.error) throw milestones.error;
  return {
    time: time.data ?? [],
    costs: costs.data ?? [],
    milestones: milestones.data ?? [],
  };
}

export async function contractBilledToDate(contractId: string): Promise<number> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("invoices")
    .select("total, status")
    .eq("contract_id", contractId)
    .not("status", "in", '("void","canceled","draft")');
  if (error) throw error;
  return (data ?? []).reduce((s, i) => s + Number(i.total), 0);
}
