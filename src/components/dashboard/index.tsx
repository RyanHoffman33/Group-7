import type { ReactNode } from "react";

export function SectionHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h3 className="font-[family-name:var(--font-display)] text-lg text-[var(--ink)]">
          {title}
        </h3>
        {description ? (
          <p className="mt-0.5 text-sm text-[var(--muted)]">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function ProgressBar({
  value,
  label,
  hint,
}: {
  value: number;
  label?: string;
  hint?: string;
}) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div>
      {(label || hint) && (
        <div className="mb-1.5 flex justify-between gap-2 text-xs">
          {label ? <span className="font-medium text-[var(--ink)]">{label}</span> : <span />}
          {hint ? <span className="text-[var(--muted)]">{hint}</span> : null}
        </div>
      )}
      <div className="h-2.5 overflow-hidden rounded-full bg-[#e8eef4]">
        <div
          className="h-full rounded-full bg-[var(--accent)] transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function DonutChart({
  segments,
  centerLabel,
  centerValue,
  size = 140,
}: {
  segments: { label: string; value: number; color: string }[];
  centerLabel?: string;
  centerValue?: string;
  size?: number;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  let cumulative = 0;
  const stops = segments.map((seg) => {
    const start = (cumulative / total) * 100;
    cumulative += seg.value;
    const end = (cumulative / total) * 100;
    return `${seg.color} ${start}% ${end}%`;
  });

  return (
    <div className="flex flex-wrap items-center gap-4">
      <div
        className="relative shrink-0 rounded-full"
        style={{
          width: size,
          height: size,
          background: `conic-gradient(${stops.join(", ")})`,
        }}
      >
        <div className="absolute inset-[22%] flex flex-col items-center justify-center rounded-full bg-[var(--surface)] text-center">
          {centerValue ? (
            <span className="font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--ink)]">
              {centerValue}
            </span>
          ) : null}
          {centerLabel ? (
            <span className="text-[10px] uppercase tracking-wide text-[var(--muted)]">
              {centerLabel}
            </span>
          ) : null}
        </div>
      </div>
      <ul className="min-w-[140px] space-y-1.5 text-sm">
        {segments.map((s) => (
          <li key={s.label} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-[var(--ink)]">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ background: s.color }}
              />
              {s.label}
            </span>
            <span className="tabular-nums text-[var(--muted)]">{s.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function FunnelChart({
  stages,
}: {
  stages: {
    title: string;
    count: number;
    pctLabel?: string;
    subMetrics?: string[];
    color: string;
  }[];
}) {
  const max = Math.max(...stages.map((s) => s.count), 1);
  return (
    <div className="space-y-3 overflow-x-auto">
      <div className="flex min-w-[640px] items-end gap-2">
        {stages.map((stage) => {
          const height = 48 + (stage.count / max) * 100;
          return (
            <div key={stage.title} className="flex-1">
              <div
                className="rounded-t-md px-2 py-3 text-white"
                style={{ background: stage.color, minHeight: height }}
              >
                <p className="text-[11px] font-medium opacity-90">{stage.title}</p>
                <p className="font-[family-name:var(--font-display)] text-xl font-semibold tabular-nums">
                  {stage.count.toLocaleString()}
                </p>
                {stage.pctLabel ? (
                  <p className="text-[10px] opacity-80">{stage.pctLabel}</p>
                ) : null}
              </div>
              {stage.subMetrics?.length ? (
                <ul className="mt-2 space-y-0.5 text-[11px] text-[var(--muted)]">
                  {stage.subMetrics.map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function FeatureCard({
  title,
  description,
  actionLabel,
  onAction,
  href,
}: {
  title: string;
  description: string;
  actionLabel: string;
  onAction?: () => void;
  href?: string;
}) {
  const btn = (
    <span className="mt-3 inline-flex rounded-md border border-[var(--line)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--accent)]">
      {actionLabel}
    </span>
  );
  const body = (
    <>
      <p className="font-semibold text-[var(--ink)]">{title}</p>
      <p className="mt-1 text-sm text-[var(--muted)]">{description}</p>
      {btn}
    </>
  );
  if (href) {
    return (
      <a
        href={href}
        className="block rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4 transition hover:border-[var(--accent)]/40"
      >
        {body}
      </a>
    );
  }
  return (
    <button
      type="button"
      onClick={onAction}
      className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4 text-left transition hover:border-[var(--accent)]/40"
    >
      {body}
    </button>
  );
}

export function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-lg border border-dashed border-[var(--line)] bg-[var(--bg)] px-6 py-10 text-center">
      <p className="font-semibold text-[var(--ink)]">{title}</p>
      <p className="mt-1 text-sm text-[var(--muted)]">{description}</p>
    </div>
  );
}

export function SearchField({
  value,
  onChange,
  placeholder = "Search…",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="h-10 w-full max-w-xs rounded-md border border-[var(--line)] bg-white px-3 text-sm outline-none ring-[var(--accent)] focus:ring-2"
    />
  );
}

export function FilterSelect({
  value,
  onChange,
  options,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  label?: string;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      {label ? <span className="text-[var(--muted)]">{label}</span> : null}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 rounded-md border border-[var(--line)] bg-white px-3 text-sm outline-none ring-[var(--accent)] focus:ring-2"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: string; label: string }[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1 border-b border-[var(--line)]">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          className={`border-b-2 px-3 py-2 text-sm font-medium transition ${
            active === t.id
              ? "border-[var(--accent)] text-[var(--accent)]"
              : "border-transparent text-[var(--muted)] hover:text-[var(--ink)]"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function AlertCard({
  tone,
  title,
  body,
}: {
  tone: "info" | "warn" | "danger" | "ok";
  title: string;
  body: string;
}) {
  const map = {
    info: "border-[var(--accent)]/25 bg-[var(--accent-soft)]",
    warn: "border-[var(--warn)]/30 bg-[#fff7eb]",
    danger: "border-[var(--danger)]/25 bg-[#fdf2f2]",
    ok: "border-[var(--ok)]/25 bg-[#e8f6ee]",
  };
  return (
    <div className={`rounded-lg border px-4 py-3 ${map[tone]}`}>
      <p className="text-sm font-semibold text-[var(--ink)]">{title}</p>
      <p className="mt-0.5 text-sm text-[var(--muted)]">{body}</p>
    </div>
  );
}

export function EventSubnav({
  eventId,
  items,
  activeHref,
}: {
  eventId: string;
  items: { href: string; label: string }[];
  activeHref: string;
}) {
  return (
    <nav
      aria-label="Event sections"
      className="mb-6 overflow-x-auto rounded-lg border border-[var(--line)] bg-[var(--surface)]"
    >
      <ul className="flex min-w-max gap-0.5 p-1">
        {items.map((item) => {
          const href = item.href.replace("[id]", eventId);
          const active = activeHref === href || activeHref.startsWith(`${href}/`);
          return (
            <li key={item.href}>
              <a
                href={href}
                className={`block rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap ${
                  active
                    ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                    : "text-[var(--muted)] hover:bg-[var(--bg)] hover:text-[var(--ink)]"
                }`}
              >
                {item.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function SpeakerCard({
  name,
  title,
  organization,
  sessionTitle,
  publicOnly,
}: {
  name: string;
  title: string;
  organization: string;
  sessionTitle?: string;
  publicOnly?: boolean;
}) {
  return (
    <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4">
      <div className="flex gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-sm font-semibold text-[var(--accent)]">
          {name
            .split(" ")
            .map((p) => p[0])
            .slice(0, 2)
            .join("")}
        </div>
        <div>
          <p className="font-semibold text-[var(--ink)]">{name}</p>
          <p className="text-sm text-[var(--muted)]">
            {title}
            {organization ? ` · ${organization}` : ""}
          </p>
          {sessionTitle ? (
            <p className="mt-1 text-xs text-[var(--accent)]">{sessionTitle}</p>
          ) : null}
          {publicOnly ? (
            <p className="mt-1 text-[10px] uppercase tracking-wide text-[var(--muted)]">
              Public profile
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
