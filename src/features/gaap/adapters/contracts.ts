import { createClient } from "@/lib/supabase/server";
import type { Contract } from "@/lib/supabase/types";

/**
 * Gabriel — Contracts & Engagements adapter.
 * Compliance keys mods and evidence by contract_id.
 * Swap this file when real contracts land; keep id / contract_value / performance flags.
 */
export async function getContractForGaap(
  contractId: string,
): Promise<Contract | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("contracts")
    .select("*")
    .eq("id", contractId)
    .maybeSingle();
  if (error) throw error;
  return data as Contract | null;
}

export async function listContractsForGaap(): Promise<Contract[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("contracts")
    .select("*")
    .order("event_name");
  if (error) throw error;
  return (data ?? []) as Contract[];
}

export async function updateContractValue(
  contractId: string,
  newValue: number,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("contracts")
    .update({ contract_value: newValue })
    .eq("id", contractId);
  if (error) throw error;
}
