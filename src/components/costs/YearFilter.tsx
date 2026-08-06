"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

export function YearFilter({ years }: { years: number[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function update(value: string) {
    const next = new URLSearchParams(params.toString());
    if (!value || value === "all") next.delete("year");
    else next.set("year", value);
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  const selectClass =
    "rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm text-[var(--ink)]";

  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="space-y-1 text-xs text-[var(--muted)]">
        <span className="block">Filter by event year</span>
        <select
          className={selectClass}
          value={params.get("year") ?? "all"}
          onChange={(e) => update(e.target.value)}
        >
          <option value="all">All years</option>
          {years.map((y) => (
            <option key={y} value={String(y)}>
              {y}
            </option>
          ))}
        </select>
      </label>
      {(params.get("year") ?? "all") !== "all" ? (
        <button
          type="button"
          className="rounded-md border border-[var(--line)] px-3 py-1.5 text-xs font-semibold hover:bg-[#f7f9fb]"
          onClick={() => update("all")}
        >
          Clear year
        </button>
      ) : null}
    </div>
  );
}
