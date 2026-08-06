"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  registerAction,
  type RegisterState,
} from "@/features/users/actions";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-[var(--danger)]">{message}</p>;
}

export default function RegisterPage() {
  const [state, formAction, pending] = useActionState<RegisterState, FormData>(
    registerAction,
    null,
  );

  return (
    <div className="min-h-screen bg-[var(--bg)] px-4 py-10">
      <div className="mx-auto max-w-lg rounded-xl border border-[var(--line)] bg-[var(--surface)] p-8 shadow-sm">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
          MainEvent
        </p>
        <h1 className="mt-3 font-[family-name:var(--font-display)] text-4xl text-[var(--ink)]">
          Create New Account
        </h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Register as a client. Creating your account signs you in automatically
          as a <strong className="text-[var(--ink)]">Customer</strong> (unless
          management later changes your role).
        </p>

        <form action={formAction} className="mt-8 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1.5 block font-medium">First name</span>
              <input
                name="firstName"
                required
                autoComplete="given-name"
                className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2.5 outline-none ring-[var(--accent)] focus:ring-2"
              />
              <FieldError message={state?.fieldErrors?.firstName} />
            </label>
            <label className="block text-sm">
              <span className="mb-1.5 block font-medium">Last name</span>
              <input
                name="lastName"
                required
                autoComplete="family-name"
                className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2.5 outline-none ring-[var(--accent)] focus:ring-2"
              />
              <FieldError message={state?.fieldErrors?.lastName} />
            </label>
          </div>

          <label className="block text-sm">
            <span className="mb-1.5 block font-medium">Email</span>
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2.5 outline-none ring-[var(--accent)] focus:ring-2"
            />
            <FieldError message={state?.fieldErrors?.email} />
          </label>

          <label className="block text-sm">
            <span className="mb-1.5 block font-medium">Phone</span>
            <input
              name="phone"
              type="tel"
              required
              autoComplete="tel"
              className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2.5 outline-none ring-[var(--accent)] focus:ring-2"
            />
            <FieldError message={state?.fieldErrors?.phone} />
          </label>

          <label className="block text-sm">
            <span className="mb-1.5 block font-medium">Password</span>
            <input
              name="password"
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2.5 outline-none ring-[var(--accent)] focus:ring-2"
            />
            <FieldError message={state?.fieldErrors?.password} />
          </label>

          <label className="block text-sm">
            <span className="mb-1.5 block font-medium">Confirm password</span>
            <input
              name="confirmPassword"
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2.5 outline-none ring-[var(--accent)] focus:ring-2"
            />
            <FieldError message={state?.fieldErrors?.confirmPassword} />
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
            {pending ? "Creating account…" : "Create account & sign in"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-[var(--muted)]">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-[var(--ink)] underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
