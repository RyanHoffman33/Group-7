import { createClient } from "@/lib/supabase/server";
import { agingBucket } from "./aging";
import { listOutstanding } from "./queries";
import type { AgingBucket } from "@/lib/supabase/types";

export type AgingCheckResult = {
  checked: number;
  transitions: number;
  alerts: {
    invoice_id: string;
    from_bucket: AgingBucket;
    to_bucket: AgingBucket;
    outstanding_amount: number;
  }[];
};

/**
 * Compare each open invoice's aging bucket to ar_bucket_state.
 * On change: insert billing_alerts row and update state.
 */
export async function runAgingCheck(): Promise<AgingCheckResult> {
  const supabase = createClient();
  const outstanding = await listOutstanding();
  const alerts: AgingCheckResult["alerts"] = [];

  for (const row of outstanding) {
    const bucket = agingBucket(row.due_date);

    const { data: state } = await supabase
      .from("ar_bucket_state")
      .select("*")
      .eq("invoice_id", row.invoice_id)
      .maybeSingle();

    if (!state) {
      await supabase.from("ar_bucket_state").insert({
        invoice_id: row.invoice_id,
        current_bucket: bucket,
        outstanding_amount: row.outstanding,
        updated_at: new Date().toISOString(),
      });
      continue;
    }

    const prev = state.current_bucket as AgingBucket;
    if (prev !== bucket) {
      await supabase.from("billing_alerts").insert({
        invoice_id: row.invoice_id,
        customer_id: row.customer_id,
        from_bucket: prev,
        to_bucket: bucket,
        outstanding_amount: row.outstanding,
        channel: "in_app",
      });

      await supabase
        .from("ar_bucket_state")
        .update({
          current_bucket: bucket,
          outstanding_amount: row.outstanding,
          updated_at: new Date().toISOString(),
        })
        .eq("invoice_id", row.invoice_id);

      alerts.push({
        invoice_id: row.invoice_id,
        from_bucket: prev,
        to_bucket: bucket,
        outstanding_amount: row.outstanding,
      });
    } else {
      await supabase
        .from("ar_bucket_state")
        .update({
          outstanding_amount: row.outstanding,
          updated_at: new Date().toISOString(),
        })
        .eq("invoice_id", row.invoice_id);
    }
  }

  // Clear bucket state for invoices no longer outstanding
  const openIds = new Set(outstanding.map((o) => o.invoice_id));
  const { data: allStates } = await supabase
    .from("ar_bucket_state")
    .select("invoice_id");
  for (const s of allStates ?? []) {
    if (!openIds.has(s.invoice_id)) {
      await supabase
        .from("ar_bucket_state")
        .delete()
        .eq("invoice_id", s.invoice_id);
    }
  }

  return {
    checked: outstanding.length,
    transitions: alerts.length,
    alerts,
  };
}
