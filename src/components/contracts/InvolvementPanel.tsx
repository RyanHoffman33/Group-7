"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  sendCustomerApprovalRequest,
  setContractInvolvementModel,
} from "@/features/involvement/actions";
import {
  CHECKPOINT_TYPES,
  CHECKPOINT_LABELS,
  INVOLVEMENT_MODELS,
  INVOLVEMENT_MODEL_DESCRIPTIONS,
  INVOLVEMENT_MODEL_LABELS,
  checkpointLabel,
  type CheckpointType,
  type InvolvementModel,
} from "@/features/involvement/checkpoints";
import type { ApprovalItemWithMeta } from "@/features/involvement/types";
import { formatDate } from "@/features/billing/aging";
import { Panel, StatusPill } from "@/components/billing/ui";

function decisionTone(status: string) {
  if (status === "approved") return "ok" as const;
  if (status === "changes_requested") return "warn" as const;
  if (status === "pending") return "danger" as const;
  if (status === "superseded") return "neutral" as const;
  return "neutral" as const;
}

export function InvolvementPanel({
  contractId,
  model: initialModel,
  requiredTypes,
  customTypes,
  approvalItems,
  actorLabel,
}: {
  contractId: string;
  model: InvolvementModel;
  requiredTypes: CheckpointType[];
  customTypes: CheckpointType[];
  approvalItems: ApprovalItemWithMeta[];
  actorLabel: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const [model, setModel] = useState<InvolvementModel>(initialModel);
  const [customSelected, setCustomSelected] = useState<CheckpointType[]>(
    customTypes.length ? customTypes : requiredTypes,
  );

  const [cpType, setCpType] = useState<CheckpointType>(
    requiredTypes[0] ?? "event_concept",
  );
  const [title, setTitle] = useState("");
  const [info, setInfo] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [reviseKey, setReviseKey] = useState("");

  const field =
    "w-full rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm";

  const currentItems = useMemo(() => {
    const byKey = new Map<string, ApprovalItemWithMeta>();
    for (const item of approvalItems) {
      const prev = byKey.get(item.item_key);
      if (!prev || item.version > prev.version) byKey.set(item.item_key, item);
    }
    return [...byKey.values()].sort((a, b) =>
      String(a.due_date ?? "").localeCompare(String(b.due_date ?? "")),
    );
  }, [approvalItems]);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, okMsg: string) {
    setError(null);
    setMsg(null);
    start(async () => {
      const r = await fn();
      if (!r.ok) {
        setError(r.error ?? "Action failed");
        return;
      }
      setMsg(okMsg);
      router.refresh();
    });
  }

  function toggleCustom(type: CheckpointType) {
    setCustomSelected((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Customer involvement model">
        <p className="mb-3 text-sm text-[var(--muted)]">
          Controls which planning checkpoints require customer approval for this
          engagement.
        </p>
        <div className="space-y-2">
          {INVOLVEMENT_MODELS.map((m) => (
            <label
              key={m}
              className={`flex cursor-pointer gap-3 rounded-md border px-3 py-2 text-sm ${
                model === m
                  ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                  : "border-[var(--line)]"
              }`}
            >
              <input
                type="radio"
                name="involvement-model"
                checked={model === m}
                onChange={() => setModel(m)}
                className="mt-1"
              />
              <span>
                <span className="font-semibold text-[var(--ink)]">
                  {INVOLVEMENT_MODEL_LABELS[m]}
                </span>
                <span className="mt-0.5 block text-xs text-[var(--muted)]">
                  {INVOLVEMENT_MODEL_DESCRIPTIONS[m]}
                </span>
              </span>
            </label>
          ))}
        </div>

        {model === "custom" ? (
          <div className="mt-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
              Required checkpoints
            </p>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {CHECKPOINT_TYPES.map((t) => (
                <label key={t} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={customSelected.includes(t)}
                    onChange={() => toggleCustom(t)}
                  />
                  {CHECKPOINT_LABELS[t]}
                </label>
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
              Required for this model
            </p>
            <ul className="flex flex-wrap gap-1.5">
              {requiredTypes.map((t) => (
                <li
                  key={t}
                  className="rounded-md border border-[var(--line)] bg-[#f8fafb] px-2 py-1 text-xs"
                >
                  {CHECKPOINT_LABELS[t]}
                </li>
              ))}
            </ul>
          </div>
        )}

        <button
          type="button"
          disabled={pending}
          className="mt-4 rounded-md bg-[var(--ink)] px-3 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
          onClick={() =>
            run(
              () =>
                setContractInvolvementModel({
                  contractId,
                  model,
                  customCheckpointTypes:
                    model === "custom" ? customSelected : undefined,
                }),
              "Involvement model saved.",
            )
          }
        >
          Save involvement model
        </button>
      </Panel>

      <Panel title="Send customer approval request">
        <div className="space-y-3">
          <label className="block text-sm">
            <span className="mb-1 block text-[var(--muted)]">Checkpoint type</span>
            <select
              className={field}
              value={cpType}
              onChange={(e) => setCpType(e.target.value as CheckpointType)}
            >
              {(model === "custom" && customSelected.length
                ? customSelected
                : requiredTypes.length
                  ? requiredTypes
                  : [...CHECKPOINT_TYPES]
              ).map((t) => (
                <option key={t} value={t}>
                  {CHECKPOINT_LABELS[t]}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-[var(--muted)]">Title</span>
            <input
              className={field}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Approve catering package"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-[var(--muted)]">
              Supporting information
            </span>
            <textarea
              className={field}
              rows={4}
              value={info}
              onChange={(e) => setInfo(e.target.value)}
              placeholder="Details the customer should review…"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-[var(--muted)]">Due date</span>
            <input
              type="date"
              className={field}
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-[var(--muted)]">
              Revise existing item key (optional)
            </span>
            <input
              className={field}
              value={reviseKey}
              onChange={(e) => setReviseKey(e.target.value)}
              placeholder="Leave blank for a new item"
              list={`item-keys-${contractId}`}
            />
            <datalist id={`item-keys-${contractId}`}>
              {[...new Set(approvalItems.map((a) => a.item_key))].map((k) => (
                <option key={k} value={k} />
              ))}
            </datalist>
          </label>
          <button
            type="button"
            disabled={pending}
            className="rounded-md bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-50"
            onClick={() =>
              run(
                () =>
                  sendCustomerApprovalRequest({
                    contractId,
                    checkpointType: cpType,
                    title,
                    supportingInfo: info,
                    dueDate: dueDate || undefined,
                    createdBy: actorLabel,
                    itemKey: reviseKey || undefined,
                  }),
                "Approval request sent to customer portal.",
              )
            }
          >
            Send to customer
          </button>
        </div>
      </Panel>

      <div className="lg:col-span-2">
        <Panel title="Customer approval status & history">
          {currentItems.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">
              No customer approval requests yet.
            </p>
          ) : (
            <ul className="divide-y divide-[var(--line)] text-sm">
              {currentItems.map((item) => (
                <li key={item.id} className="py-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-[var(--ink)]">
                        {item.title}{" "}
                        <span className="font-normal text-[var(--muted)]">
                          · v{item.version}
                        </span>
                      </p>
                      <p className="mt-0.5 text-xs text-[var(--muted)]">
                        {checkpointLabel(item.checkpoint_type)}
                        {item.due_date
                          ? ` · Due ${formatDate(item.due_date)}`
                          : ""}
                        {` · key ${item.item_key}`}
                      </p>
                    </div>
                    <StatusPill tone={decisionTone(item.status)}>
                      {item.status.replace(/_/g, " ")}
                    </StatusPill>
                  </div>
                  {item.supporting_info ? (
                    <p className="mt-2 whitespace-pre-wrap text-[var(--muted)]">
                      {item.supporting_info}
                    </p>
                  ) : null}
                  {item.decisions.length > 0 ? (
                    <ul className="mt-2 space-y-1 rounded-md bg-[#f8fafb] px-3 py-2 text-xs">
                      {item.decisions.map((d) => (
                        <li key={d.id}>
                          <span className="font-semibold">
                            {d.decision.replace(/_/g, " ")}
                          </span>{" "}
                          by {d.customer_contact} · v{d.approved_version} ·{" "}
                          {formatDate(d.decided_at)}
                          {d.comments ? ` — ${d.comments}` : ""}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {approvalItems.filter(
                    (h) => h.item_key === item.item_key && h.id !== item.id,
                  ).length > 0 ? (
                    <details className="mt-2 text-xs text-[var(--muted)]">
                      <summary className="cursor-pointer font-medium">
                        Prior versions
                      </summary>
                      <ul className="mt-1 space-y-1 pl-2">
                        {approvalItems
                          .filter(
                            (h) =>
                              h.item_key === item.item_key && h.id !== item.id,
                          )
                          .sort((a, b) => b.version - a.version)
                          .map((h) => (
                            <li key={h.id}>
                              v{h.version} · {h.status.replace(/_/g, " ")}
                              {h.decisions[0]
                                ? ` · ${h.decisions[0].decision} by ${h.decisions[0].customer_contact}`
                                : ""}
                            </li>
                          ))}
                      </ul>
                    </details>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {error ? (
        <p className="text-sm text-[#b42318] lg:col-span-2">{error}</p>
      ) : null}
      {msg ? (
        <p className="text-sm text-[#1b6b3a] lg:col-span-2">{msg}</p>
      ) : null}
    </div>
  );
}
