import { formatDate, formatLabel } from "@/features/billing/aging";
import {
  listBillingSchedules,
  listPaymentDrafts,
} from "@/features/billing/queries";
import { RunSchedulesButton } from "@/components/billing/RunSchedulesButton";
import { Money, PageHeader, Panel, StatusPill } from "@/components/billing/ui";

export const dynamic = "force-dynamic";

export default async function RecurringBillingPage() {
  const [schedules, drafts] = await Promise.all([
    listBillingSchedules(),
    listPaymentDrafts(),
  ]);

  return (
    <div>
      <PageHeader
        title="Recurring & automatic drafts"
        description="Retainer and monthly recurring schedules. No real payment processor — drafts are simulated ACH pulls applied to invoices for demo."
        actions={<RunSchedulesButton />}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Active billing schedules">
          {schedules.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No schedules seeded.</p>
          ) : (
            <ul className="space-y-3 text-sm">
              {schedules.map((s) => (
                <li
                  key={s.id}
                  className="rounded-md border border-[var(--line)] p-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{s.label}</p>
                      <p className="text-[var(--muted)]">
                        {s.customer_name} · {s.event_name}
                      </p>
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        {formatLabel(s.billing_method)} · {s.cadence} · next{" "}
                        {formatDate(s.next_run_date)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">
                        <Money amount={s.amount} />
                      </p>
                      <StatusPill tone={s.auto_draft ? "accent" : "neutral"}>
                        {s.auto_draft ? "auto-draft" : "invoice only"}
                      </StatusPill>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Simulated payment drafts">
          {drafts.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">
              No drafts yet. Run due schedules or issue a bill with auto-draft.
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {drafts.map((d) => (
                <li
                  key={d.id}
                  className="flex justify-between gap-3 border-b border-[var(--line)] py-2"
                >
                  <span>
                    {formatDate(d.draft_date)} · {d.customer_name}
                    <span className="block text-xs text-[var(--muted)]">
                      {d.invoice_number ?? "—"} · {d.reference}
                    </span>
                  </span>
                  <span className="text-right">
                    <Money amount={d.amount} />
                    <span className="block">
                      <StatusPill
                        tone={
                          d.status === "applied"
                            ? "ok"
                            : d.status === "failed"
                              ? "danger"
                              : "warn"
                        }
                      >
                        {formatLabel(d.status)}
                      </StatusPill>
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
