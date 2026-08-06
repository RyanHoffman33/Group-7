"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  customerAcceptContractProposal,
  customerRejectContractProposal,
} from "@/features/contracts/actions";
import { formatCurrency } from "@/features/billing/aging";
import { Panel, StatusPill } from "@/components/billing/ui";
import type { CustomerFacingContract } from "@/features/involvement/types";
import {
  STATUS_LABELS,
  type ContractStatus,
} from "@/features/contracts/status";

function proposalStatusLabel(status: string) {
  return (
    STATUS_LABELS[status as ContractStatus] ?? status.replace(/_/g, " ")
  );
}

export function CustomerContractProposalsPanel({
  proposals,
}: {
  proposals: CustomerFacingContract[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [signerById, setSignerById] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  if (!proposals.length) {
    return (
      <Panel title="Contracts to accept">
        <p className="py-3 text-sm text-[var(--muted)]">
          No contracts waiting for you. When MainEvent sends a proposal, it
          appears here to sign and pay the deposit. Start an inquiry under{" "}
          <span className="font-medium text-[var(--ink)]">Your inquiry</span>{" "}
          if you need a new event quote.
        </p>
      </Panel>
    );
  }

  return (
    <Panel title="Contracts to accept">
      {error ? (
        <p className="mb-2 text-sm text-[var(--danger)]" role="alert">
          {error}
        </p>
      ) : null}
      <ul className="divide-y divide-[var(--line)]">
        {proposals.map((p) => (
          <li key={p.id} className="py-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-[var(--ink)]">{p.event_name}</p>
                <p className="mt-0.5 text-xs text-[var(--muted)]">
                  {p.contract_number} · {formatCurrency(p.contract_value)} · PM{" "}
                  {p.project_manager_label}
                </p>
              </div>
              <StatusPill compact tone="accent">
                {proposalStatusLabel(p.status)}
              </StatusPill>
            </div>
            <p className="mt-2 text-xs text-[var(--muted)]">
              Accept with your typed signature and authorize the first deposit /
              installment.
            </p>
            <label className="mt-2 block text-sm">
              <span className="mb-1 block text-xs text-[var(--muted)]">
                Full legal name (e-sign)
              </span>
              <input
                className="w-full max-w-md rounded-md border border-[var(--line)] px-3 py-2 text-sm"
                value={signerById[p.id] ?? ""}
                onChange={(e) =>
                  setSignerById((prev) => ({ ...prev, [p.id]: e.target.value }))
                }
                placeholder="Casey Customer"
              />
            </label>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={pending}
                className="rounded-md bg-[var(--ink)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                onClick={() => {
                  setError(null);
                  start(async () => {
                    const r = await customerAcceptContractProposal({
                      contract_id: p.id,
                      signer_name: signerById[p.id] ?? "",
                      pay_deposit: true,
                    });
                    if (!r.ok) {
                      setError(r.error);
                      return;
                    }
                    router.refresh();
                  });
                }}
              >
                Accept, sign & pay deposit
              </button>
              <button
                type="button"
                disabled={pending}
                className="rounded-md border border-[var(--line)] px-3 py-2 text-xs font-medium disabled:opacity-60"
                onClick={() => {
                  if (!confirm("Reject this contract proposal?")) return;
                  setError(null);
                  start(async () => {
                    const r = await customerRejectContractProposal({
                      contract_id: p.id,
                      reason: "Customer declined the contract proposal.",
                    });
                    if (!r.ok) {
                      setError(r.error);
                      return;
                    }
                    router.refresh();
                  });
                }}
              >
                Reject proposal
              </button>
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
