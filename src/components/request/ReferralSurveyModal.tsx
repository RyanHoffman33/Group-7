"use client";

import { useActionState, useState } from "react";
import {
  skipReferralSurveyAction,
  submitReferralSurveyAction,
  type SurveyState,
} from "@/features/requests/actions";
import { REFERRAL_OPTIONS } from "@/features/requests/types";

export function ReferralSurveyModal({ requestId }: { requestId: string }) {
  const [source, setSource] = useState("");
  const [state, formAction, pending] = useActionState<SurveyState, FormData>(
    submitReferralSurveyAction,
    null,
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="referral-survey-title"
    >
      <div className="w-full max-w-md rounded-xl border border-[var(--line)] bg-[var(--surface)] p-6 shadow-lg">
        <h2
          id="referral-survey-title"
          className="font-[family-name:var(--font-display)] text-2xl text-[var(--ink)]"
        >
          How did you hear about us?
        </h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Your event request was saved. This quick question helps our team — you
          can skip it anytime.
        </p>

        <form action={formAction} className="mt-5 space-y-4">
          <input type="hidden" name="requestId" value={requestId} />
          <fieldset className="space-y-2">
            <legend className="sr-only">Referral source</legend>
            {REFERRAL_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className="flex cursor-pointer items-center gap-2 rounded-md border border-[var(--line)] px-3 py-2 text-sm hover:bg-[var(--bg)]"
              >
                <input
                  type="radio"
                  name="referralSource"
                  value={opt.value}
                  checked={source === opt.value}
                  onChange={() => setSource(opt.value)}
                  required
                />
                {opt.label}
              </label>
            ))}
          </fieldset>

          {source === "other" ? (
            <label className="block text-sm">
              <span className="mb-1.5 block font-medium">Please specify</span>
              <input
                name="referralOtherText"
                required
                className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2.5 outline-none ring-[var(--accent)] focus:ring-2"
              />
            </label>
          ) : (
            <input type="hidden" name="referralOtherText" value="" />
          )}

          {state?.error ? (
            <p className="rounded-md border border-[var(--danger)]/20 bg-[#fdf2f2] px-3 py-2 text-sm text-[var(--danger)]">
              {state.error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-md bg-[var(--ink)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {pending ? "Submitting…" : "Submit Response"}
          </button>
        </form>

        <form action={skipReferralSurveyAction} className="mt-3">
          <input type="hidden" name="requestId" value={requestId} />
          <button
            type="submit"
            className="w-full rounded-md px-4 py-2.5 text-sm font-medium text-[var(--muted)] underline-offset-2 hover:underline"
          >
            Skip for Now
          </button>
        </form>
      </div>
    </div>
  );
}
