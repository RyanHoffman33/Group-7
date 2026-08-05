"use client";

import { useState } from "react";
import type { CustomerInvoiceStatus } from "@/features/dashboard/customer-sample";

export function invoiceTone(
  status: CustomerInvoiceStatus,
): "ok" | "warn" | "danger" | "neutral" {
  if (status === "paid") return "ok";
  if (status === "overdue" || status === "disputed") return "danger";
  if (status === "partially_paid" || status === "unpaid") return "warn";
  return "neutral";
}

export function invoiceLabel(status: CustomerInvoiceStatus): string {
  if (status === "partially_paid") return "Partial";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function ModalShell({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div
        className={`max-h-[90dvh] w-full overflow-y-auto rounded-lg border border-[var(--line)] bg-white shadow-xl ${
          wide ? "max-w-2xl" : "max-w-lg"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-[var(--line)] bg-white px-4 py-3">
          <h2 className="font-[family-name:var(--font-display)] text-lg text-[var(--ink)]">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-sm text-[var(--muted)] hover:bg-[#f7f9fb]"
          >
            Close
          </button>
        </div>
        <div className="px-4 py-4">{children}</div>
      </div>
    </div>
  );
}

export function PayMethodPicker({
  method,
  setMethod,
}: {
  method: "ACH" | "Wire" | "Card";
  setMethod: (m: "ACH" | "Wire" | "Card") => void;
}) {
  return (
    <fieldset>
      <legend className="text-sm font-medium">Payment method</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {(["ACH", "Wire", "Card"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMethod(m)}
            className={`rounded-md px-3 py-2 text-sm font-medium ${
              method === m
                ? "bg-[var(--ink)] text-white"
                : "border border-[var(--line)] hover:bg-[#f7f9fb]"
            }`}
          >
            {m}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function usePayMethod() {
  return useState<"ACH" | "Wire" | "Card">("ACH");
}
