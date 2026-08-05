"use client";

import { QRCodeSVG } from "qrcode.react";
import { StatusPill } from "@/components/billing/ui";

export function QrPassCard({
  payload,
  title,
  subtitle,
  status,
  size = 160,
  eventName,
  venue,
  when,
  ticketType,
}: {
  payload: string;
  title: string;
  subtitle?: string;
  status?: string;
  size?: number;
  eventName?: string;
  venue?: string;
  when?: string;
  ticketType?: string;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)] shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
      <div className="bg-[var(--ink)] px-5 py-4 text-white">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/50">
          MainEvent pass
        </p>
        <p className="mt-1 font-[family-name:var(--font-display)] text-xl leading-tight">
          {eventName ?? "Event check-in"}
        </p>
        {when || venue ? (
          <p className="mt-1 text-xs text-white/65">
            {[when, venue].filter(Boolean).join(" · ")}
          </p>
        ) : null}
      </div>
      <div className="grid gap-4 p-5 sm:grid-cols-[1fr_auto] sm:items-center">
        <div>
          <p className="font-[family-name:var(--font-display)] text-2xl text-[var(--ink)]">
            {title}
          </p>
          {subtitle ? (
            <p className="mt-0.5 text-sm text-[var(--muted)]">{subtitle}</p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            {ticketType ? (
              <StatusPill tone="accent">{ticketType}</StatusPill>
            ) : null}
            {status ? <StatusPill tone="ok">{status}</StatusPill> : null}
          </div>
          <p className="mt-4 text-[11px] text-[var(--muted)]">
            Present this pass at check-in. Encodes internal IDs only — no personal
            data in the QR image.
          </p>
        </div>
        <div className="justify-self-center rounded-lg border border-[var(--line)] bg-white p-3">
          <QRCodeSVG value={payload} size={size} level="M" includeMargin />
        </div>
      </div>
      <div className="border-t border-dashed border-[var(--line)] bg-[var(--bg)] px-5 py-2">
        <p className="break-all text-center font-mono text-[10px] text-[var(--muted)]">
          {payload}
        </p>
      </div>
    </div>
  );
}
