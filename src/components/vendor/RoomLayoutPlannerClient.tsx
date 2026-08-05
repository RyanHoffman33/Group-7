"use client";

import { useMemo, useState, useTransition } from "react";
import { AlertCard } from "@/components/dashboard";
import { StatusPill } from "@/components/billing/ui";
import {
  addLayoutObject,
  saveLayoutVersion,
  setLayoutApproval,
} from "@/features/events/actions";
import type {
  LayoutObjectType,
  RoomLayout,
  RoomLayoutItem,
  RoomLayoutVersion,
} from "@/features/events/types";

const PALETTE: { type: LayoutObjectType; label: string }[] = [
  { type: "round_table", label: "Round table" },
  { type: "rect_table", label: "Rect table" },
  { type: "chair", label: "Chair" },
  { type: "stage", label: "Stage" },
  { type: "podium", label: "Podium" },
  { type: "screen", label: "Screen" },
  { type: "speaker", label: "Speaker" },
  { type: "dance_floor", label: "Dance floor" },
  { type: "registration_desk", label: "Reg desk" },
  { type: "catering", label: "Catering" },
  { type: "bar", label: "Bar" },
  { type: "booth", label: "Booth" },
  { type: "entrance", label: "Entrance" },
  { type: "exit", label: "Exit" },
  { type: "restroom", label: "Restroom" },
  { type: "av_control", label: "AV control" },
];

const COLORS: Partial<Record<LayoutObjectType, string>> = {
  stage: "#1e293b",
  screen: "#0f766e",
  podium: "#334155",
  round_table: "#0b6e6e",
  rect_table: "#0369a1",
  dance_floor: "#7c3aed",
  bar: "#9a5b00",
  entrance: "#15803d",
  exit: "#b91c1c",
  av_control: "#5b21b6",
  registration_desk: "#1d4ed8",
};

