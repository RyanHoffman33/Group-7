import Link from "next/link";
import { formatCurrency } from "@/features/billing/aging";
import {
  getAccountingDashboardData,
  type AccountingAgingBucket,
  type AccountingAttentionIssue,
} from "@/features/dashboard/accounting-queries";
import { Money, PageHeader, Panel } from "@/components/billing/ui";

export const dynamic = "force-dynamic";

const AGING_COLORS: Record<AccountingAgingBucket["key"], string> = {
  "0-30": "#2f9a57",
  "31-60": "#f0a202",
  "61-90": "#e07a2f",
  "90+": "#e11d48",
};

function ViewLink({ href, label = "View all" }: { href: string; label?: string }) {
  return (
    <Link
      href={href}
      className="text-[12px] font-medium text-[var(--accent)] hover:underline"
    >
      {label}
    </Link>
  );
}

function shortDay(dateStr: string): string {
  const d = new Date(dateStr.includes("T") ? dateStr : `${dateStr}T00:00:00`);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function statusClass(issue: AccountingAttentionIssue): string {
  if (issue === "Overdue" || issue === "Disputed") return "text-[#e11d48] font-semibold";
  if (issue === "Due soon" || issue === "Partially paid") return "text-[#d97706] font-semibold";
  return "text-[#2563eb] font-semibold";
}

function statusLabel(issue: AccountingAttentionIssue): string {
  if (issue === "Due soon") return "Due Soon";
  if (issue === "Partially paid") return "Partial";
  if (issue === "Unallocated payment risk") return "Unallocated";
  return issue;
}

/** SVG donut from real aging amounts — no decorative fake values. */
function AgingDonut({
  buckets,
  total,
}: {
  buckets: AccountingAgingBucket[];
  total: number;
}) {
  const size = 132;
  const stroke = 22;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;

  if (total <= 0) {
    return (
      <div
        className="flex h-[132px] w-[132px] items-center justify-center rounded-full border-[22px] border-[#e8eef3]"
        aria-label="No outstanding A/R"
      />
    );
  }

  let offset = 0;
  const segments = buckets
    .filter((b) => b.amount > 0)
    .map((b) => {
      const len = (b.amount / total) * c;
      const seg = { key: b.key, color: AGING_COLORS[b.key], len, offset };
      offset += len;
      return seg;
    });

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="shrink-0"
      role="img"
      aria-label="A/R aging donut chart"
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="#e8eef3"
        strokeWidth={stroke}
      />
      {segments.map((s) => (
        <circle
          key={s.key}
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={s.color}
          strokeWidth={stroke}
          strokeDasharray={`${s.len} ${c - s.len}`}
          strokeDashoffset={-s.offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          strokeLinecap="butt"
        />
      ))}
    </svg>
  );
}

function IconBell() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <path d="M6 9a6 6 0 0 1 12 0c0 7 3 7 3 7H3s3 0 3-7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 18a2 2 0 0 0 4 0" strokeLinecap="round" />
    </svg>
  );
}

