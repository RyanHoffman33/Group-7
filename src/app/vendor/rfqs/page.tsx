import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader, Panel } from "@/components/billing/ui";
import { VendorRfqList } from "@/components/engagement/VendorRfqClient";
import {
  listNotifications,
  listRfqsForVendorIds,
  resolveVendorIdsForPortalEmail,
} from "@/features/engagement/queries";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/features/users/session";
import type { VendorQuote } from "@/features/engagement/types";

export const dynamic = "force-dynamic";

async function listQuotesForVendorIds(
  vendorIds: string[],
): Promise<VendorQuote[]> {
  if (!vendorIds.length) return [];
  const supabase = createClient();
  const { data, error } = await supabase
    .from("vendor_quotes")
    .select("*")
    .in("vendor_id", vendorIds)
    .order("submitted_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: String(r.id),
    rfq_id: String(r.rfq_id),
    vendor_id: String(r.vendor_id),
    amount: Number(r.amount),
    line_items: Array.isArray(r.line_items) ? (r.line_items as VendorQuote["line_items"]) : [],
    notes: String(r.notes ?? ""),
    status: r.status as VendorQuote["status"],
    submitted_at: String(r.submitted_at ?? ""),
    created_at: String(r.created_at ?? ""),
  }));
}

export default async function VendorRfqsPage() {
  const session = await getSessionUser();
  if (!session) redirect("/login");
  if (
    !["vendor", "project_manager", "system_admin"].includes(session.roleKey)
  ) {
    redirect("/home");
  }

  const email =
    session.roleKey === "vendor" ? session.email : "vendor@gmail.com";
  const vendorIds = await resolveVendorIdsForPortalEmail(email);
  const [rfqs, myQuotes, notifications] = await Promise.all([
    listRfqsForVendorIds(vendorIds),
    listQuotesForVendorIds(vendorIds),
    listNotifications("vendor", 8),
  ]);

  return (
    <div>
      <PageHeader
        title="Vendor inquiries (RFQs)"
        description="Respond to MainEvent sourcing requests with your quote. Internal markup is never shown here."
      />
      <p className="mb-4 text-sm">
        <Link
          href="/vendor"
          className="text-[var(--accent)] underline-offset-2 hover:underline"
        >
          ← Vendor portal home
        </Link>
      </p>

      {notifications.length ? (
        <div className="mb-4">
          <Panel title="Notifications">
            <ul className="space-y-2 text-sm">
              {notifications.map((n) => (
                <li key={n.id} className="rounded-md bg-[var(--bg)] px-3 py-2">
                  <p className="font-medium">{n.title}</p>
                  <p className="text-[var(--muted)]">{n.body}</p>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      ) : null}

      <Panel title="Incoming RFQs">
        {rfqs.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">
            No RFQs assigned to your vendor account yet.
          </p>
        ) : (
          <VendorRfqList rfqs={rfqs} myQuotes={myQuotes} />
        )}
      </Panel>
    </div>
  );
}
