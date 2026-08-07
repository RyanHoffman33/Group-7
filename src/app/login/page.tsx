"use client";

import Link from "next/link";
import { useActionState } from "react";
import { LoginSplash } from "@/components/auth/LoginSplash";
import {
  loginAction,
  loginAsEmailFormAction,
  type LoginState,
} from "@/features/users/actions";
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from "@/features/users/demo-accounts";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(
    loginAction,
    null,
  );

  return (
    <div className="min-h-screen bg-[var(--bg)] px-4 py-10">
      <LoginSplash />
      <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-8 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
            MainEvent
          </p>
          <h1 className="mt-3 font-[family-name:var(--font-display)] text-4xl text-[var(--ink)]">
            Sign in
          </h1>
          <p className="mt-2 max-w-md text-sm text-[var(--muted)]">
            Your account determines your dashboard — like Cvent, you do not pick
            your own permissions. Demo password for every account:{" "}
            <strong className="text-[var(--ink)]">{DEMO_PASSWORD}</strong>
          </p>

          <form action={formAction} className="mt-8 space-y-4">
            <label className="block text-sm">
              <span className="mb-1.5 block font-medium">Email</span>
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="manager@gmail.com"
                className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2.5 outline-none ring-[var(--accent)] focus:ring-2"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1.5 block font-medium">Password</span>
              <input
                name="password"
                type="password"
                required
                autoComplete="current-password"
                defaultValue={DEMO_PASSWORD}
                className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2.5 outline-none ring-[var(--accent)] focus:ring-2"
              />
            </label>
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
              {pending ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <div className="mt-6 border-t border-[var(--line)] pt-6">
            <p className="text-sm text-[var(--muted)]">New client?</p>
            <Link
              href="/register"
              className="mt-2 inline-flex w-full items-center justify-center rounded-md border border-[var(--line)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--ink)] transition hover:bg-[var(--bg)]"
            >
              Create New Account
            </Link>
          </div>
        </section>

        <section className="rounded-xl border border-[var(--line)] bg-[var(--ink)] p-8 text-white">
          <h2 className="font-[family-name:var(--font-display)] text-2xl">
            Demo accounts
          </h2>
          <p className="mt-2 text-sm text-white/60">
            Click a role to open that dashboard immediately.
          </p>
          <ul className="mt-6 space-y-2">
            {DEMO_ACCOUNTS.map((a) => (
              <li key={a.email}>
                <form action={loginAsEmailFormAction}>
                  <input type="hidden" name="email" value={a.email} />
                  <button
                    type="submit"
                    className="flex w-full items-center justify-between rounded-md border border-white/10 bg-white/5 px-3 py-2.5 text-left text-sm transition hover:bg-white/10"
                  >
                    <span>
                      <span className="block font-medium">{a.role}</span>
                      <span className="text-xs text-white/50">{a.email}</span>
                    </span>
                    <span className="text-xs text-white/40">Open →</span>
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
