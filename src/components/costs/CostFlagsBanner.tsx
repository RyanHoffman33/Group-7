import { StatusPill } from "@/components/billing/ui";
import {
  FLAG_LABELS,
  activeFlags,
  flagReasons,
  type CostFlagKey,
  type FlagReasonInput,
} from "@/features/costs/flags";

export function CostFlagPills({ entry }: { entry: FlagReasonInput }) {
  const reasons = flagReasons(entry);
  if (!reasons.length) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {reasons.map((r) => (
        <StatusPill
          key={r}
          tone={
            r.includes("No commitment") ||
            r.includes("% over") ||
            r.includes("Over category")
              ? "danger"
              : "warn"
          }
        >
          {r}
        </StatusPill>
      ))}
    </div>
  );
}

export function CostFlagsBanner({
  flags,
  title = "Control alerts",
  reasons,
}: {
  flags: CostFlagKey[];
  title?: string;
  reasons?: string[];
}) {
  const lines = reasons?.length
    ? reasons
    : flags.map((f) => FLAG_LABELS[f]);
  if (!lines.length) return null;
  return (
    <div className="mb-4 rounded-lg border border-[var(--warn)]/30 bg-[#fff7eb] px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-[var(--warn)]">
        {title}
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[var(--ink)]">
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </div>
  );
}

export function CostFlagReasonsList({ entry }: { entry: FlagReasonInput }) {
  const reasons = flagReasons(entry);
  if (!reasons.length) return null;
  return (
    <ul className="space-y-1">
      {reasons.map((r) => (
        <li key={r} className="text-xs text-[var(--warn)]">
          {r}
        </li>
      ))}
    </ul>
  );
}
