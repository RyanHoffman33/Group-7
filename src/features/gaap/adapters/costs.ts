import { createClient } from "@/lib/supabase/server";
import type { BillableCost } from "@/lib/supabase/types";

/**
 * Walker — Cost & Resources adapter.
 * Classifications key off cost_ref_id (+ cost_source).
 * When real expenses replace billable_costs, keep the same ref pattern.
 */
export async function listBillableCostsForContract(
  contractId: string,
): Promise<BillableCost[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("billable_costs")
    .select("*")
    .eq("contract_id", contractId)
    .order("incurred_date", { ascending: false });
  if (error) throw error;
  return (data ?? []) as BillableCost[];
}

export async function listUnclassifiedCostHints(): Promise<
  { cost_ref_id: string; contract_id: string; description: string; amount: number; is_reimbursable: boolean }[]
> {
  const supabase = createClient();
  const { data: costs, error } = await supabase
    .from("billable_costs")
    .select("id, contract_id, description, cost_amount, is_reimbursable");
  if (error) throw error;

  const { data: classified } = await supabase
    .from("cost_classifications")
    .select("cost_ref_id");
  const taken = new Set((classified ?? []).map((c) => c.cost_ref_id as string));

  return (costs ?? [])
    .filter((c) => !taken.has(c.id as string))
    .map((c) => ({
      cost_ref_id: c.id as string,
      contract_id: c.contract_id as string,
      description: c.description as string,
      amount: Number(c.cost_amount),
      is_reimbursable: Boolean(c.is_reimbursable),
    }));
}
