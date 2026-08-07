"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "draft", label: "Draft" },
  { value: "issued", label: "Issued" },
  { value: "unpaid", label: "Unpaid" },
  { value: "partially_paid", label: "Partially paid" },
  { value: "paid", label: "Paid" },
  { value: "disputed", label: "Disputed" },
  { value: "void", label: "Void" },
  { value: "canceled", label: "Canceled" },
] as const;

const RECOG_OPTIONS = [
  { value: "all", label: "All recognition" },
  { value: "deferred", label: "Deferred" },
  { value: "recognized", label: "Recognized" },
] as const;

type Option = { id: string; label: string };

export function InvoiceFilters({
  customers,
  contracts,
}: {
  customers: Option[];
  contracts: Option[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (!value || value === "all") next.delete(key);
    else next.set(key, value);
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  function clearAll() {
    router.push(pathname);
  }

  const selectClass =
    "min-w-[10rem] rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm text-[var(--ink)]";

  const hasFilter =
    params.has("status") ||
    params.has("customer_id") ||
    params.has("contract_id") ||
    params.has("recognition") ||
    params.has("q");

  return (
    <div className="mb-4 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-[var(--ink)]">Filter invoices</p>
        {hasFilter ? (
          <button
            type="button"
            onClick={clearAll}
            className="rounded-md border border-[var(--line)] px-3 py-1.5 text-xs font-semibold hover:bg-[#f7f9fb]"
          >
            Clear all filters
          </button>
        ) : null}
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="space-y-1 text-xs text-[var(--muted)]">
          <span className="block">Status</span>
          <select
            className={selectClass}
            value={params.get("status") ?? "all"}
            onChange={(e) => setParam("status", e.target.value)}
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-xs text-[var(--muted)]">
          <span className="block">Customer</span>
          <select
            className={`${selectClass} min-w-[12rem]`}
            value={params.get("customer_id") ?? "all"}
            onChange={(e) => setParam("customer_id", e.target.value)}
          >
            <option value="all">All customers</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-xs text-[var(--muted)]">
          <span className="block">Contract</span>
          <select
            className={`${selectClass} min-w-[14rem]`}
            value={params.get("contract_id") ?? "all"}
            onChange={(e) => setParam("contract_id", e.target.value)}
          >
            <option value="all">All contracts</option>
            {contracts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-xs text-[var(--muted)]">
          <span className="block">Recognition</span>
          <select
            className={selectClass}
            value={params.get("recognition") ?? "all"}
            onChange={(e) => setParam("recognition", e.target.value)}
          >
            {RECOG_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-[12rem] flex-1 space-y-1 text-xs text-[var(--muted)]">
          <span className="block">Search</span>
          <input
            type="search"
            className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm text-[var(--ink)]"
            placeholder="Invoice #…"
            defaultValue={params.get("q") ?? ""}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                setParam("q", (e.target as HTMLInputElement).value.trim());
              }
            }}
            onBlur={(e) => {
              const v = e.target.value.trim();
              const current = params.get("q") ?? "";
              if (v !== current) setParam("q", v);
            }}
          />
        </label>
      </div>
    </div>
  );
}
