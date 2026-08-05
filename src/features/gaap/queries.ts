import { createClient } from "@/lib/supabase/server";
import type {
  ContractModification,
  CostClassification,
  GaapContractPosition,
  GaapPolicy,
  ProfitabilityInput,
  RecognitionEvidence,
} from "@/lib/supabase/types";

function num(v: unknown): number {
  return Number(v ?? 0);
}

export async function listGaapPolicies(): Promise<GaapPolicy[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("gaap_policies")
    .select("*")
    .order("sort_order");
  if (error) throw error;
  return (data ?? []) as GaapPolicy[];
}

export async function listContractPositions(): Promise<GaapContractPosition[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("v_gaap_contract_position")
    .select("*")
    .order("event_name");
  if (error) throw error;
  return (data ?? []).map((r) => ({
    ...(r as GaapContractPosition),
    contract_value: num(r.contract_value),
    progress_percent: num(r.progress_percent),
    billed_to_date: num(r.billed_to_date),
    earned_to_date: num(r.earned_to_date),
    contract_asset: num(r.contract_asset),
    unearned_deposits: num(r.unearned_deposits),
    deferred_billed_outstanding: num(r.deferred_billed_outstanding),
    total_contract_liability: num(r.total_contract_liability),
    recognized_revenue_billed: num(r.recognized_revenue_billed),
    open_ar: num(r.open_ar),
  }));
}

export async function getPositionTotals(positions?: GaapContractPosition[]) {
  const rows = positions ?? (await listContractPositions());
  return {
    contractAsset: rows.reduce((s, r) => s + r.contract_asset, 0),
    contractLiability: rows.reduce((s, r) => s + r.total_contract_liability, 0),
    unearnedDeposits: rows.reduce((s, r) => s + r.unearned_deposits, 0),
    deferredBilled: rows.reduce((s, r) => s + r.deferred_billed_outstanding, 0),
    openAr: rows.reduce((s, r) => s + r.open_ar, 0),
    earnedNotBilled: rows.reduce((s, r) => s + r.contract_asset, 0),
    recognizedBilled: rows.reduce((s, r) => s + r.recognized_revenue_billed, 0),
  };
}

export async function listRecognitionEvidence(): Promise<
  (RecognitionEvidence & {
    event_name?: string;
    invoice_number?: string | null;
  })[]
> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("recognition_evidence")
    .select("*, contracts(event_name), invoices(invoice_number)")
    .order("evidence_date", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => {
    const r = row as RecognitionEvidence & {
      contracts?: { event_name: string } | null;
      invoices?: { invoice_number: string } | null;
    };
    return {
      ...r,
      event_name: r.contracts?.event_name,
      invoice_number: r.invoices?.invoice_number ?? null,
    };
  });
}

export async function countEvidenceForInvoice(
  invoiceId: string,
): Promise<number> {
  const supabase = createClient();
  const { count, error } = await supabase
    .from("recognition_evidence")
    .select("id", { count: "exact", head: true })
    .or(`invoice_id.eq.${invoiceId}`);
  if (error) throw error;
  return count ?? 0;
}

export async function countEvidenceForContract(
  contractId: string,
): Promise<number> {
  const supabase = createClient();
  const { count, error } = await supabase
    .from("recognition_evidence")
    .select("id", { count: "exact", head: true })
    .eq("contract_id", contractId);
  if (error) throw error;
  return count ?? 0;
}

export async function listDeferredInvoices() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("invoices")
    .select("*, customers(name), contracts(event_name, performance_complete)")
    .eq("recognition_status", "deferred")
    .not("status", "in", '("void","canceled","draft")')
    .order("issue_date", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => {
    const r = row as {
      id: string;
      invoice_number: string;
      issue_date: string;
      total: number;
      status: string;
      recognition_status: string;
      contract_id: string;
      customers?: { name: string } | null;
      contracts?: { event_name: string; performance_complete: boolean } | null;
    };
    const performanceComplete = Boolean(r.contracts?.performance_complete);
    return {
      ...r,
      total: Number(r.total),
      customer_name: r.customers?.name,
      event_name: r.contracts?.event_name,
      performance_complete: performanceComplete,
      timing_badge: performanceComplete
        ? ("earned_then_billed" as const)
        : ("billed_before_performance" as const),
    };
  });
}

