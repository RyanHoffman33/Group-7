"use client";

import { useTransition, useState } from "react";
import { togglePersonalSession } from "@/features/events/actions";

export function PersonalScheduleToggle({
  registrationId,
  sessionId,
  selected,
}: {
  registrationId: string;
  sessionId: string;
  selected: boolean;
}) {
  const [pending, start] = useTransition();
  const [on, setOn] = useState(selected);
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await togglePersonalSession(registrationId, sessionId);
            if (res.ok) {
              setOn((v) => !v);
              setMsg(res.message);
            }
          })
        }
        className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
          on
            ? "bg-[var(--accent)] text-white"
            : "border border-[var(--line)] bg-white text-[var(--ink)]"
        }`}
      >
        {pending ? "…" : on ? "On my schedule" : "Add to schedule"}
      </button>
      {msg ? <p className="mt-1 text-[10px] text-[var(--muted)]">{msg}</p> : null}
    </div>
  );
}