export default async function AccountingDashboardPage() {
  let data: Awaited<ReturnType<typeof getAccountingDashboardData>>;
  try {
    data = await getAccountingDashboardData();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return (
      <div className="rounded-md border border-[var(--danger)]/30 bg-[#fdf2f2] p-4">
        <h2 className="font-[family-name:var(--font-display)] text-xl text-[var(--ink)]">
          Accounting Dashboard
        </h2>
        <p className="mt-2 text-sm text-[var(--danger)]">
          Could not load accounting data: {message}
        </p>
      </div>
    );
  }

  const greetingName = data.accountantFirstName;
  const greeting = greetingName
    ? `Welcome back, ${greetingName}!`
    : "Here's what needs billing or collection attention.";

  const totalAging = data.aging.reduce((s, b) => s + b.amount, 0);
  const attentionPreview = data.attention.slice(0, 6);
  const openAlertHint = data.kpis.overdueCount;

  return (
    <div className="flex min-h-[calc(100dvh-4.25rem)] flex-col gap-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <PageHeader
          compact
          title="Accounting Dashboard"
          description={greeting}
        />
        <div className="flex items-center gap-3 pt-1">
          <Link
            href="/billing/alerts"
            className="relative inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--line)] bg-[var(--surface)] text-[var(--muted)] hover:bg-[#f7f9fb]"
            aria-label="Billing alerts"
            title="Billing alerts"
          >
            <IconBell />
            {openAlertHint > 0 ? (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#e11d48] px-1 text-[10px] font-bold text-white">
                {openAlertHint > 9 ? "9+" : openAlertHint}
              </span>
            ) : null}
          </Link>
          <Link
            href="/billing/aging"
            className="rounded-md border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-[12px] font-semibold text-[var(--ink)] hover:bg-[#f7f9fb]"
          >
            Aging detail
          </Link>
        </div>
      </div>

      {/* KPI strip — colored values like reference */}
      <div className="grid shrink-0 grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 shadow-[0_1px_2px_rgba(15,28,46,0.04)]">
          <p className="text-[12px] font-medium text-[var(--muted)]">Total A/R</p>
          <p className="mt-1 font-[family-name:var(--font-display)] text-[1.45rem] leading-none text-[var(--ink)]">
            {formatCurrency(data.kpis.totalAr)}
          </p>
          <p className="mt-1.5 text-[11px] text-[var(--muted)]">
            Outstanding net of applications
          </p>
        </div>
        <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 shadow-[0_1px_2px_rgba(15,28,46,0.04)]">
          <p className="text-[12px] font-medium text-[var(--muted)]">Overdue A/R</p>
          <p className="mt-1 font-[family-name:var(--font-display)] text-[1.45rem] leading-none text-[#e11d48]">
            {formatCurrency(data.kpis.overdueAr)}
          </p>
          <p className="mt-1.5 text-[11px] text-[#e11d48]">
            {data.kpis.overdueCount} invoice{data.kpis.overdueCount === 1 ? "" : "s"} past due
          </p>
        </div>
        <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 shadow-[0_1px_2px_rgba(15,28,46,0.04)]">
          <p className="text-[12px] font-medium text-[var(--muted)]">Payments Received</p>
          <p className="mt-1 font-[family-name:var(--font-display)] text-[1.45rem] leading-none text-[#2f9a57]">
            {formatCurrency(data.kpis.paymentsReceived)}
          </p>
          <p className="mt-1.5 text-[11px] text-[var(--muted)]">
            {data.kpis.paymentsPeriodLabel}
          </p>
        </div>
        <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 shadow-[0_1px_2px_rgba(15,28,46,0.04)]">
          <p className="text-[12px] font-medium text-[var(--muted)]">Upcoming Invoices</p>
          <p className="mt-1 font-[family-name:var(--font-display)] text-[1.45rem] leading-none text-[#2563eb]">
            {data.kpis.upcomingBillingSupported
              ? formatCurrency(data.kpis.upcomingBilling)
              : "—"}
          </p>
          <p className="mt-1.5 text-[11px] text-[var(--muted)]">
            {data.kpis.upcomingBillingPeriodLabel}
          </p>
        </div>
      </div>

      {/* Row: Attention table (~2/3) | Aging donut (~1/3) */}
      <div className="grid min-h-0 flex-[1.2] grid-cols-1 gap-2 lg:grid-cols-[1.7fr_1fr]">
        <Panel
          compact
          className="min-h-0"
          title="Invoices Requiring Attention"
          action={<ViewLink href="/billing/invoices" />}
          bodyClassName="overflow-x-auto px-0 py-0"
        >
          {attentionPreview.length === 0 ? (
            <p className="px-3 py-4 text-[13px] text-[var(--muted)]">
              No invoices currently need billing or collection action.
            </p>
          ) : (
            <table className="w-full min-w-[640px] text-left text-[12px]">
              <thead className="border-b border-[var(--line)] text-[10px] uppercase tracking-wider text-[var(--muted)]">
                <tr>
                  <th className="px-3 py-2 font-medium">Invoice #</th>
                  <th className="px-3 py-2 font-medium">Customer</th>
                  <th className="hidden px-3 py-2 font-medium md:table-cell">Event</th>
                  <th className="px-3 py-2 font-medium text-right">Amount</th>
                  <th className="px-3 py-2 font-medium">Due Date</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {attentionPreview.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-[var(--line)] last:border-0 hover:bg-[#f7f9fb]"
                  >
                    <td className="px-3 py-2">
                      <Link
                        href={row.href}
                        className="font-semibold text-[var(--accent)] hover:underline"
                      >
                        {row.invoiceNumber}
                      </Link>
                    </td>
                    <td className="max-w-[7.5rem] truncate px-3 py-2">{row.customerName}</td>
                    <td className="hidden max-w-[8rem] truncate px-3 py-2 text-[var(--muted)] md:table-cell">
                      {row.eventName}
                    </td>
                    <td className="px-3 py-2 text-right font-medium tabular-nums">
                      <Money amount={row.outstanding} />
                    </td>
                    <td
                      className={`whitespace-nowrap px-3 py-2 tabular-nums ${
                        row.issue === "Overdue" ? "font-semibold text-[#e11d48]" : ""
                      }`}
                    >
                      {shortDay(row.dueDate)}
                    </td>
                    <td className={`px-3 py-2 ${statusClass(row.issue)}`}>
                      {statusLabel(row.issue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>

        <Panel
          compact
          className="min-h-0"
          title="A/R Aging Summary"
          action={<ViewLink href="/billing/aging" label="View all" />}
          bodyClassName="flex flex-col justify-center px-3 py-3"
        >
          {totalAging <= 0 ? (
            <p className="text-[13px] text-[var(--muted)]">No outstanding A/R.</p>
          ) : (
            <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-center sm:gap-4">
              <AgingDonut buckets={data.aging} total={totalAging} />
              <ul className="w-full min-w-0 space-y-2">
                {data.aging.map((b) => (
                  <li
                    key={b.key}
                    className="flex items-center justify-between gap-2 text-[12px]"
                  >
                    <span className="inline-flex min-w-0 items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: AGING_COLORS[b.key] }}
                        aria-hidden="true"
                      />
                      <span className="truncate text-[var(--muted)]">
                        {b.key === "0-30"
                          ? "0-30 Days"
                          : b.key === "31-60"
                            ? "31-60 Days"
                            : b.key === "61-90"
                              ? "61-90 Days"
                              : "90+ Days"}
                      </span>
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums text-[var(--ink)]">
                      <Money amount={b.amount} />
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="mt-3 text-[10px] leading-snug text-[var(--muted)]">
            Due-date aging · open balances only
          </p>
        </Panel>
      </div>

      {/* Row: Revenue overview (~2/3) | Approvals counts (~1/3) */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 lg:grid-cols-[1.7fr_1fr]">
        <Panel
          compact
          className="min-h-0"
          title="Revenue Recognition Overview"
          action={<ViewLink href="/compliance" label="View report" />}
          bodyClassName="flex flex-col justify-center px-3 py-3"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <p className="text-[12px] font-medium text-[var(--muted)]">
                Recognized Revenue
              </p>
              <p className="mt-1 font-[family-name:var(--font-display)] text-[1.35rem] leading-none text-[#2f9a57]">
                {formatCurrency(data.revenue.recognizedRevenueBilled)}
              </p>
              <p className="mt-1.5 text-[11px] text-[var(--muted)]">Billed &amp; recognized</p>
            </div>
            <div>
              <p className="text-[12px] font-medium text-[var(--muted)]">
                Billed Not Yet Recognized
              </p>
              <p className="mt-1 font-[family-name:var(--font-display)] text-[1.35rem] leading-none text-[#2563eb]">
                {formatCurrency(data.revenue.billedNotYetRecognized)}
              </p>
              <p className="mt-1.5 text-[11px] text-[var(--muted)]">Deferred billed A/R</p>
            </div>
            <div>
              <p className="text-[12px] font-medium text-[var(--muted)]">
                Collected Not Yet Recognized
              </p>
              <p className="mt-1 font-[family-name:var(--font-display)] text-[1.35rem] leading-none text-[#7c5cbf]">
                {formatCurrency(data.revenue.customerDepositsUnearned)}
              </p>
              <p className="mt-1.5 text-[11px] text-[var(--muted)]">Deposits / Retainers</p>
            </div>
          </div>
        </Panel>

        <Panel
          compact
          className="min-h-0"
          title="Approvals & Exceptions"
          action={<ViewLink href="/compliance/modifications" />}
          bodyClassName="px-3 py-1"
        >
          {data.exceptionGroups.length === 0 ? (
            <p className="py-3 text-[13px] text-[var(--muted)]">
              No accounting exceptions needing review.
            </p>
          ) : (
            <ul>
              {data.exceptionGroups.map((g) => (
                <li
                  key={g.id}
                  className="flex items-center justify-between gap-3 border-b border-[var(--line)] py-2.5 last:border-0"
                >
                  <Link
                    href={g.href}
                    className="min-w-0 truncate text-[13px] font-medium text-[var(--ink)] hover:text-[var(--accent)]"
                  >
                    {g.label}
                  </Link>
                  <span className="shrink-0 text-[15px] font-bold tabular-nums text-[var(--ink)]">
                    {g.count}
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
