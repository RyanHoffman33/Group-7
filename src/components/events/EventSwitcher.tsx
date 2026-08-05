"use client";

import { usePathname, useRouter } from "next/navigation";

type EventOption = {
  id: string;
  name: string;
  customerName: string;
  status: string;
};

export function EventSwitcher({
  events,
  currentId,
}: {
  events: EventOption[];
  currentId: string;
}) {
  const pathname = usePathname();
  const router = useRouter();

  function onChange(nextId: string) {
    if (nextId === currentId) return;
    // Keep the same hub section when switching events: /events/:id/... → /events/:nextId/...
    const suffix = pathname.replace(/^\/events\/[^/]+/, "") || "";
    router.push(`/events/${nextId}${suffix}`);
  }

  return (
    <label className="block max-w-xl">
      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
        Select event
      </span>
      <select
        value={currentId}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2.5 text-sm font-medium text-[var(--ink)] outline-none ring-[var(--accent)] focus:ring-2"
        aria-label="Select event for Event Hub"
      >
        {events.map((e) => (
          <option key={e.id} value={e.id}>
            {e.name} · {e.customerName} ({e.status})
          </option>
        ))}
      </select>
    </label>
  );
}
