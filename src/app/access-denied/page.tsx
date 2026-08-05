import Link from "next/link";
import { getSessionUser, homePathForRole } from "@/features/users/session";

export const dynamic = "force-dynamic";

export default async function AccessDeniedPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const { from } = await searchParams;
  const session = await getSessionUser();
  const home = session ? homePathForRole(session.roleKey) : "/login";

  return (
    <div className="mx-auto max-w-lg rounded-xl border border-[var(--line)] bg-[var(--surface)] p-8">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--danger)]">
        Access denied
      </p>
      <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl text-[var(--ink)]">
        You do not have permission
      </h1>
      <p className="mt-3 text-sm text-[var(--muted)]">
        This page or action is restricted by role-based access control and
        segregation of duties. Navigation hiding is not the only control —
        direct URL access is also blocked.
      </p>
      {from ? (
        <p className="mt-3 rounded-md bg-[var(--bg)] px-3 py-2 font-mono text-xs text-[var(--muted)]">
          Attempted path: {from}
        </p>
      ) : null}
      {session ? (
        <p className="mt-3 text-sm">
          Signed in as <strong>{session.fullName}</strong> ({session.roleName}).
        </p>
      ) : null}
      <Link
        href={home}
        className="mt-6 inline-flex rounded-md bg-[var(--ink)] px-4 py-2.5 text-sm font-semibold text-white"
      >
        Return to your workspace
      </Link>
    </div>
  );
}
