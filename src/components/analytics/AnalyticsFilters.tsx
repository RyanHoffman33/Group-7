"use client";

import type { AnalyticsPeriodFilter } from "@/features/analytics/filter";

const MONTHS = [
  { value: "1", label: "Jan" },
  { value: "2", label: "Feb" },
  { value: "3", label: "Mar" },
  { value: "4", label: "Apr" },
  { value: "5", label: "May" },
  { value: "6", label: "Jun" },
  { value: "7", label: "Jul" },
  { value: "8", label: "Aug" },
  { value: "9", label: "Sep" },
  { value: "10", label: "Oct" },
  { value: "11", label: "Nov" },
  { value: "12", label: "Dec" },
];

const selectClass =
  "rounded-md border border-[var(--line)] bg-white px-2.5 py-1.5 text-sm text-[var(--ink)]";

export function AnalyticsFilters({
  years,
  value,
  onChange,
}: {
  years: number[];
  value: AnalyticsPeriodFilter;
  onChange: (next: AnalyticsPeriodFilter) => void;
}) {
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-3">
      <label className="text-xs font-medium text-[var(--muted)]">
        Year
        <select
          className={`mt-1 block ${selectClass}`}
          value={value.year}
          onChange={(e) =>
            onChange({
              ...value,
              year: e.target.value,
              // Reset month/quarter when year changes to avoid empty sets
              ...(e.target.value === "all"
                ? { quarter: "all", month: "all" }
                : {}),
            })
          }
        >
          <option value="all">All years</option>
          {years.map((y) => (
            <option key={y} value={String(y)}>
              {y}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs font-medium text-[var(--muted)]">
        Quarter
        <select
          className={`mt-1 block ${selectClass}`}
          value={value.quarter}
          onChange={(e) =>
            onChange({
              ...value,
              quarter: e.target.value,
              month: e.target.value === "all" ? value.month : "all",
            })
          }
        >
          <option value="all">All quarters</option>
          <option value="1">Q1 (Jan–Mar)</option>
          <option value="2">Q2 (Apr–Jun)</option>
          <option value="3">Q3 (Jul–Sep)</option>
          <option value="4">Q4 (Oct–Dec)</option>
        </select>
      </label>
      <label className="text-xs font-medium text-[var(--muted)]">
        Month
        <select
          className={`mt-1 block ${selectClass}`}
          value={value.month}
          onChange={(e) =>
            onChange({
              ...value,
              month: e.target.value,
              quarter: e.target.value === "all" ? value.quarter : "all",
            })
          }
        >
          <option value="all">All months</option>
          {MONTHS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </label>
      {(value.year !== "all" ||
        value.quarter !== "all" ||
        value.month !== "all") && (
        <button
          type="button"
          className="rounded-md border border-[var(--line)] px-3 py-1.5 text-xs font-semibold hover:bg-[#f7f9fb]"
          onClick={() => onChange({ year: "all", quarter: "all", month: "all" })}
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
