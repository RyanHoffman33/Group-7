import { getContractControlRows } from "@/features/controls/contract-state";
import { Panel, StatusPill } from "@/components/billing/ui";

const stateMeta: Record<
  string,
  { label: string; tone: "ok" | "warn" | "danger" | "neutral" }
> = {
  blocking: { label: "Enforcing · blocking", tone: "danger" },
  flagged: { label: "Flagged", tone: "warn" },
  satisfied: { label: "Satisfied", tone: "ok" },
  clear: { label: "Clear", tone: "neutral" },
};

export async function ContractControlsPanel({
  contractId,
}: {
  contractId: string;
}) {
  const rows = await getContractControlRows(contractId);
  if (rows.length === 0) return null;

  return (
    <div className="mt-4">
      <Panel title="Controls on this contract">
        <ul className="divide-y divide-[var(--line)]">
          {rows.map((r) => {
            const meta = stateMeta[r.state];
            return (
              <li key={r.control} className="flex flex-wrap items-start gap-3 py-3 first:pt-0 last:pb-0">
                <div className="w-52 shrink-0">
                  <p className="text-sm font-medium text-[var(--ink)]">
                    {r.control}
                  </p>
                  <StatusPill tone={meta.tone}>{meta.label}</StatusPill>
                </div>
                <div className="min-w-0 flex-1 text-sm text-[var(--muted)]">
                  <p>{r.summary}</p>
                  {r.action ? (
                    <p className="mt-0.5 text-xs">
                      <span className="font-semibold text-[var(--ink)]">
                        Lifts it:{" "}
                      </span>
                      {r.action}
                    </p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
        <p className="mt-3 border-t border-[var(--line)] pt-3 text-xs text-[var(--muted)]">
          Read-only view derived live from this contract&apos;s records. Full
          control definitions: Compliance → Controls.
        </p>
      </Panel>
    </div>
  );
}
