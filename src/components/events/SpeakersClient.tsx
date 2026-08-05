"use client";

import { useTransition, useState } from "react";
import { AlertCard, ProgressBar, SpeakerCard } from "@/components/dashboard";
import { Panel, StatusPill } from "@/components/billing/ui";
import { toggleSpeakerRequirement } from "@/features/events/actions";
import type { Speaker } from "@/features/events/types";
import { speakerReadiness } from "@/features/events/types";

export function SpeakersClient({
  speakers,
  isStaff,
}: {
  speakers: Speaker[];
  isStaff: boolean;
}) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const visible = speakers.filter((s) =>
    isStaff ? true : s.publicVisible && s.status !== "Canceled",
  );

  return (
    <div className="space-y-4">
      {message ? <AlertCard tone="ok" title="Updated" body={message} /> : null}
      {speakers.some(
        (s) => s.materialsStatus !== "complete" && s.status !== "Canceled",
      ) ? (
        <AlertCard
          tone="warn"
          title="Materials pending"
          body="At least one speaker is missing presentation materials or checklist items."
        />
      ) : null}
      <div className="grid gap-4 md:grid-cols-2">
        {visible.map((s) => {
          const ready = speakerReadiness(s);
          return (
            <div key={s.id} className="space-y-2">
              <SpeakerCard
                name={s.name}
                title={s.title}
                organization={s.organization}
                publicOnly={!isStaff}
              />
              {isStaff ? (
                <Panel>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <StatusPill tone="accent">{s.status}</StatusPill>
                    <StatusPill
                      tone={
                        ready.pct === 100
                          ? "ok"
                          : ready.pct >= 50
                            ? "warn"
                            : "danger"
                      }
                    >
                      {ready.pct}% ready
                    </StatusPill>
                  </div>
                  <div className="mt-3">
                    <ProgressBar value={ready.pct} label="Readiness" />
                  </div>
                  <p className="mt-2 text-sm text-[var(--muted)]">
                    {s.bio || "No bio"}
                  </p>
                  <dl className="mt-2 grid gap-1 text-xs text-[var(--muted)] sm:grid-cols-2">
                    <div>Session: {s.sessionTitle ?? "—"}</div>
                    <div>Room: {s.room ?? "—"}</div>
                    <div>Arrival: {s.arrivalTime ?? "—"}</div>
                    <div>Green room: {s.greenRoom ?? "—"}</div>
                    <div>AV: {s.avRequirements ?? "—"}</div>
                    <div>Support: {s.supportContact ?? "—"}</div>
                  </dl>
                  <p className="mt-2 text-xs text-[var(--danger)]">
                    Private contact: {s.privateEmail ?? "—"}
                  </p>
                  {s.status !== "Canceled" ? (
                    <ul className="mt-3 space-y-1">
                      {s.requirements.map((r) => (
                        <li key={r.key}>
                          <label className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={r.done}
                              disabled={pending}
                              onChange={() =>
                                start(async () => {
                                  const res = await toggleSpeakerRequirement(
                                    s.id,
                                    r.key,
                                  );
                                  if (res.ok) setMessage(res.message);
                                })
                              }
                            />
                            <span
                              className={
                                r.done ? "text-[var(--muted)] line-through" : ""
                              }
                            >
                              {r.label}
                            </span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {ready.missing.length && s.status !== "Canceled" ? (
                    <p className="mt-2 text-xs text-[var(--warn,#9a5b00)]">
                      Missing: {ready.missing.join(", ")}
                    </p>
                  ) : null}
                </Panel>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
