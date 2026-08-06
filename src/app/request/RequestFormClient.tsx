"use client";

import { useActionState } from "react";
import {
  submitEventRequestAction,
  type RequestFormState,
} from "@/features/requests/actions";
import {
  BUDGET_RANGE_OPTIONS,
  EVENT_TYPE_OPTIONS,
} from "@/features/requests/types";
import { ReferralSurveyModal } from "@/components/request/ReferralSurveyModal";
import { logoutAction } from "@/features/users/actions";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-[var(--danger)]">{message}</p>;
}

export default function RequestPage({
  contactName,
  contactEmail,
  contactPhone,
}: {
  contactName: string;
  contactEmail: string;
  contactPhone: string;
}) {
  const [state, formAction, pending] = useActionState<
    RequestFormState,
    FormData
  >(submitEventRequestAction, null);

  const showSurvey = Boolean(state?.showSurvey && state?.requestId);

  return (
    <div className="min-h-screen bg-[var(--bg)] px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
              MainEvent
            </p>
            <h1 className="mt-2 font-[family-name:var(--font-display)] text-4xl text-[var(--ink)]">
              Event request
            </h1>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Tell us about your event. Our team will follow up after you
              submit.
            </p>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              className="text-sm text-[var(--muted)] underline-offset-2 hover:underline"
            >
              Sign out
            </button>
          </form>
        </div>

        <section className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-8 shadow-sm">
          <div className="mb-6 rounded-md bg-[var(--bg)] px-4 py-3 text-sm text-[var(--muted)]">
            <p>
              <span className="font-medium text-[var(--ink)]">Contact:</span>{" "}
              {contactName}
            </p>
            <p>
              {contactEmail}
              {contactPhone ? ` · ${contactPhone}` : ""}
            </p>
          </div>

          <form action={formAction} className="space-y-4">
            <label className="block text-sm">
              <span className="mb-1.5 block font-medium">Organization</span>
              <input
                name="organization"
                required
                disabled={showSurvey}
                className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2.5 outline-none ring-[var(--accent)] focus:ring-2 disabled:opacity-60"
              />
              <FieldError message={state?.fieldErrors?.organization} />
            </label>

            <label className="block text-sm">
              <span className="mb-1.5 block font-medium">Event name</span>
              <input
                name="eventName"
                required
                disabled={showSurvey}
                className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2.5 outline-none ring-[var(--accent)] focus:ring-2 disabled:opacity-60"
              />
              <FieldError message={state?.fieldErrors?.eventName} />
            </label>

            <label className="block text-sm">
              <span className="mb-1.5 block font-medium">Event type</span>
              <select
                name="eventType"
                required
                disabled={showSurvey}
                defaultValue=""
                className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2.5 outline-none ring-[var(--accent)] focus:ring-2 disabled:opacity-60"
              >
                <option value="" disabled>
                  Select type…
                </option>
                {EVENT_TYPE_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <FieldError message={state?.fieldErrors?.eventType} />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1.5 block font-medium">Preferred date</span>
                <input
                  name="preferredDate"
                  type="date"
                  required
                  disabled={showSurvey}
                  className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2.5 outline-none ring-[var(--accent)] focus:ring-2 disabled:opacity-60"
                />
                <FieldError message={state?.fieldErrors?.preferredDate} />
              </label>
              <label className="block text-sm">
                <span className="mb-1.5 block font-medium">
                  Estimated guests
                </span>
                <input
                  name="estimatedGuests"
                  type="number"
                  min={1}
                  required
                  disabled={showSurvey}
                  className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2.5 outline-none ring-[var(--accent)] focus:ring-2 disabled:opacity-60"
                />
                <FieldError message={state?.fieldErrors?.estimatedGuests} />
              </label>
            </div>

            <label className="block text-sm">
              <span className="mb-1.5 block font-medium">Venue preference</span>
              <input
                name="venuePreference"
                required
                placeholder="City, venue name, or flexible"
                disabled={showSurvey}
                className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2.5 outline-none ring-[var(--accent)] focus:ring-2 disabled:opacity-60"
              />
              <FieldError message={state?.fieldErrors?.venuePreference} />
            </label>

            <label className="block text-sm">
              <span className="mb-1.5 block font-medium">Budget range</span>
              <select
                name="budgetRange"
                required
                disabled={showSurvey}
                defaultValue=""
                className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2.5 outline-none ring-[var(--accent)] focus:ring-2 disabled:opacity-60"
              >
                <option value="" disabled>
                  Select range…
                </option>
                {BUDGET_RANGE_OPTIONS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
              <FieldError message={state?.fieldErrors?.budgetRange} />
            </label>

            <label className="block text-sm">
              <span className="mb-1.5 block font-medium">
                Message to Our Team
              </span>
              <textarea
                name="messageToTeam"
                required
                rows={5}
                disabled={showSurvey}
                placeholder="Share goals, timing constraints, or anything else we should know…"
                className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2.5 outline-none ring-[var(--accent)] focus:ring-2 disabled:opacity-60"
              />
              <FieldError message={state?.fieldErrors?.messageToTeam} />
            </label>

            {state?.error && !showSurvey ? (
              <p className="rounded-md border border-[var(--danger)]/20 bg-[#fdf2f2] px-3 py-2 text-sm text-[var(--danger)]">
                {state.error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={pending || showSurvey}
              className="w-full rounded-md bg-[var(--ink)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {pending
                ? "Submitting…"
                : showSurvey
                  ? "Request submitted"
                  : "Submit Request"}
            </button>
          </form>
        </section>
      </div>

      {showSurvey && state?.requestId ? (
        <ReferralSurveyModal requestId={state.requestId} />
      ) : null}
    </div>
  );
}
