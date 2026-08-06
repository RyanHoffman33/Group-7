"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createCustomerAction } from "@/features/contracts/customer-actions";

export function CreateCustomerForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 py-2 text-sm font-medium"
      >
        + Create new customer
      </button>
    );
  }

  return (
    <form
      className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        const fd = new FormData();
        fd.set("name", name);
        fd.set("billingEmail", email);
        fd.set("phone", phone);
        start(async () => {
          const r = await createCustomerAction(fd);
          if (!r.ok) {
            setError(r.error ?? "Failed");
            return;
          }
          setOpen(false);
          setName("");
          setEmail("");
          setPhone("");
          router.refresh();
        });
      }}
    >
      <h3 className="text-sm font-semibold text-[var(--ink)]">New customer</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <label className="text-sm">
          <span className="mb-1 block font-medium">Name *</span>
          <input
            className="w-full rounded-md border border-[var(--line)] px-3 py-2"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium">Billing email *</span>
          <input
            type="email"
            className="w-full rounded-md border border-[var(--line)] px-3 py-2"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium">Phone</span>
          <input
            className="w-full rounded-md border border-[var(--line)] px-3 py-2"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </label>
      </div>
      {error ? (
        <p className="mt-2 text-sm text-[var(--danger)]">{error}</p>
      ) : null}
      <div className="mt-3 flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-[var(--ink)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save customer"}
        </button>
        <button
          type="button"
          className="rounded-md px-4 py-2 text-sm text-[var(--muted)]"
          onClick={() => setOpen(false)}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
