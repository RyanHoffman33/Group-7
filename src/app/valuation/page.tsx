import { redirect } from "next/navigation";
import { getSessionUser } from "@/features/users/session";
import { roleHasPermission } from "@/features/access/matrix";
import { ValuationToolClient } from "@/components/valuation/ValuationToolClient";
import { listValuationCases } from "@/features/valuation/actions";

export const dynamic = "force-dynamic";

export default async function ValuationPage({
  searchParams,
}: {
  searchParams: Promise<{
    contractId?: string;
    requestId?: string;
    guests?: string;
    eventType?: string;
    estimate?: string;
  }>;
}) {
  const session = await getSessionUser();
  if (!session) redirect("/login");
  if (!roleHasPermission(session.roleKey, "contracts.read")) {
    redirect("/access-denied?from=/valuation");
  }

  const sp = await searchParams;
  const cases = await listValuationCases();

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <ValuationToolClient
        initialEventType={sp.eventType || "corporate_conference"}
        initialGuests={sp.guests ? Number(sp.guests) : 150}
        initialEstimate={sp.estimate || ""}
        contractId={sp.contractId || null}
        requestId={sp.requestId || null}
      />

      {cases.length ? (
        <section className="mt-10">
          <h2 className="font-[family-name:var(--font-display)] text-xl text-[var(--ink)]">
            Saved cases
          </h2>
          <ul className="mt-4 space-y-2">
            {cases.map((c) => (
              <li
                key={c.id}
                className="rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-sm"
              >
                <span className="font-medium">{c.eventName}</span>
                <span className="text-[var(--muted)]">
                  {" "}
                  · {c.eventType} · {c.guests} guests · mid $
                  {c.recommendation.totalMid.toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
