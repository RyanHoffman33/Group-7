import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getEventProfit,
  getOverheadAllocation,
  listBudgetVsActual,
  listExceptions,
} from "@/features/profitability/queries";
import {
  categoryLabel,
  exceptionMeta,
  exceptionTitle,
  statusTone,
} from "@/features/profitability/labels";
import { Money, PageHeader, Panel, StatusPill } from "@/components/billing/ui";
import { Waterfall } from "@/components/profitability/Waterfall";

export const dynamic = "force-dynamic";

export default async function EventProfitPage({
  params,
}: {
  params: Promise<{ contract_id: string }>;
}) {
  const { contract_id } = await params;
  const [event, overhead, exceptions, budgetRows] = await Promise.all([
    getEventProfit(contract_id),
    getOverheadAllocation(contract_id),
    listExceptions(contract_id),
    listBudgetVsActual(contract_id),
  ]);
  if (!event) notFound();

  return (
    <div>
      <PageHeader
        title={event.event_name}
        description={`${event.customer_name}${
          event.contract_number ? ` · ${event.contract_number}` : ""
        }${event.event_type ? ` · ${event.event_type.replaceAll("_", " ")}` : ""}${
          event.project_manager_label ? ` · PM ${event.project_manager_label}` : ""
        }`}
        actions={
          <div className="flex items-center gap-3">
            <StatusPill tone={statusTone[event.status] ?? "neutral"}>
              {event.status.replaceAll("_", " ")}
            </StatusPill>
            <Link
              href="/profitability"
              className="text-sm text-[var(--accent)] hover:underline"
            >
              ← All events
            </Link>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Panel title="The money story">
          <Waterfall event={event} overhead={overhead} exceptions={exceptions} />
          <p className="mt-4 text-xs text-[var(--muted)]">
            Sources: <code className="text-[11px]">v_profit_event</code>,{" "}
            <code className="text-[11px]">v_profit_overhead_allocation</code>,{" "}
            <code className="text-[11px]">v_profit_exceptions</code>.
          </p>
        </Panel>

        <div className="space-y-4">
          <Panel title="Cost breakdown">
            <dl className="space-y-3 text-sm">
              {[
                {
                  label: "Direct COGS (deduped)",
                  amount: event.direct_cogs,
                  hint: "In margin",
                },
                {
                  label: "Reimbursable pass-through",
                  amount: event.reimbursable_passthrough,
                  hint: "Memo — excluded from margin",
                },
                {
                  label: "Selling & period expenses",
                  amount: event.selling_and_period_expenses,
                  hint: "Period expense",
                },
                {
                  label: "Overhead (allocated entries)",
                  amount: event.overhead_allocated_entries,
                  hint: "Period expense",
                },
                {
                  label: "Committed, not yet actual",
                  amount: event.committed_cost_open,
                  hint: "Open commitments",
                },
              ].map((r) => (
                <div
                  key={r.label}
                  className="flex justify-between gap-4 border-b border-[var(--line)] pb-3 last:border-0 last:pb-0"
                >
                  <dt>
                    <span className="text-[var(--ink)]">{r.label}</span>
                    <span className="block text-xs text-[var(--muted)]">
                      {r.hint}
                    </span>
                  </dt>
                  <dd className="font-semibold">
                    <Money amount={r.amount} />
                  </dd>
                </div>
              ))}
            </dl>
          </Panel>

          <Panel title="Budget vs actual by category">
            {budgetRows.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">
                No budget or cost lines recorded yet.
              </p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wider text-[var(--muted)]">
                  <tr className="border-b border-[var(--line)]">
                    <th className="pb-2 font-medium">Category</th>
                    <th className="pb-2 text-right font-medium">Budget</th>
                    <th className="pb-2 text-right font-medium">Actual</th>
                    <th className="pb-2 text-right font-medium">Variance</th>
                  </tr>
                </thead>
                <tbody>
                  {budgetRows.map((r) => (
                    <tr
                      key={r.category}
                      className="border-b border-[var(--line)] last:border-0"
                    >
                      <td className="py-2">
                        {categoryLabel(r.category)}
                        {r.committed_amount > 0 ? (
                          <span className="block text-xs text-[var(--muted)]">
                            + <Money amount={r.committed_amount} /> committed
                          </span>
                        ) : null}
                      </td>
                      <td className="py-2 text-right">
                        <Money amount={r.budgeted_amount} />
                      </td>
                      <td className="py-2 text-right">
                        <Money amount={r.actual_amount} />
                      </td>
                      <td
                        className={`py-2 text-right ${
                          r.over_budget ? "text-[var(--danger)]" : ""
                        }`}
                      >
                        <Money amount={r.variance} />
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-[var(--line)] text-sm font-semibold">
                    <td className="pt-2">Total</td>
                    <td className="pt-2 text-right">
                      {event.budget_total == null ? (
                        "—"
                      ) : (
                        <Money amount={event.budget_total} />
                      )}
                    </td>
                    <td className="pt-2 text-right">
                      <Money amount={event.actual_cost_total} />
                    </td>
                    <td
                      className={`pt-2 text-right ${
                        event.budget_remaining < 0 ? "text-[var(--danger)]" : ""
                      }`}
                    >
                      <Money amount={event.budget_remaining} />
                    </td>
                  </tr>
                </tfoot>
              </table>
            )}
          </Panel>

          <Panel title="Billing position">
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between gap-4 border-b border-[var(--line)] pb-3">
                <dt className="text-[var(--muted)]">Earned to date</dt>
                <dd className="font-semibold">
                  <Money amount={event.earned_to_date} />
                </dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-[var(--line)] pb-3">
                <dt className="text-[var(--muted)]">Billed to date</dt>
                <dd className="font-semibold">
                  <Money amount={event.billed_to_date} />
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--muted)]">Earned, not billed</dt>
                <dd
                  className={`font-semibold ${
                    event.earned_not_billed > 0 ? "text-[var(--warn)]" : ""
                  }`}
                >
                  <Money amount={event.earned_not_billed} />
                </dd>
              </div>
            </dl>
          </Panel>
        </div>
      </div>

      {exceptions.length > 0 ? (
        <div className="mt-4">
          <Panel title="Exception flags on this event">
            <ul className="space-y-3">
              {exceptions.map((f, i) => (
                <li
                  key={`${f.exception_type}-${f.ref_id ?? i}`}
                  className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--line)] pb-3 last:border-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <StatusPill
                        tone={exceptionMeta[f.exception_type]?.tone ?? "warn"}
                      >
                        {exceptionTitle(f.exception_type)}
                      </StatusPill>
                    </div>
                    <p className="mt-1.5 text-sm text-[var(--ink)]">{f.detail}</p>
                    <p className="mt-0.5 text-xs text-[var(--muted)]">
                      {exceptionMeta[f.exception_type]?.risk}
                    </p>
                  </div>
                  {f.amount != null ? (
                    <span className="text-sm font-semibold">
                      <Money amount={f.amount} />
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      ) : null}
    </div>
  );
}
