"use client";

import { useState } from "react";
import { Panel } from "@/components/billing/ui";
import { useCustomerPortal } from "@/components/dashboard/CustomerPortalContext";
import { ModalShell } from "@/components/dashboard/customer-ui";
import type { CustomerDocument } from "@/features/dashboard/customer-sample";

export function CustomerDocumentsPage() {
  const { eventDocs } = useCustomerPortal();
  const [active, setActive] = useState<CustomerDocument | null>(null);

  return (
    <div className="flex flex-col gap-3">
      <Panel
        title="Documents"
        bodyClassName="px-0 py-0"
      >
        {eventDocs.length === 0 ? (
          <p className="px-4 py-4 text-sm text-[var(--muted)]">
            No documents for this event yet.
          </p>
        ) : (
          <ul>
            {eventDocs.map((d) => (
              <li
                key={d.id}
                className="flex items-center justify-between gap-3 border-b border-[var(--line)] px-4 py-3 last:border-0"
              >
                <div className="min-w-0">
                  <p className="font-medium text-[var(--ink)]">{d.name}</p>
                  <p className="text-[12px] text-[var(--muted)]">
                    {d.kind} · {d.summary}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActive(d)}
                  className="shrink-0 rounded-md border border-[var(--line)] px-3 py-1.5 text-[12px] font-semibold hover:bg-[#f7f9fb]"
                >
                  Open
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {active ? (
        <ModalShell title={active.name} onClose={() => setActive(null)} wide>
          <p className="text-sm text-[var(--muted)]">{active.summary}</p>
          <pre className="mt-4 whitespace-pre-wrap rounded-md border border-[var(--line)] bg-[#f7f9fb] p-4 font-[family-name:var(--font-body)] text-[13px] leading-relaxed text-[var(--ink)]">
            {active.body}
          </pre>
          <button
            type="button"
            onClick={() => {
              const blob = new Blob([active.body], { type: "text/plain" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `${active.name.replace(/\s+/g, "-").toLowerCase()}.txt`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="mt-4 rounded-md border border-[var(--line)] px-3 py-2 text-sm font-semibold hover:bg-[#f7f9fb]"
          >
            Download
          </button>
        </ModalShell>
      ) : null}
    </div>
  );
}
