import { createClient } from "@/lib/supabase/server";
import type { Vendor } from "@/lib/supabase/types";

/** Stub vendors table until a teammate vendors module lands. */
export async function listVendors(): Promise<Vendor[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("vendors")
    .select("*")
    .eq("status", "active")
    .order("name");
  if (error) throw error;
  return (data ?? []) as Vendor[];
}
