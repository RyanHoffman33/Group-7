import { createClient } from "@/lib/supabase/server";
import { AGING_BUCKETS, PORTFOLIO_DEFAULT_P } from "./aging";
import type { AgingBucket } from "@/lib/supabase/types";

/**
 * Recompute empirical payment behavior for a customer.
 * Uses paid invoices: days from due_date to final payment application.
 * Bucket survival ≈ share of paid invoices that were eventually collected
 * after reaching each aging bucket (simplified empirical curve).
 */
export async function recomputeCustomerPaymentStats(
  customerId: string,
): Promise<void> {
  const supabase = createClient();

  const { data: paidInvoices, error } = await supabase
    .from("invoices")
    .select("id, due_date, total, status")
    .eq("customer_id", customerId)
    .eq("status", "paid");
  if (error) throw error;

  if (!paidInvoices || paidInvoices.length === 0) {
    await supabase.from("customer_payment_stats").upsert({
      customer_id: customerId,
      avg_days_to_pay: null,
      on_time_rate: null,
      sample_size: 0,
      bucket_survival: PORTFOLIO_DEFAULT_P,
      updated_at: new Date().toISOString(),
    });
    return;
  }

  const daysList: number[] = [];
  let onTime = 0;

  for (const inv of paidInvoices) {
    const { data: apps } = await supabase
      .from("payment_applications")
      .select("amount, created_at, payments(paid_at)")
      .eq("invoice_id", inv.id);

    let lastPay: string | null = null;
    for (const a of apps ?? []) {
      const p = a.payments as { paid_at?: string } | null;
      const paidAt = p?.paid_at ?? a.created_at?.slice(0, 10);
      if (paidAt && (!lastPay || paidAt > lastPay)) lastPay = paidAt;
    }
    if (!lastPay) continue;

    const due = new Date(inv.due_date + "T00:00:00");
    const paid = new Date(lastPay + "T00:00:00");
    const days = Math.floor(
      (paid.getTime() - due.getTime()) / (1000 * 60 * 60 * 24),
    );
    daysList.push(days);
    if (days <= 0) onTime += 1;
  }

  const sample = daysList.length;
  const avg =
    sample > 0 ? daysList.reduce((s, d) => s + d, 0) / sample : null;
  const onTimeRate = sample > 0 ? onTime / sample : null;

  // Empirical survival: if customer paid invoices that reached bucket X, they collected
  const survival: Record<AgingBucket, number> = { ...PORTFOLIO_DEFAULT_P };
  if (sample > 0) {
    for (const bucket of AGING_BUCKETS) {
      const threshold =
        bucket === "current"
          ? -Infinity
          : bucket === "1-30"
            ? 1
            : bucket === "31-60"
              ? 31
              : bucket === "61-90"
                ? 61
                : 91;
      // Invoices that reached this bucket (days past due at payment >= threshold)
      // and were still paid → high survival; blend with how late they typically pay
      const reached = daysList.filter((d) => d >= (threshold === -Infinity ? -9999 : threshold));
      if (bucket === "current") {
        survival.current = 1;
      } else if (reached.length === 0) {
        // Never aged this far before paying — still likely to pay if early payer
        survival[bucket] = Math.max(
          PORTFOLIO_DEFAULT_P[bucket],
          onTimeRate ?? PORTFOLIO_DEFAULT_P[bucket],
        );
      } else {
        // All in sample were eventually paid, so conditional on reaching bucket, P≈1 for collectors
        // Soften by how deep into delinquency they go on average
        const lateShare = reached.length / sample;
        survival[bucket] = Math.min(
          0.99,
          Math.max(0.35, 1 - lateShare * 0.15 + (onTimeRate ?? 0) * 0.1),
        );
      }
    }
  }

  await supabase.from("customer_payment_stats").upsert({
    customer_id: customerId,
    avg_days_to_pay: avg,
    on_time_rate: onTimeRate,
    sample_size: sample,
    bucket_survival: survival,
    updated_at: new Date().toISOString(),
  });
}
