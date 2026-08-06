import { createClient } from "@/lib/supabase/server";

export interface DemoCustomer {
  id: string;
  name: string;
  billing_email: string | null;
  status: string;
  phone?: string | null;
  source: "supabase" | "memory";
}

/** Fallback master when Supabase insert/select is unavailable. */
export const demoCustomers: DemoCustomer[] = [];

export async function ensureCustomerForOrganization(input: {
  name: string;
  billingEmail: string;
  phone?: string;
}): Promise<DemoCustomer> {
  const name = input.name.trim();
  const email = input.billingEmail.trim().toLowerCase();

  const mem = demoCustomers.find(
    (c) =>
      c.name.toLowerCase() === name.toLowerCase() ||
      (c.billing_email ?? "").toLowerCase() === email,
  );
  if (mem) return mem;

  try {
    const supabase = createClient();
    const { data: existing } = await supabase
      .from("customers")
      .select("id, name, billing_email, status")
      .limit(500);
    const hit = (existing ?? []).find(
      (c) =>
        (c.name as string).toLowerCase() === name.toLowerCase() ||
        ((c.billing_email as string | null) ?? "").toLowerCase() === email,
    );
    if (hit) {
      return {
        id: hit.id as string,
        name: hit.name as string,
        billing_email: (hit.billing_email as string | null) ?? null,
        status: (hit.status as string) ?? "active",
        source: "supabase",
      };
    }

    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `cust-demo-${Date.now()}`;
    const { data, error } = await supabase
      .from("customers")
      .insert({
        id,
        name,
        billing_email: email,
        status: "active",
      })
      .select("id, name, billing_email, status")
      .maybeSingle();
    if (!error && data) {
      return {
        id: data.id as string,
        name: data.name as string,
        billing_email: (data.billing_email as string | null) ?? null,
        status: (data.status as string) ?? "active",
        source: "supabase",
      };
    }
  } catch {
    /* fall through to memory */
  }

  const row: DemoCustomer = {
    id: `cust-mem-${Date.now()}`,
    name,
    billing_email: email,
    status: "active",
    phone: input.phone ?? null,
    source: "memory",
  };
  demoCustomers.push(row);
  return row;
}

export async function listCustomersMerged(): Promise<DemoCustomer[]> {
  const merged: DemoCustomer[] = [...demoCustomers];
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("customers")
      .select("id, name, billing_email, status")
      .order("name");
    if (!error && data) {
      for (const row of data) {
        if (!merged.some((m) => m.id === row.id)) {
          merged.push({
            id: row.id as string,
            name: row.name as string,
            billing_email: (row.billing_email as string | null) ?? null,
            status: (row.status as string) ?? "active",
            source: "supabase",
          });
        }
      }
    }
  } catch {
    /* memory only */
  }
  return merged.sort((a, b) => a.name.localeCompare(b.name));
}
