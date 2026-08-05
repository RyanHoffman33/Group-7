import { formatCurrency } from "@/features/billing/aging";

export function StatCard({
  label,
  value,
  hint,
  tone = "default",
  icon,
  iconTone,
  compact = false,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "accent" | "warn" | "danger";
  icon?: React.ReactNode;
  /** Soft colored square behind the icon (Luma-style KPI). */
  iconTone?: "blue" | "green" | "orange" | "purple" | "teal";
  compact?: boolean;
}) {
  const tones = {
    default: "border-[var(--line)]",
    accent: "border-[var(--accent)]/30 bg-[var(--accent-soft)]",
    warn: "border-[var(--warn)]/30 bg-[#fff7eb]",
    danger: "border-[var(--danger)]/25 bg-[#fdf2f2]",
  };

  const iconTones = {
    blue: "bg-[#e8f0fe] text-[#3b6fd9]",
    green: "bg-[#e6f6ec] text-[#2f9a57]",
    orange: "bg-[#fff0e0] text-[#d97706]",
    purple: "bg-[#f0e9ff] text-[#7c5cbf]",
    teal: "bg-[var(--accent-soft)] text-[var(--accent)]",
  };

  const iconWrap = icon ? (
    iconTone ? (
      <span
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${iconTones[iconTone]}`}
        aria-hidden="true"
      >
        {icon}
      </span>
    ) : (
      <span className="shrink-0 text-[var(--muted)]" aria-hidden="true">
        {icon}
      </span>
    )
  ) : null;

  if (compact) {
    return (
      <div
        className={`rounded-lg border bg-[var(--surface)] px-3 py-2.5 shadow-[0_1px_2px_rgba(15,28,46,0.04)] ${tones[tone]}`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-[var(--muted)]">{label}</p>
            <p className="mt-0.5 font-[family-name:var(--font-display)] text-[1.4rem] leading-none text-[var(--ink)]">
              {value}
            </p>
            {hint ? (
              <p className="mt-1 text-[11px] leading-snug text-[var(--muted)]">
                {hint}
              </p>
            ) : null}
          </div>
          {iconWrap}
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-lg border bg-[var(--surface)] p-4 ${tones[tone]}`}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs uppercase tracking-wider text-[var(--muted)]">
          {label}
        </p>
        {iconWrap}
      </div>
      <p className="mt-2 font-[family-name:var(--font-display)] text-2xl text-[var(--ink)]">
        {value}
      </p>
      {hint ? (
        <p className="mt-1 text-xs text-[var(--muted)]">{hint}</p>
      ) : null}
    </div>
  );
}

export function Money({ amount }: { amount: number }) {
  return <span className="tabular-nums">{formatCurrency(amount)}</span>;
}

export function StatusPill({
  children,
  tone = "neutral",
  compact = false,
}: {
  children: React.ReactNode;
  tone?: "neutral" | "ok" | "warn" | "danger" | "accent";
  compact?: boolean;
}) {
  const map = {
    neutral: "bg-[#eef2f6] text-[var(--muted)]",
    ok: "bg-[#e8f6ee] text-[var(--ok)]",
    warn: "bg-[#fff4e5] text-[var(--warn)]",
    danger: "bg-[#fdecec] text-[var(--danger)]",
    accent: "bg-[var(--accent-soft)] text-[var(--accent)]",
  };
  return (
    <span
      className={`inline-flex font-medium ${map[tone]} ${
        compact
          ? "rounded px-1.5 py-0 text-[10px] leading-4"
          : "rounded-full px-2.5 py-0.5 text-xs"
      }`}
    >
      {children}
    </span>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  compact = false,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <div className="mb-0 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="font-[family-name:var(--font-display)] text-[1.5rem] leading-tight text-[var(--ink)]">
            {title}
          </h2>
          {description ? (
            <p className="mt-0.5 text-[12px] leading-snug text-[var(--muted)]">
              {description}
            </p>
          ) : null}
        </div>
        {actions}
      </div>
    );
  }

  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h2 className="font-[family-name:var(--font-display)] text-3xl text-[var(--ink)]">
          {title}
        </h2>
        {description ? (
          <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">
            {description}
          </p>
        ) : null}
      </div>
      {actions}
    </div>
  );
}

export function Panel({
  title,
  children,
  action,
  compact = false,
  className = "",
  bodyClassName = "",
}: {
  title?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  compact?: boolean;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      className={`flex min-h-0 flex-col rounded-md border border-[var(--line)] bg-[var(--surface)] ${className}`}
    >
      {(title || action) && (
        <div
          className={`flex shrink-0 items-center justify-between border-b border-[var(--line)] ${
            compact ? "px-3 py-1.5" : "px-4 py-3"
          }`}
        >
          {title ? (
            <h3
              className={`font-semibold text-[var(--ink)] ${
                compact ? "text-[13px]" : "text-sm"
              }`}
            >
              {title}
            </h3>
          ) : (
            <span />
          )}
          {action}
        </div>
      )}
      <div
        className={`min-h-0 flex-1 ${compact ? "p-3" : "p-4"} ${bodyClassName}`}
      >
        {children}
      </div>
    </section>
  );
}
