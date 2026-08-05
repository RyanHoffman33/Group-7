"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Money, StatusPill } from "@/components/billing/ui";
import type { EventProfit } from "@/features/profitability/queries";
import { formatPct, statusTone } from "@/features/profitability/labels";

type SortKey = "gross_margin_pct" | "gross_margin" | "recognized_revenue";

const headers: { key: SortKey; label: string }[] = [
  { key: "recognized_revenue", label: "Recognized" },
  { key: "gross_margin", label: "Gross margin" },
  { key: "gross_margin_pct", label: "Margin %" },
];

export function MarginTable({ rows }: { rows: EventProfit[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("gross_margin_pct");
  const [desc, setDesc] = useState(true);

  const sorted = useMemo(() => {
    const dir = desc ? -1 : 1;
    return [...rows].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      // Events with no recognized revenue (null margin %) always sort last
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      return (av - bv) * dir;
    });
  }, [rows, sortKey, desc]);

  function onSort(key: SortKey) {
    if (key === sortKey) setDesc((d) => !d);
    else {
      setSortKey(key);
      setDesc(true);
    }
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[820px] text-left text-sm">
        <thead className="text-xs uppercase tracking-wider text-[var(--muted)]">
          <tr className="border-b border-[var(--line)]">
            <th className="pb-2 font-medium">Event</th>
            <th className="pb-2 font-medium">Status</th>
            {headers.map((h) => (
              <th key={h.key} className="pb-2 font-medium">
                <button
                  type="button"
                  onClick={() => onSort(h.key)}
                  className={`inline-flex items-center gap-1 uppercase tracking-wider hover:text-[var(--ink)] ${
                    sortKey === h.key ? "text-[var(--ink)]" : ""
                  }`}
                >
                  {h.label}
                  {sortKey === h.key ? (desc ? "↓" : "↑") : null}
                </button>
              </th>
            ))}
            <th className="pb-2 font-medium">Budget left</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr
              key={r.contract_id}
              className="border-b border-[var(--line)] last:border-0"
            >
              <td className="py-3">
                <Link
                  href={`/profitability/${r.contract_id}`}
                  className="font-medium text-[var(--accent)] hover:underline"
                >
                  {r.event_name}
                </Link>
                <div className="text-xs text-[var(--muted)]">
                  {r.customer_name}
                </div>
              </td>
              <td className="py-3">
                <StatusPill tone={statusTone[r.status] ?? "neutral"}>
                  {r.status.replaceAll("_", " ")}
                </StatusPill>
              </td>
              <td className="py-3">
                <Money amount={r.recognized_revenue} />
              </td>
              <td
                className={`py-3 ${r.gross_margin < 0 ? "text-[var(--danger)]" : ""}`}
              >
                <Money amount={r.gross_margin} />
              </td>
              <td className="py-3 tabular-nums">
                {formatPct(r.gross_margin_pct)}
              </td>
              <td
                className={`py-3 ${r.budget_remaining < 0 ? "text-[var(--danger)]" : ""}`}
              >
                <Money amount={r.budget_remaining} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
