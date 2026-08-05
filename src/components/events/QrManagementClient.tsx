"use client";

import { useState, useTransition } from "react";
import { QrPassCard } from "@/components/dashboard/QrPassCard";
import { AlertCard } from "@/components/dashboard";
import { StatusPill } from "@/components/billing/ui";
import {
  checkInByPayload,
  deactivateQr,
  regenerateQr,
} from "@/features/events/actions";


export type QrRow = {
  id: string;
  registrationId: string;
  attendeeName: string;
  registrationType: string;
  registrationStatus: string;
  status: string;
  payload: string;
  checkIn?: { checkedInAt: string; checkedInBy: string };
};

function ActionButton({
  children,
  onClick,
  disabled,
  variant = "primary",
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  variant?: "primary" | "outline";
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-md px-3 py-1.5 text-xs font-semibold disabled:opacity-50 ${
        variant === "primary"
          ? "bg-[var(--ink)] text-white"
          : "border border-[var(--line)] bg-white text-[var(--ink)]"
      }`}
    >
      {children}
    </button>
  );
}

export function QrManagementClient({
  eventId,
  rows,
  actor,
  canManage,
  canCheckIn,
}: {
  eventId: string;
  rows: QrRow[];
  actor: string;
  canManage: boolean;
  canCheckIn: boolean;
}) {
  const [payload, setPayload] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [allowDup, setAllowDup] = useState(false);

  void eventId;

  function run(fn: () => Promise<{ ok: boolean; message?: string; error?: string }>) {
    start(async () => {
      setMessage(null);
      setError(null);
      const res = await fn();
      if (res.ok) setMessage(res.message ?? "Done");
      else setError(res.error ?? "Failed");
    });
  }

  return (
    <div className="space-y-6">
      {message ? <AlertCard tone="ok" title="Success" body={message} /> : null}
      {error ? <AlertCard tone="danger" title="Blocked" body={error} /> : null}

      {canCheckIn ? (
        <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4">
          <p className="font-semibold text-[var(--ink)]">Validate / check in</p>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Paste or scan payload (`eventId|attendeeId|registrationId`). Duplicate check-ins are blocked unless override is enabled.
          </p>
          <textarea
            value={payload}
            onChange={(e) => setPayload(e.target.value)}
            rows={2}
            className="mt-3 w-full rounded-md border border-[var(--line)] px-3 py-2 font-mono text-xs"
            placeholder="evt-ops-1|att-1|reg-1"
          />
          <label className="mt-2 flex items-center gap-2 text-sm text-[var(--muted)]">
            <input
              type="checkbox"
              checked={allowDup}
              onChange={(e) => setAllowDup(e.target.checked)}
            />
            Allow duplicate check-in (manager authorization)
          </label>
          <div className="mt-3">
            <ActionButton
              disabled={pending || !payload.trim()}
              onClick={() =>
                run(() => checkInByPayload(payload.trim(), actor, allowDup))
              }
            >
              {pending ? "Working…" : "Check in"}
            </ActionButton>
          </div>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-[var(--line)] bg-[var(--surface)]">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="border-b border-[var(--line)] text-xs uppercase text-[var(--muted)]">
            <tr>
              <th className="px-4 py-3">Attendee</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">QR status</th>
              <th className="px-4 py-3">Check-in</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--line)]">
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="px-4 py-3 font-medium">{row.attendeeName}</td>
                <td className="px-4 py-3">{row.registrationType}</td>
                <td className="px-4 py-3">
                  <StatusPill
                    tone={
                      row.status === "active"
                        ? "ok"
                        : row.status === "canceled"
                          ? "danger"
                          : "warn"
                    }
                  >
                    {row.status}
                  </StatusPill>
                </td>
                <td className="px-4 py-3 text-xs text-[var(--muted)]">
                  {row.checkIn
                    ? `${new Date(row.checkIn.checkedInAt).toLocaleString()} · ${row.checkIn.checkedInBy}`
                    : "—"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    {canCheckIn && row.status === "active" ? (
                      <ActionButton
                        variant="outline"
                        disabled={pending}
                        onClick={() => {
                          setPayload(row.payload);
                          run(() =>
                            checkInByPayload(row.payload, actor, allowDup),
                          );
                        }}
                      >
                        Check in
                      </ActionButton>
                    ) : null}
                    {canManage ? (
                      <>
                        <ActionButton
                          variant="outline"
                          disabled={pending || row.registrationStatus === "canceled"}
                          onClick={() =>
                            run(() => regenerateQr(row.registrationId, actor))
                          }
                        >
                          Regenerate
                        </ActionButton>
                        <ActionButton
                          variant="outline"
                          disabled={pending || row.status !== "active"}
                          onClick={() =>
                            run(() => deactivateQr(row.registrationId))
                          }
                        >
                          Deactivate
                        </ActionButton>
                      </>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rows.filter((r) => r.status === "active").slice(0, 1).map((r) => (
        <QrPassCard
          key={r.id}
          payload={r.payload}
          title={r.attendeeName}
          subtitle="Sample active pass"
          status={r.status}
          ticketType={r.registrationType}
          eventName="Check-in pass"
        />
      ))}
    </div>
  );
}
