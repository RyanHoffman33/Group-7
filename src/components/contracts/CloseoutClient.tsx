"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { closeContract } from "@/features/contracts/actions";
import type { CloseoutCheck, ContractListRow } from "@/features/contracts/queries";
import { Money, StatusPill } from "@/components/billing/ui";

type Row = ContractListRow & {
  canClose: boolean;
  checks: CloseoutCheck[];
};

function shortContractRef(value: string) {
  if (value.length <= 18) return value;
  return `${value.slice(0, 10)}…${value.slice(-4)}`;
}

export function CloseoutClient({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [actor, setActor] = useState("Alex Rivera");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <label className="block max-w-sm text-sm">
        <span className="mb-1 block text-[var(--muted)]">Closing user</span>
        <input
          value={actor}
          onChange={(e) => setActor(e.target.value)}
          className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2"
        />
      </label>
      {error ? (
        <p className="text-sm text-[var(--danger)]" role="alert">
          {error}
        </p>
      ) : null}

      {rows.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">
          No completed engagements available for closeout review.
        </p>
      ) : (
        <ul className="space-y-4">
          {rows.map((c) => (
            <li
              key={c.id}
              className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <Link
                    href={`/contracts/${c.id}`}
                    className="font-semibold text-[var(--accent)]"
                    title={c.contract_number}
                  >
                    {shortContractRef(c.contract_number)}
                  </Link>
                  <div className="text-sm">
                    {c.event_name} · {c.customer_name}
                  </div>
                  <div className="text-sm text-[var(--muted)]">
                    Value <Money amount={Number(c.contract_value)} />
                  </div>
                </div>
                <StatusPill tone={c.canClose ? "ok" : "warn"}>
                  {c.status === "closed"
                    ? "Already closed"
                    : c.canClose
                      ? "Eligible"
                      : "Blocked"}
                </StatusPill>
              </div>
              <ul className="mt-3 grid gap-1 text-xs sm:grid-cols-2">
                {c.checks.map((ch) => (
                  <li
                    key={ch.key}
                    className={ch.ok ? "text-[var(--ok)]" : "text-[var(--danger)]"}
                  >
                    {ch.ok ? "✓" : "✗"} {ch.label}: {ch.detail}
                  </li>
                ))}
              </ul>
              {c.status !== "closed" ? (
                <div className="mt-3 space-y-2">
                  <textarea
                    className="w-full rounded-md border border-[var(--line)] px-3 py-2 text-sm"
                    rows={2}
                    placeholder="Closeout notes (required)"
                    value={notes[c.id] ?? ""}
                    onChange={(e) =>
                      setNotes((s) => ({ ...s, [c.id]: e.target.value }))
                    }
                  />
                  <button
                    type="button"
                    disabled={pending || !c.canClose}
                    className="rounded-md bg-[var(--ink)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
                    onClick={() => {
                      const closeout_notes = notes[c.id]?.trim();
                      if (!closeout_notes) {
                        setError("Closeout notes are required.");
                        return;
                      }
                      if (
                        !confirm(
                          `Close contract ${c.contract_number}? Confirm all checklist items are complete.`,
                        )
                      )
                        return;
                      setError(null);
                      start(async () => {
                        const r = await closeContract({
                          contract_id: c.id,
                          actor_label: actor,
                          closeout_notes,
                        });
                        if (!r.ok) setError(r.error);
                        else router.refresh();
                      });
                    }}
                  >
                    Close contract
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
