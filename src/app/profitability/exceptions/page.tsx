import Link from "next/link";
import {
  listExceptions,
  type ProfitException,
} from "@/features/profitability/queries";
import { exceptionMeta, exceptionTitle } from "@/features/profitability/labels";
import { Money, PageHeader, Panel, StatusPill } from "@/components/billing/ui";

export const dynamic = "force-dynamic";

export default async function ProfitExceptionsPage() {
  const exceptions = await listExceptions();

  const groups = new Map<string, ProfitException[]>();
  for (const f of exceptions) {
    const list = groups.get(f.exception_type) ?? [];
    list.push(f);
    groups.set(f.exception_type, list);
  }

  return (
    <div>
      <PageHeader
        title="Profitability exceptions"
        description="Anomalies surfaced by v_profit_exceptions — margin, billing, and cost-integrity findings. Collections and aging live with Billing & A/R."
        actions={
          <Link
            href="/profitability"
            className="text-sm text-[var(--accent)] hover:underline"
          >
            ← Overview
          </Link>
        }
      />

      {exceptions.length === 0 ? (
        <Panel>
          <p className="text-sm text-[var(--muted)]">
            No open exceptions — every event is clean.
          </p>
        </Panel>
      ) : (
        <div className="space-y-4">
          {[...groups.entries()].map(([type, rows]) => (
            <Panel
              key={type}
              title={`${exceptionTitle(type)} (${rows.length})`}
            >
              <p className="mb-3 text-xs text-[var(--muted)]">
                {exceptionMeta[type]?.risk ?? ""}
              </p>
              <ul className="space-y-3">
                {rows.map((f, i) => (
                  <li
                    key={`${f.contract_id}-${f.ref_id ?? i}`}
                    className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--line)] pb-3 last:border-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <Link
                        href={`/profitability/${f.contract_id}`}
                        className="font-medium text-[var(--accent)] hover:underline"
                      >
                        {f.event_name}
                      </Link>
                      <p className="mt-0.5 text-sm text-[var(--muted)]">
                        {f.detail}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {f.amount != null ? (
                        <span className="text-sm font-semibold">
                          <Money amount={f.amount} />
                        </span>
                      ) : null}
                      <StatusPill tone={exceptionMeta[type]?.tone ?? "warn"}>
                        {exceptionTitle(type)}
                      </StatusPill>
                    </div>
                  </li>
                ))}
              </ul>
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}