export async function listContractModifications(): Promise<
  (ContractModification & { event_name?: string; customer_name?: string })[]
> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("contract_modifications")
    .select("*, contracts(event_name, customer_id)")
    .order("effective_date", { ascending: false });
  if (error) throw error;

  const customerIds = [
    ...new Set(
      (data ?? [])
        .map((row) => {
          const r = row as { contracts?: { customer_id?: string } | null };
          return r.contracts?.customer_id;
        })
        .filter(Boolean) as string[],
    ),
  ];
  const { data: customers } = customerIds.length
    ? await supabase.from("customers").select("id, name").in("id", customerIds)
    : { data: [] as { id: string; name: string }[] };
  const nameById = new Map(
    (customers ?? []).map((c) => [c.id as string, c.name as string]),
  );

  return (data ?? []).map((row) => {
    const r = row as ContractModification & {
      contracts?: { event_name: string; customer_id: string } | null;
    };
    return {
      ...r,
      price_change: num(r.price_change),
      prior_contract_value:
        r.prior_contract_value == null ? null : num(r.prior_contract_value),
      event_name: r.contracts?.event_name,
      customer_name: r.contracts?.customer_id
        ? nameById.get(r.contracts.customer_id)
        : undefined,
    };
  });
}

export async function listCostClassifications(): Promise<
  (CostClassification & { event_name?: string })[]
> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("cost_classifications")
    .select("*, contracts(event_name)")
    .order("period", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => {
    const r = row as CostClassification & {
      contracts?: { event_name: string } | null;
    };
    return {
      ...r,
      amount: num(r.amount),
      event_name: r.contracts?.event_name,
    };
  });
}

export async function listProfitabilityInputs(): Promise<ProfitabilityInput[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("v_profitability_inputs")
    .select("*")
    .order("event_name");
  if (error) throw error;
  return (data ?? []).map((r) => ({
    ...(r as ProfitabilityInput),
    recognized_revenue: num(r.recognized_revenue),
    direct_event_cogs: num(r.direct_event_cogs),
    reimbursable_passthrough: num(r.reimbursable_passthrough),
    period_expenses: num(r.period_expenses),
  }));
}

export async function listAuditLedger(filters?: {
  entryType?: string;
  asOf?: string;
}) {
  const supabase = createClient();
  let q = supabase
    .from("ar_ledger_entries")
    .select("*, invoices(invoice_number, contract_id)")
    .order("created_at", { ascending: false })
    .limit(500);
  if (filters?.entryType) q = q.eq("entry_type", filters.entryType);
  if (filters?.asOf) q = q.lte("created_at", `${filters.asOf}T23:59:59.999Z`);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((row) => {
    const r = row as {
      id: string;
      invoice_id: string | null;
      entry_type: string;
      debit: number;
      credit: number;
      memo: string | null;
      created_at: string;
      invoices?: { invoice_number: string; contract_id: string } | null;
    };
    return {
      ...r,
      debit: num(r.debit),
      credit: num(r.credit),
      invoice_number: r.invoices?.invoice_number ?? null,
      contract_id: r.invoices?.contract_id ?? null,
    };
  });
}

export async function buildAuditPack() {
  const [ledger, evidence, mods, policies, positions] = await Promise.all([
    listAuditLedger(),
    listRecognitionEvidence(),
    listContractModifications(),
    listGaapPolicies(),
    listContractPositions(),
  ]);
  return {
    generated_at: new Date().toISOString(),
    positions,
    ledger,
    recognition_evidence: evidence,
    contract_modifications: mods,
    policies,
  };
}
