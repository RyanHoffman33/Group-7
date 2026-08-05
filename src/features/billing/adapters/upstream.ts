import { createClient } from "@/lib/supabase/server";
import type { Contract, Customer } from "@/lib/supabase/types";

/**
 * Adapter for stub customers table.
 * When Brandon/Gabriel ship real modules, swap queries here only.
 */
export async function listCustomers(): Promise<Customer[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .order("name");
  if (error) throw error;
  return (data ?? []) as Customer[];
}

export async function getCustomer(id: string): Promise<Customer | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data as Customer | null;
}

export async function listContracts(): Promise<Contract[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("contracts")
    .select("*")
    .order("event_name");
  if (error) throw error;
  return (data ?? []) as Contract[];
}

export async function getContract(id: string): Promise<Contract | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("contracts")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data as Contract | null;
}

export async function listContractsByCustomer(
  customerId: string,
): Promise<Contract[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("contracts")
    .select("*")
    .eq("customer_id", customerId)
    .order("event_name");
  if (error) throw error;
  return (data ?? []) as Contract[];
}
