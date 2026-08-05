"use client";

import { useTransition } from "react";
import { DEMO_ACCOUNTS } from "@/features/users/demo-accounts";
import { loginAsEmailFormAction } from "@/features/users/actions";

/** Panel-friendly instant role switch without logging out first. */
export function DemoRoleSwitcher({ currentEmail }: { currentEmail: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="mt-3">
      <label
        htmlFor="demo-role-switch"
        className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-white/40"
      >
        Switch Demo Role
      </label>
      <select
        id="demo-role-switch"
        disabled={pending}
        value={currentEmail.toLowerCase()}
        onChange={(e) => {
          const email = e.target.value;
          if (!email || email === currentEmail.toLowerCase()) return;
          const fd = new FormData();
          fd.set("email", email);
          startTransition(() => {
            void loginAsEmailFormAction(fd);
          });
        }}
        className="w-full rounded-md border border-white/15 bg-white/5 px-2 py-1.5 text-[11px] text-white/90 outline-none focus:border-white/30 disabled:opacity-60"
      >
        {DEMO_ACCOUNTS.map((a) => (
          <option key={a.email} value={a.email} className="bg-[#1a2332] text-white">
            {a.role}
          </option>
        ))}
      </select>
      {pending ? (
        <p className="mt-1 text-[10px] text-white/40">Switching…</p>
      ) : (
        <p className="mt-1 text-[10px] text-white/35">Panel: no logout required</p>
      )}
    </div>
  );
}
