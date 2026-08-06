import Link from "next/link";
import { redirect } from "next/navigation";
import { getRequestForCurrentUser } from "@/features/requests/actions";
import { getSessionAppUser } from "@/features/users/session";

export default async function RequestConfirmationPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const user = await getSessionAppUser();
  if (!user) redirect("/login");
  if (user.roleKey !== "customer") {
    redirect("/access-denied?from=/request/confirmation");
  }

  const { id } = await searchParams;
  const request = id ? await getRequestForCurrentUser(id) : null;

  return (
    <div className="min-h-screen bg-[var(--bg)] px-4 py-16">
      <div className="mx-auto max-w-lg rounded-xl border border-[var(--line)] bg-[var(--surface)] p-8 text-center shadow-sm">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
          MainEvent
        </p>
        <h1 className="mt-3 font-[family-name:var(--font-display)] text-4xl text-[var(--ink)]">
          Thank you
        </h1>
        <p className="mt-3 text-sm text-[var(--muted)]">
          {request
            ? `We received your request for “${request.eventName}”. Our team will review it and follow up soon.`
            : "Your event request was submitted. Our team will follow up soon."}
        </p>
        {request ? (
          <p className="mt-2 text-xs text-[var(--muted)]">
            Reference: {request.id}
          </p>
        ) : null}
        <Link
          href="/dashboard/customer"
          className="mt-8 inline-flex w-full items-center justify-center rounded-md bg-[var(--ink)] px-4 py-2.5 text-sm font-semibold text-white"
        >
          Go to my dashboard
        </Link>
      </div>
    </div>
  );
}