export function RoomLayoutPlannerClient({
  layout,
  versions,
  current,
  actor,
  canApprove,
  canEdit,
}: {
  layout: RoomLayout;
  versions: RoomLayoutVersion[];
  current: RoomLayoutVersion;
  actor: string;
  canApprove: boolean;
  canEdit: boolean;
}) {
  const [items, setItems] = useState<RoomLayoutItem[]>(current.items);
  const [capacity, setCapacity] = useState(current.seatingCapacity);
  const [notes, setNotes] = useState(current.notes);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const overCapacity = capacity > layout.capacity;
  const locked = current.status === "locked";
  const readOnly = !canEdit || locked;

  const selected = useMemo(
    () => items.find((i) => i.id === selectedId),
    [items, selectedId],
  );

  function onCanvasPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragId || readOnly) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left - 25, rect.width - 40));
    const y = Math.max(0, Math.min(e.clientY - rect.top - 20, rect.height - 30));
    setItems((prev) =>
      prev.map((it) => (it.id === dragId ? { ...it, x, y } : it)),
    );
  }

  return (
    <div className="space-y-4">
      {message ? <AlertCard tone="ok" title="Updated" body={message} /> : null}
      {error ? <AlertCard tone="danger" title="Error" body={error} /> : null}
      {overCapacity ? (
        <AlertCard
          tone="warn"
          title="Capacity warning"
          body={`Seating capacity (${capacity}) exceeds room capacity (${layout.capacity}).`}
        />
      ) : null}

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <StatusPill tone="accent">{layout.layoutType}</StatusPill>
        <StatusPill
          tone={
            current.status === "approved"
              ? "ok"
              : current.status === "pending_approval"
                ? "warn"
                : current.status === "rejected"
                  ? "danger"
                  : "neutral"
          }
        >
          v{current.version} · {current.status.replace("_", " ")}
        </StatusPill>
        <span className="text-[var(--muted)]">
          {layout.roomName} · {layout.widthFt}&apos; × {layout.heightFt}&apos;
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[180px_1fr_240px]">
        <aside className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-3">
          <p className="text-xs font-semibold uppercase text-[var(--muted)]">
            Objects
          </p>
          <ul className="mt-2 space-y-1">
            {PALETTE.map((p) => (
              <li key={p.type}>
                <button
                  type="button"
                  disabled={readOnly || pending}
                  className="w-full rounded-md border border-[var(--line)] px-2 py-1.5 text-left text-xs disabled:opacity-40"
                  onClick={() =>
                    start(async () => {
                      const res = await addLayoutObject(
                        layout.id,
                        p.type,
                        actor,
                      );
                      if (res.ok) {
                        setMessage(res.message);
                        setItems((prev) => [
                          ...prev,
                          {
                            id: `li-local-${Date.now()}`,
                            type: p.type,
                            label: p.label,
                            x: 100,
                            y: 100,
                            w: 50,
                            h: 40,
                            rotation: 0,
                          },
                        ]);
                      } else setError(res.error);
                    })
                  }
                >
                  + {p.label}
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <div
          className="relative h-[420px] overflow-hidden rounded-lg border border-[var(--line)] bg-[#f8fafc]"
          style={{
            backgroundImage:
              "linear-gradient(#e2e8f0 1px, transparent 1px), linear-gradient(90deg, #e2e8f0 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
          onPointerMove={onCanvasPointerMove}
          onPointerUp={() => setDragId(null)}
          onPointerLeave={() => setDragId(null)}
        >
          {items.map((it) => (
            <button
              key={it.id}
              type="button"
              className={`absolute flex items-center justify-center rounded border text-[10px] font-semibold text-white ${
                selectedId === it.id ? "ring-2 ring-[var(--accent)]" : ""
              }`}
              style={{
                left: it.x,
                top: it.y,
                width: it.w,
                height: it.h,
                background: COLORS[it.type] ?? "#475569",
                transform: `rotate(${it.rotation}deg)`,
              }}
              onPointerDown={(e) => {
                e.preventDefault();
                setSelectedId(it.id);
                if (!readOnly) setDragId(it.id);
              }}
            >
              {it.label}
            </button>
          ))}
        </div>

        <aside className="space-y-3 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-3">
          <p className="text-xs font-semibold uppercase text-[var(--muted)]">
            Properties
          </p>
          {selected ? (
            <div className="space-y-2 text-sm">
              <p className="font-medium">{selected.label}</p>
              <p className="text-xs text-[var(--muted)]">{selected.type}</p>
              {!readOnly ? (
                <button
                  type="button"
                  className="rounded-md border border-[var(--danger)] px-2 py-1 text-xs text-[var(--danger)]"
                  onClick={() =>
                    setItems((prev) => prev.filter((i) => i.id !== selected.id))
                  }
                >
                  Remove
                </button>
              ) : null}
            </div>
          ) : (
            <p className="text-xs text-[var(--muted)]">Select an object</p>
          )}
          <label className="block text-xs">
            Seating capacity
            <input
              type="number"
              disabled={readOnly}
              className="mt-1 w-full rounded-md border border-[var(--line)] px-2 py-1.5 text-sm"
              value={capacity}
              onChange={(e) => setCapacity(Number(e.target.value))}
            />
          </label>
          <label className="block text-xs">
            Notes
            <textarea
              disabled={readOnly}
              className="mt-1 w-full rounded-md border border-[var(--line)] px-2 py-1.5 text-sm"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
          {canEdit && !locked ? (
            <div className="flex flex-col gap-2">
              <button
                type="button"
                disabled={pending}
                className="rounded-md border border-[var(--line)] px-3 py-1.5 text-xs font-semibold"
                onClick={() =>
                  start(async () => {
                    const res = await saveLayoutVersion({
                      layoutId: layout.id,
                      items,
                      seatingCapacity: capacity,
                      notes,
                      actor,
                    });
                    if (res.ok) setMessage(res.message);
                    else setError(res.error);
                  })
                }
              >
                Save draft
              </button>
              <button
                type="button"
                disabled={pending}
                className="rounded-md bg-[var(--ink)] px-3 py-1.5 text-xs font-semibold text-white"
                onClick={() =>
                  start(async () => {
                    const res = await saveLayoutVersion({
                      layoutId: layout.id,
                      items,
                      seatingCapacity: capacity,
                      notes,
                      actor,
                      submitForApproval: true,
                    });
                    if (res.ok) setMessage(res.message);
                    else setError(res.error);
                  })
                }
              >
                Submit for approval
              </button>
            </div>
          ) : null}
          {canApprove && current.status === "pending_approval" ? (
            <div className="flex gap-2">
              <button
                type="button"
                disabled={pending}
                className="rounded-md bg-[var(--ink)] px-3 py-1.5 text-xs font-semibold text-white"
                onClick={() =>
                  start(async () => {
                    const res = await setLayoutApproval(
                      current.id,
                      "approved",
                      actor,
                    );
                    if (res.ok) setMessage(res.message);
                    else setError(res.error);
                  })
                }
              >
                Approve
              </button>
              <button
                type="button"
                disabled={pending}
                className="rounded-md border border-[var(--line)] px-3 py-1.5 text-xs font-semibold"
                onClick={() =>
                  start(async () => {
                    const res = await setLayoutApproval(
                      current.id,
                      "rejected",
                      actor,
                    );
                    if (res.ok) setMessage(res.message);
                    else setError(res.error);
                  })
                }
              >
                Reject
              </button>
            </div>
          ) : null}
        </aside>
      </div>

      <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-3">
        <p className="text-xs font-semibold uppercase text-[var(--muted)]">
          Version history
        </p>
        <ul className="mt-2 space-y-1 text-sm">
          {versions.map((v) => (
            <li key={v.id} className="flex flex-wrap justify-between gap-2">
              <span>
                v{v.version} · {v.status.replace("_", " ")} · {v.updatedBy}
              </span>
              <span className="text-xs text-[var(--muted)]">
                {new Date(v.updatedAt).toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
