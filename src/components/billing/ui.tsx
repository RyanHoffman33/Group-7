import { formatCurrency } from "@/features/billing/aging";

export function StatCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "accent" | "warn" | "danger";
}) {
  const tones = {
    default: "border-[var(--line)]",
    accent: "border-[var(--accent)]/30 bg-[var(--accent-soft)]",
    warn: "border-[var(--warn)]/30 bg-[#fff7eb]",
    danger: "border-[var(--danger)]/25 bg-[#fdf2f2]",
  };

  return (
    <div className={`rounded-lg border bg-[var(--surface)] p-4 ${tones[tone]}`}>
      <p className="text-xs uppercase tracking-wider text-[var(--muted)]">
        {label}
      </p>
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
}: {
  children: React.ReactNode;
  tone?: "neutral" | "ok" | "warn" | "danger" | "accent";
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
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${map[tone]}`}
    >
      {children}
    </span>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
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
}: {
  title?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-[var(--line)] bg-[var(--surface)]">
      {(title || action) && (
        <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
          {title ? (
            <h3 className="text-sm font-semibold text-[var(--ink)]">{title}</h3>
          ) : (
            <span />
          )}
          {action}
        </div>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}
