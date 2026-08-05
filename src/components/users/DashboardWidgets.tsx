import type { EventHealthItem } from "@/features/users/types";
import { Panel, StatusPill } from "@/components/billing/ui";

export function NextActionCard({
  action,
  detail,
}: {
  action: string;
  detail?: string;
}) {
  return (
    <div className="rounded-lg border border-[var(--accent)]/30 bg-[var(--accent-soft)] p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">
        Recommended next action
      </p>
      <p className="mt-2 font-[family-name:var(--font-display)] text-xl text-[var(--ink)]">
        {action}
      </p>
      {detail ? (
        <p className="mt-1 text-sm text-[var(--muted)]">{detail}</p>
      ) : null}
    </div>
  );
}

export function AiSummaryCard({ lines }: { lines: string[] }) {
  return (
    <Panel title="Executive AI Summary">
      <ul className="space-y-2 text-sm text-[var(--ink)]">
        {lines.map((line) => (
          <li key={line} className="flex gap-2">
            <span className="text-[var(--accent)]">•</span>
            <span>{line}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-[var(--muted)]">
        Draft narrative for demos — will connect to live metrics later.
      </p>
    </Panel>
  );
}

function scoreTone(score: number): "ok" | "warn" | "danger" {
  if (score >= 85) return "ok";
  if (score >= 70) return "warn";
  return "danger";
}

export function EventHealthCard({
  event,
  expanded = false,
}: {
  event: EventHealthItem;
  expanded?: boolean;
}) {
  return (
    <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-[var(--ink)]">{event.name}</p>
          <p className="text-xs text-[var(--muted)]">
            {event.customer} · {event.eventDate}
          </p>
        </div>
        <div className="text-right">
          <StatusPill tone={scoreTone(event.score)}>
            {event.score >= 85 ? "🟢" : event.score >= 70 ? "🟡" : "🔴"}{" "}
            {event.score} / 100
          </StatusPill>
          <p className="mt-1 text-xs text-[var(--muted)]">{event.stage}</p>
        </div>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#eef2f6]">
        <div
          className="h-full rounded-full bg-[var(--accent)]"
          style={{ width: `${event.progressPct}%` }}
        />
      </div>
      <p className="mt-1 text-xs text-[var(--muted)]">
        {event.progressPct}% · {event.stage}
      </p>

      {expanded ? (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <ul className="space-y-1.5 text-sm">
            {event.checks.map((c) => (
              <li key={c.label} className="flex gap-2">
                <span>{c.ok ? "✓" : "⚠"}</span>
                <span className={c.ok ? "text-[var(--ink)]" : "text-[var(--warn)]"}>
                  {c.label}
                </span>
              </li>
            ))}
          </ul>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              Why isn&apos;t this event 100?
            </p>
            <ul className="mt-2 space-y-1 text-sm text-[var(--ink)]">
              {event.whyNot100.map((w) => (
                <li key={w}>• {w}</li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function ControlGate({
  title,
  items,
}: {
  title: string;
  items: { label: string; ok: boolean }[];
}) {
  const ready = items.every((i) => i.ok);
  return (
    <Panel
      title={title}
      action={
        <StatusPill tone={ready ? "ok" : "danger"}>
          {ready ? "Ready allowed" : "Blocked"}
        </StatusPill>
      }
    >
      <ul className="space-y-2 text-sm">
        {items.map((i) => (
          <li key={i.label} className="flex items-center gap-2">
            <span
              className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs ${
                i.ok
                  ? "bg-[#e8f6ee] text-[var(--ok)]"
                  : "bg-[#fdecec] text-[var(--danger)]"
              }`}
            >
              {i.ok ? "✓" : "×"}
            </span>
            {i.label}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-[var(--muted)]">
        Event cannot move to Ready until every control is complete.
      </p>
    </Panel>
  );
}
