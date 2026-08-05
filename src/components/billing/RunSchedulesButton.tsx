"use client";

import { useRouter } from "next/navigation";
import { useTransition, useState } from "react";
import { runDueBillingSchedules } from "@/features/billing/actions";

export function RunSchedulesButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <div>
      <button
        type="button"
        disabled={pending}
        className="rounded-md bg-[var(--ink)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        onClick={() => {
          setMsg(null);
          start(async () => {
            const r = await runDueBillingSchedules();
            if (!r.ok) setMsg(r.error);
            else {
              setMsg(`Created ${r.created ?? 0} scheduled invoice(s) / draft(s).`);
              router.refresh();
            }
          });
        }}
      >
        {pending ? "Running…" : "Run due schedules (simulate drafts)"}
      </button>
      {msg ? <p className="mt-2 text-sm text-[var(--muted)]">{msg}</p> : null}
    </div>
  );
}
