import { createClient } from "@/lib/supabase/server";
import type { BillableCost } from "@/lib/supabase/types";

/**
 * Walker — Cost & Resources adapter.
 * Classifications key off cost_ref_id (+ cost_source).
 * Real expenses live in cost_entries; keep UUID refs for GAAP.
 */
export async function listBillableCostsForContract(
  contractId: string,
): Promise<BillableCost[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("cost_entries")
    .select("*")
    .eq("contract_id", contractId)
    .order("incurred_date", { ascending: false });
  if (error) throw error;

  const { data: contract } = await supabase
    .from("contracts")
    .select("customer_id")
    .eq("id", contractId)
    .maybeSingle();

  return (data ?? []).map((c) => ({
    id: c.id as string,
    contract_id: c.contract_id as string,
    customer_id: (contract?.customer_id as string) ?? "",
    incurred_date: c.incurred_date as string,
    description:
      (c.notes as string) ||
      (c.vendor_name as string) ||
      (c.worker_label as string) ||
      (c.category as string),
    cost_amount: Number(c.amount),
    markup_percent: 0,
    is_reimbursable: Boolean(c.is_reimbursable),
    billed_invoice_id: null,
    created_at: c.created_at as string,
  }));
}

export async function listUnclassifiedCostHints(): Promise<
  {
    cost_ref_id: string;
    contract_id: string;
    description: string;
    amount: number;
    is_reimbursable: boolean;
  }[]
> {
  const supabase = createClient();
  const { data: costs, error } = await supabase
    .from("cost_entries")
    .select(
      "id, contract_id, notes, vendor_name, worker_label, category, amount, is_reimbursable",
    );
  if (error) throw error;

  const { data: classified } = await supabase
    .from("cost_classifications")
    .select("cost_ref_id")
    .eq("cost_source", "cost_entries");
  const taken = new Set((classified ?? []).map((c) => c.cost_ref_id as string));

  return (costs ?? [])
    .filter((c) => !taken.has(c.id as string))
    .map((c) => ({
      cost_ref_id: c.id as string,
      contract_id: c.contract_id as string,
      description:
        (c.notes as string) ||
        (c.vendor_name as string) ||
        (c.worker_label as string) ||
        (c.category as string),
      amount: Number(c.amount),
      is_reimbursable: Boolean(c.is_reimbursable),
    }));
}
