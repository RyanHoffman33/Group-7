"use client";

import { useMemo, useState } from "react";
import { StatusPill } from "@/components/billing/ui";
import type { CalendarCategory, CalendarItem } from "@/features/events/types";

type View = "month" | "week" | "day" | "agenda";

const CATEGORIES: CalendarCategory[] = [
  "event",
  "task",
  "session",
  "vendor",
  "setup",
  "teardown",
  "meeting",
  "email",
  "checkin",
  "milestone",
];

const CAT_COLOR: Record<CalendarCategory, string> = {
  event: "#0b6e6e",
  task: "#9a5b00",
  session: "#1d4ed8",
  vendor: "#7c3aed",
  setup: "#0f766e",
  teardown: "#64748b",
  meeting: "#0369a1",
  email: "#b45309",
  checkin: "#15803d",
  milestone: "#5b21b6",
};

function startOfWeek(d: Date) {
  const x = new Date(d);
  const day = x.getDay();
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function EventCalendarClient({ items }: { items: CalendarItem[] }) {
  const [view, setView] = useState<View>("week");
  const [cursor, setCursor] = useState(() => new Date("2026-08-22T12:00:00"));
  const [filters, setFilters] = useState<Set<CalendarCategory>>(
    () => new Set(CATEGORIES),
  );
  const [selectedId, setSelectedId] = useState<string | null>(items[0]?.id ?? null);

  const filtered = useMemo(
    () => items.filter((i) => filters.has(i.category)),
    [items, filters],
  );

  const selected = filtered.find((i) => i.id === selectedId) ?? filtered[0];

  function toggleCat(c: CalendarCategory) {
    setFilters((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });
  }

  function shift(delta: number) {
    setCursor((d) => {
      const n = new Date(d);
      if (view === "month") n.setMonth(n.getMonth() + delta);
      else if (view === "week") n.setDate(n.getDate() + delta * 7);
      else n.setDate(n.getDate() + delta);
      return n;
    });
  }

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = startOfWeek(cursor);
    d.setDate(d.getDate() + i);
    return d;
  });

  const monthCells = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const start = startOfWeek(first);
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [cursor]);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1">
            {(["month", "week", "day", "agenda"] as View[]).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold capitalize ${
                  view === v
                    ? "bg-[var(--ink)] text-white"
                    : "border border-[var(--line)] bg-white"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-md border border-[var(--line)] px-2 py-1 text-xs"
              onClick={() => shift(-1)}
            >
              ←
            </button>
            <p className="text-sm font-medium">
              {cursor.toLocaleDateString(undefined, {
                month: "long",
                year: "numeric",
                ...(view !== "month" ? { day: "numeric" } : {}),
              })}
            </p>
            <button
              type="button"
              className="rounded-md border border-[var(--line)] px-2 py-1 text-xs"
              onClick={() => shift(1)}
            >
              →
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-1">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => toggleCat(c)}
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                filters.has(c) ? "text-white" : "bg-[#eef2f6] text-[var(--muted)]"
              }`}
              style={filters.has(c) ? { background: CAT_COLOR[c] } : undefined}
            >
              {c}
            </button>
          ))}
        </div>

        {view === "agenda" ? (
          <ul className="space-y-2 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-3">
            {filtered.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  className="w-full rounded-md border border-[var(--line)] px-3 py-2 text-left text-sm hover:border-[var(--accent)]"
                >
                  <span
                    className="mr-2 inline-block h-2 w-2 rounded-full"
                    style={{ background: CAT_COLOR[item.category] }}
                  />
                  {new Date(item.startAt).toLocaleString()} — {item.title}
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        {view === "day" ? (
          <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-3">
            <p className="mb-2 text-xs uppercase text-[var(--muted)]">
              {cursor.toLocaleDateString(undefined, { weekday: "long" })}
            </p>
            <ul className="space-y-2">
              {filtered
                .filter((i) => sameDay(new Date(i.startAt), cursor))
                .map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(item.id)}
                      className="w-full rounded-md px-3 py-2 text-left text-sm text-white"
                      style={{ background: CAT_COLOR[item.category] }}
                    >
                      {new Date(item.startAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}{" "}
                      {item.title}
                    </button>
                  </li>
                ))}
            </ul>
          </div>
        ) : null}

        {view === "week" ? (
          <div className="grid grid-cols-7 gap-1 overflow-x-auto rounded-lg border border-[var(--line)] bg-[var(--surface)] p-2">
            {weekDays.map((d) => (
              <div key={d.toISOString()} className="min-w-[100px]">
                <p className="mb-1 text-center text-[10px] font-semibold uppercase text-[var(--muted)]">
                  {d.toLocaleDateString(undefined, {
                    weekday: "short",
                    day: "numeric",
                  })}
                </p>
                <ul className="space-y-1">
                  {filtered
                    .filter((i) => sameDay(new Date(i.startAt), d))
                    .map((item) => (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedId(item.id)}
                          className="w-full truncate rounded px-1 py-1 text-left text-[10px] text-white"
                          style={{ background: CAT_COLOR[item.category] }}
                        >
                          {item.title}
                        </button>
                      </li>
                    ))}
                </ul>
              </div>
            ))}
          </div>
        ) : null}

        {view === "month" ? (
          <div className="grid grid-cols-7 gap-1 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-2">
            {monthCells.map((d) => {
              const inMonth = d.getMonth() === cursor.getMonth();
              return (
                <button
                  key={d.toISOString()}
                  type="button"
                  onClick={() => {
                    setCursor(d);
                    setView("day");
                  }}
                  className={`min-h-[72px] rounded-md border p-1 text-left ${
                    inMonth
                      ? "border-[var(--line)] bg-white"
                      : "border-transparent bg-[var(--bg)] text-[var(--muted)]"
                  }`}
                >
                  <span className="text-[10px] font-semibold">{d.getDate()}</span>
                  <ul className="mt-1 space-y-0.5">
                    {filtered
                      .filter((i) => sameDay(new Date(i.startAt), d))
                      .slice(0, 2)
                      .map((item) => (
                        <li
                          key={item.id}
                          className="truncate rounded px-0.5 text-[9px] text-white"
                          style={{ background: CAT_COLOR[item.category] }}
                        >
                          {item.title}
                        </li>
                      ))}
                  </ul>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      <aside className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
          Detail
        </p>
        {selected ? (
          <div className="mt-3 space-y-2 text-sm">
            <p className="font-[family-name:var(--font-display)] text-xl">
              {selected.title}
            </p>
            <StatusPill tone="accent">{selected.category}</StatusPill>
            <p className="text-[var(--muted)]">
              {new Date(selected.startAt).toLocaleString()} –{" "}
              {new Date(selected.endAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
            <p>Location: {selected.location}</p>
            <p>Assignee: {selected.assignee}</p>
            <p>Status: {selected.status}</p>
            {selected.notes ? (
              <p className="text-[var(--danger)]">{selected.notes}</p>
            ) : null}
          </div>
        ) : (
          <p className="mt-3 text-sm text-[var(--muted)]">Select an item.</p>
        )}
      </aside>
    </div>
  );
}
