import { createClient } from "@/lib/supabase/server";
import type {
  BillableCost,
  BillableTimeEntry,
  BillingMethod,
  Contract,
  ContractMilestone,
} from "@/lib/supabase/types";
import { determineBill, type BillDetermination } from "./determine";

export async function buildDeterminationForContract(
  contractId: string,
  method: BillingMethod,
  opts?: { serviceQuantity?: number; placementBase?: number },
): Promise<
  | { ok: true; determination: BillDetermination; contract: Contract }
  | { ok: false; error: string }
> {
  try {
    const supabase = createClient();
    const { data: contract, error } = await supabase
      .from("contracts")
      .select("*")
      .eq("id", contractId)
      .single();
    if (error) throw error;

    const [{ data: invoices }, { data: time }, { data: costs }, { data: milestones }] =
      await Promise.all([
        supabase
          .from("invoices")
          .select("total, status")
          .eq("contract_id", contractId)
          .not("status", "in", '("void","canceled","draft")'),
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
        supabase
          .from("contract_milestones")
          .select("*")
          .eq("contract_id", contractId),
      ]);

    const alreadyBilled = (invoices ?? []).reduce(
      (s, i) => s + Number(i.total),
      0,
    );

    const determination = determineBill({
      contract: contract as Contract,
      method,
      alreadyBilled,
      unbilledTime: (time ?? []) as BillableTimeEntry[],
      unbilledCosts: (costs ?? []) as BillableCost[],
      openMilestones: (milestones ?? []) as ContractMilestone[],
      serviceQuantity: opts?.serviceQuantity,
      placementBase: opts?.placementBase,
    });

    return { ok: true, determination, contract: contract as Contract };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
