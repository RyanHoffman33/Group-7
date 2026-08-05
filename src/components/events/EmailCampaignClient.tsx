"use client";

import { useMemo, useState, useTransition } from "react";
import { AlertCard } from "@/components/dashboard";
import { StatusPill } from "@/components/billing/ui";
import {
  approveEmailCampaign,
  saveEmailDraft,
  simulateSendEmail,
} from "@/features/events/actions";
import { emailTemplates } from "@/features/events/seed";
import type { EmailCampaign } from "@/features/events/types";

const PLACEHOLDERS = [
  "{{attendee_name}}",
  "{{event_name}}",
  "{{event_date}}",
  "{{venue_name}}",
  "{{qr_pass_link}}",
];

export function EmailCampaignClient({
  eventId,
  campaigns,
  canManage,
  canDraft,
  actor,
}: {
  eventId: string;
  campaigns: EmailCampaign[];
  canManage: boolean;
  canDraft: boolean;
  actor: string;
}) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(
    campaigns.find((c) => c.status === "draft")?.id ?? null,
  );
  const [composing, setComposing] = useState(false);

  const draftBase = useMemo(() => {
    const existing = campaigns.find((c) => c.id === editingId);
    if (existing) {
      return {
        id: existing.id,
        name: existing.name,
        audienceType: existing.audienceType,
        emailType: existing.emailType,
        fromAddress: existing.fromAddress ?? "events@mainevent.demo",
        toAudience: existing.toAudience ?? existing.audienceType,
        cc: existing.cc ?? "",
        bcc: existing.bcc ?? "",
        subject: existing.subject ?? "",
        bodyHtml: existing.bodyHtml ?? "",
        template: existing.template,
        scheduleAt: existing.scheduledAt ?? "",
      };
    }
    return {
      id: undefined as string | undefined,
      name: "New campaign",
      audienceType: "Confirmed attendees",
      emailType: "Custom",
      fromAddress: "events@mainevent.demo",
      toAudience: "Confirmed attendees",
      cc: "",
      bcc: "",
      subject: "",
      bodyHtml: "<p>Hi {{attendee_name}},</p><p></p>",
      template: "invite-v2",
      scheduleAt: "",
    };
  }, [campaigns, editingId]);

  const [form, setForm] = useState(draftBase);

  function openCompose(id?: string) {
    setEditingId(id ?? null);
    setComposing(true);
    const existing = id ? campaigns.find((c) => c.id === id) : undefined;
    if (existing) {
      setForm({
        id: existing.id,
        name: existing.name,
        audienceType: existing.audienceType,
        emailType: existing.emailType,
        fromAddress: existing.fromAddress ?? "events@mainevent.demo",
        toAudience: existing.toAudience ?? existing.audienceType,
        cc: existing.cc ?? "",
        bcc: existing.bcc ?? "",
        subject: existing.subject ?? "",
        bodyHtml: existing.bodyHtml ?? "",
        template: existing.template,
        scheduleAt: existing.scheduledAt ?? "",
      });
    } else {
      setForm({
        id: undefined,
        name: "New campaign",
        audienceType: "Confirmed attendees",
        emailType: "Custom",
        fromAddress: "events@mainevent.demo",
        toAudience: "Confirmed attendees",
        cc: "",
        bcc: "",
        subject: "",
        bodyHtml: "<p>Hi {{attendee_name}},</p><p></p>",
        template: "invite-v2",
        scheduleAt: "",
      });
    }
  }

  function applyTemplate(templateId: string) {
    const t = emailTemplates.find((x) => x.id === templateId);
    setForm((f) => ({
      ...f,
      template: templateId,
      bodyHtml: t?.body ?? f.bodyHtml,
      emailType: t?.name ?? f.emailType,
    }));
  }

  function insertPlaceholder(token: string) {
    setForm((f) => ({ ...f, bodyHtml: `${f.bodyHtml}${token}` }));
  }

  function wrap(tag: "b" | "i" | "u") {
    const open = tag === "b" ? "<strong>" : tag === "i" ? "<em>" : "<u>";
    const close = tag === "b" ? "</strong>" : tag === "i" ? "</em>" : "</u>";
    setForm((f) => ({
      ...f,
      bodyHtml: `${f.bodyHtml}${open}text${close}`,
    }));
  }

  function runSave(opts: {
    submitForApproval?: boolean;
    schedule?: boolean;
  }) {
    start(async () => {
      setMessage(null);
      setError(null);
      const res = await saveEmailDraft({
        id: form.id,
        eventId,
        name: form.name,
        audienceType: form.audienceType,
        emailType: form.emailType,
        fromAddress: form.fromAddress,
        toAudience: form.toAudience,
        cc: form.cc,
        bcc: form.bcc,
        subject: form.subject,
        bodyHtml: form.bodyHtml,
        template: form.template,
        actor,
        submitForApproval: opts.submitForApproval,
        scheduleAt: opts.schedule
          ? form.scheduleAt || new Date(Date.now() + 86400000).toISOString()
          : null,
      });
      if (res.ok) {
        setMessage(res.message);
        if (res.id) setEditingId(res.id);
      } else setError(res.error);
    });
  }

  return (
    <div className="space-y-4">
      {message ? <AlertCard tone="ok" title="Updated" body={message} /> : null}
      {error ? <AlertCard tone="danger" title="Error" body={error} /> : null}
      <AlertCard
        tone="info"
        title="Simulated email delivery"
        body="Sends create campaign records only. Messages are not delivered to real inboxes."
      />

      <div className="flex flex-wrap gap-2">
        {canDraft ? (
          <button
            type="button"
            className="rounded-md bg-[var(--ink)] px-3 py-2 text-xs font-semibold text-white"
            onClick={() => openCompose()}
          >
            Compose email
          </button>
        ) : null}
      </div>

      {composing && canDraft ? (
        <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold">Email composer</p>
            <button
              type="button"
              className="text-xs text-[var(--muted)]"
              onClick={() => setComposing(false)}
            >
              Close
            </button>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-xs">
              Campaign name
              <input
                className="mt-1 w-full rounded-md border border-[var(--line)] px-2 py-1.5 text-sm"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>
            <label className="text-xs">
              Template
              <select
                className="mt-1 w-full rounded-md border border-[var(--line)] px-2 py-1.5 text-sm"
                value={form.template}
                onChange={(e) => applyTemplate(e.target.value)}
              >
                {emailTemplates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs">
              From
              <input
                className="mt-1 w-full rounded-md border border-[var(--line)] px-2 py-1.5 text-sm"
                value={form.fromAddress}
                onChange={(e) =>
                  setForm({ ...form, fromAddress: e.target.value })
                }
              />
            </label>
            <label className="text-xs">
              To (audience)
              <input
                className="mt-1 w-full rounded-md border border-[var(--line)] px-2 py-1.5 text-sm"
                value={form.toAudience}
                onChange={(e) =>
                  setForm({
                    ...form,
                    toAudience: e.target.value,
                    audienceType: e.target.value,
                  })
                }
              />
            </label>
            <label className="text-xs">
              Cc
              <input
                className="mt-1 w-full rounded-md border border-[var(--line)] px-2 py-1.5 text-sm"
                value={form.cc}
                onChange={(e) => setForm({ ...form, cc: e.target.value })}
              />
            </label>
            <label className="text-xs">
              Bcc
              <input
                className="mt-1 w-full rounded-md border border-[var(--line)] px-2 py-1.5 text-sm"
                value={form.bcc}
                onChange={(e) => setForm({ ...form, bcc: e.target.value })}
              />
            </label>
            <label className="text-xs md:col-span-2">
              Subject
              <input
                className="mt-1 w-full rounded-md border border-[var(--line)] px-2 py-1.5 text-sm"
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
              />
            </label>
            <label className="text-xs md:col-span-2">
              Schedule (optional ISO)
              <input
                className="mt-1 w-full rounded-md border border-[var(--line)] px-2 py-1.5 text-sm"
                value={form.scheduleAt}
                onChange={(e) =>
                  setForm({ ...form, scheduleAt: e.target.value })
                }
                placeholder="2026-08-20T10:00:00"
              />
            </label>
          </div>

          <div className="mt-3 flex flex-wrap gap-1">
            <button type="button" className="rounded border px-2 py-1 text-xs font-bold" onClick={() => wrap("b")}>
              B
            </button>
            <button type="button" className="rounded border px-2 py-1 text-xs italic" onClick={() => wrap("i")}>
              I
            </button>
            <button type="button" className="rounded border px-2 py-1 text-xs underline" onClick={() => wrap("u")}>
              U
            </button>
            {PLACEHOLDERS.map((p) => (
              <button
                key={p}
                type="button"
                className="rounded border border-[var(--line)] px-2 py-1 font-mono text-[10px]"
                onClick={() => insertPlaceholder(p)}
              >
                {p}
              </button>
            ))}
          </div>

          <textarea
            className="mt-2 min-h-[140px] w-full rounded-md border border-[var(--line)] px-3 py-2 font-mono text-xs"
            value={form.bodyHtml}
            onChange={(e) => setForm({ ...form, bodyHtml: e.target.value })}
          />

          <div className="mt-3 rounded-md border border-[var(--line)] bg-white p-3">
            <p className="text-[10px] uppercase text-[var(--muted)]">Preview</p>
            <p className="mt-1 text-sm font-semibold">{form.subject || "(no subject)"}</p>
            <div
              className="prose mt-2 max-w-none text-sm"
              dangerouslySetInnerHTML={{ __html: form.bodyHtml }}
            />
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending}
              className="rounded-md border border-[var(--line)] px-3 py-1.5 text-xs font-semibold"
              onClick={() => runSave({})}
            >
              Save draft
            </button>
            <button
              type="button"
              disabled={pending}
              className="rounded-md border border-[var(--line)] px-3 py-1.5 text-xs font-semibold"
              onClick={() => runSave({ submitForApproval: true })}
            >
              Submit for approval
            </button>
            {canManage ? (
              <button
                type="button"
                disabled={pending}
                className="rounded-md border border-[var(--line)] px-3 py-1.5 text-xs font-semibold"
                onClick={() => runSave({ schedule: true })}
              >
                Schedule
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-[var(--line)] bg-[var(--surface)]">
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead className="border-b border-[var(--line)] text-xs uppercase text-[var(--muted)]">
            <tr>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Audience</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Schedule / sent</th>
              <th className="px-4 py-3">Metrics</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--line)]">
            {campaigns.map((c) => (
              <tr key={c.id}>
                <td className="px-4 py-3">
                  <div className="font-medium">{c.name}</div>
                  <div className="text-xs text-[var(--muted)]">
                    {c.emailType} · {c.createdBy}
                  </div>
                  {c.subject ? (
                    <div className="mt-1 text-xs text-[var(--muted)]">{c.subject}</div>
                  ) : null}
                </td>
                <td className="px-4 py-3">{c.audienceType}</td>
                <td className="px-4 py-3">
                  <StatusPill
                    tone={
                      c.status === "simulated_sent"
                        ? "ok"
                        : c.status === "canceled"
                          ? "danger"
                          : c.status === "draft" || c.status === "pending_approval"
                            ? "warn"
                            : "accent"
                    }
                  >
                    {c.status.replace("_", " ")}
                  </StatusPill>
                  <div className="mt-1 text-[10px] text-[var(--muted)]">
                    Approval: {c.approvalStatus}
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-[var(--muted)]">
                  {c.sentAt
                    ? `Sent (simulated) ${new Date(c.sentAt).toLocaleString()}`
                    : c.scheduledAt
                      ? `Scheduled ${new Date(c.scheduledAt).toLocaleString()}`
                      : "—"}
                </td>
                <td className="px-4 py-3 text-xs">
                  Recipients {c.recipientCount}
                  <br />
                  Opens {c.openCount}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    {canDraft && c.status !== "simulated_sent" ? (
                      <button
                        type="button"
                        className="rounded-md border border-[var(--line)] px-2 py-1 text-xs font-semibold"
                        onClick={() => openCompose(c.id)}
                      >
                        Edit
                      </button>
                    ) : null}
                    {canManage && c.approvalStatus === "pending" ? (
                      <button
                        type="button"
                        disabled={pending}
                        className="rounded-md border border-[var(--line)] px-2 py-1 text-xs font-semibold"
                        onClick={() =>
                          start(async () => {
                            const res = await approveEmailCampaign(c.id);
                            if (res.ok) setMessage(res.message);
                            else setError(res.error);
                          })
                        }
                      >
                        Approve
                      </button>
                    ) : null}
                    {(canManage || canDraft) &&
                    c.status !== "canceled" &&
                    c.status !== "simulated_sent" ? (
                      <button
                        type="button"
                        disabled={pending || c.approvalStatus === "pending"}
                        className="rounded-md bg-[var(--ink)] px-2 py-1 text-xs font-semibold text-white disabled:opacity-50"
                        onClick={() =>
                          start(async () => {
                            const res = await simulateSendEmail(c.id, actor);
                            if (res.ok) setMessage(res.message);
                            else setError(res.error);
                          })
                        }
                      >
                        Simulate send
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
