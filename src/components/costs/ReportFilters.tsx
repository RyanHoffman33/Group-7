"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { categoryLabel, type CostCategory } from "@/features/costs/config";

export function ReportFilters({
  contracts,
  categories,
}: {
  contracts: { id: string; event_name: string }[];
  categories: CostCategory[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function update(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (!value) next.delete(key);
    else next.set(key, value);
    router.push(`${pathname}?${next.toString()}`);
  }

  const selectClass =
    "rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm";

  return (
    <div className="flex flex-wrap gap-3">
      <label className="space-y-1 text-xs text-[var(--muted)]">
        <span className="block">Event</span>
        <select
          className={selectClass}
          value={params.get("contractId") ?? ""}
          onChange={(e) => update("contractId", e.target.value)}
        >
          <option value="">All events</option>
          {contracts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.event_name}
            </option>
          ))}
        </select>
      </label>
      <label className="space-y-1 text-xs text-[var(--muted)]">
        <span className="block">Category</span>
        <select
          className={selectClass}
          value={params.get("category") ?? ""}
          onChange={(e) => update("category", e.target.value)}
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {categoryLabel(c)}
            </option>
          ))}
        </select>
      </label>
      <label className="space-y-1 text-xs text-[var(--muted)]">
        <span className="block">From</span>
        <input
          type="date"
          className={selectClass}
          value={params.get("from") ?? ""}
          onChange={(e) => update("from", e.target.value)}
        />
      </label>
      <label className="space-y-1 text-xs text-[var(--muted)]">
        <span className="block">To</span>
        <input
          type="date"
          className={selectClass}
          value={params.get("to") ?? ""}
          onChange={(e) => update("to", e.target.value)}
        />
      </label>
    </div>
  );
}
