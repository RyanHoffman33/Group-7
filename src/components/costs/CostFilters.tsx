"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  COST_CATEGORIES,
  categoryLabel,
} from "@/features/costs/config";

export function CostFilters() {
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
    "rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm text-[var(--ink)]";

  return (
    <div className="flex flex-wrap gap-3">
      <label className="space-y-1 text-xs text-[var(--muted)]">
        <span className="block">Category</span>
        <select
          className={selectClass}
          value={params.get("category") ?? ""}
          onChange={(e) => update("category", e.target.value)}
        >
          <option value="">All 5.4 types</option>
          {COST_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {categoryLabel(c)}
            </option>
          ))}
        </select>
      </label>
      <label className="space-y-1 text-xs text-[var(--muted)]">
        <span className="block">Status</span>
        <select
          className={selectClass}
          value={params.get("status") ?? ""}
          onChange={(e) => update("status", e.target.value)}
        >
          <option value="">All</option>
          <option value="committed">Committed</option>
          <option value="actual">Actual</option>
        </select>
      </label>
      <label className="space-y-1 text-xs text-[var(--muted)]">
        <span className="block">Flags</span>
        <select
          className={selectClass}
          value={params.get("flagged") ?? ""}
          onChange={(e) => update("flagged", e.target.value)}
        >
          <option value="">All</option>
          <option value="1">Flagged only</option>
        </select>
      </label>
    </div>
  );
}
