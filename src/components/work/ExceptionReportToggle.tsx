"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ExceptionWizard,
  type ExceptionObligationOption,
  type ExceptionPartyOption,
} from "@/components/work/ExceptionWizard";
import { Panel } from "@/components/billing/ui";

export function EngagementHeaderWithException({
  title,
  description,
  contractId,
  obligations,
  parties,
  defaultOpen = false,
}: {
  title: string;
  description: string;
  contractId: string;
  obligations: ExceptionObligationOption[];
  parties: ExceptionPartyOption[];
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash === "#exceptions") setOpen(true);
  }, []);

  return (
    <div className="mb-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-3xl text-[var(--ink)]">
            {title}
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">
            {description}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className={
              open
                ? "rounded-md border border-[var(--warn)] bg-[#fff7eb] px-3 py-2 text-sm font-semibold text-[var(--warn)]"
                : "rounded-md border border-[var(--warn)]/40 bg-white px-3 py-2 text-sm font-semibold text-[var(--warn)] hover:bg-[#fff7eb]"
            }
            aria-expanded={open}
          >
            {open ? "Close exception form" : "Report exception"}
          </button>
          <Link
            href="/work"
            className="rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm font-semibold"
          >
            All events
          </Link>
        </div>
      </div>

      {open ? (
        <div id="exceptions" className="mt-4 scroll-mt-8">
          <Panel
            title="Report an exception"
            action={
              <Link
                href="/work/exceptions"
                className="text-xs font-medium text-[var(--accent)] hover:underline"
              >
                Open exceptions inbox
              </Link>
            }
          >
            <ExceptionWizard
              contractId={contractId}
              obligations={obligations}
              parties={parties}
            />
          </Panel>
        </div>
      ) : (
        <div id="exceptions" className="scroll-mt-8" />
      )}
    </div>
  );
}
