import { EventShell } from "@/components/events/EventShell";
import { PageHeader, Panel, StatCard } from "@/components/billing/ui";

export const dynamic = "force-dynamic";

export default async function TimeExpensesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <EventShell eventId={id} activeHref={`/events/${id}/time-expenses`}>
      <PageHeader
        title="Time & expenses"
        description="Demo ledger for coordinator labor and receipts. Not posted to GAAP books."
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Hours this week" value="18.5" tone="accent" />
        <StatCard label="Unsubmitted expenses" value="$126" tone="warn" />
        <StatCard label="Pending approval" value="1" />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title="Time entries">
          <ul className="space-y-2 text-sm">
            <li className="flex justify-between gap-2">
              <span>Site walkthrough</span>
              <span className="text-[var(--muted)]">3.0 hrs · 08/03</span>
            </li>
            <li className="flex justify-between gap-2">
              <span>Badge prep</span>
              <span className="text-[var(--muted)]">2.5 hrs · 08/04</span>
            </li>
            <li className="flex justify-between gap-2">
              <span>Vendor escort planning</span>
              <span className="text-[var(--muted)]">1.5 hrs · 08/05</span>
            </li>
          </ul>
        </Panel>
        <Panel title="Expense drafts">
          <ul className="space-y-2 text-sm">
            <li className="flex justify-between gap-2">
              <span>Mileage — Harbor Hall</span>
              <span>$126 · draft</span>
            </li>
            <li className="flex justify-between gap-2">
              <span>Badge stock print</span>
              <span>$84 · submitted</span>
            </li>
          </ul>
        </Panel>
      </div>
    </EventShell>
  );
}
