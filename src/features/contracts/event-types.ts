export interface EventTypeOption {
  value: string;
  label: string;
}

const DEFAULT_EVENT_TYPES: EventTypeOption[] = [
  { value: "corporate_conference", label: "Corporate conference" },
  { value: "product_launch", label: "Product launch" },
  { value: "wedding", label: "Wedding" },
  { value: "gala", label: "Gala" },
  { value: "fundraiser", label: "Fundraiser" },
  { value: "holiday_party", label: "Holiday party" },
  { value: "trade_show", label: "Trade show" },
  { value: "concert", label: "Concert" },
  { value: "celebration", label: "Celebration" },
  { value: "corporate_event", label: "Corporate event" },
];

/** Mutable catalog shared by create-contract + intake (in-memory). */
export const eventTypeCatalog: EventTypeOption[] = [...DEFAULT_EVENT_TYPES];

export function listEventTypes(): EventTypeOption[] {
  return [...eventTypeCatalog];
}

export function slugifyEventType(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 48);
}

export function addEventType(label: string): {
  ok: true;
  option: EventTypeOption;
} | { ok: false; error: string } {
  const trimmed = label.trim();
  if (!trimmed) return { ok: false, error: "Event type name is required." };
  const value = slugifyEventType(trimmed);
  if (!value) return { ok: false, error: "Enter a valid event type name." };
  const existing = eventTypeCatalog.find(
    (t) => t.value === value || t.label.toLowerCase() === trimmed.toLowerCase(),
  );
  if (existing) return { ok: true, option: existing };
  const option = { value, label: trimmed };
  eventTypeCatalog.push(option);
  return { ok: true, option };
}
