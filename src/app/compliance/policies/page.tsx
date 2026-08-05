import { listGaapPolicies } from "@/features/gaap/queries";
import { PageHeader, Panel } from "@/components/billing/ui";

export const dynamic = "force-dynamic";

export default async function PoliciesPage() {
  const policies = await listGaapPolicies();

  return (
    <div>
      <PageHeader
        title="GAAP policy register"
        description="Short, business-readable MainEvent rules mapped to ASC references — evaluator-friendly answers for each assignment topic."
      />

      <div className="grid gap-4 md:grid-cols-2">
        {policies.map((p) => (
          <Panel key={p.id} title={p.topic}>
            <p className="text-xs font-medium uppercase tracking-wider text-[var(--accent)]">
              {p.asc_reference}
            </p>
            <p className="mt-3 text-sm leading-relaxed text-[var(--ink)]">
              {p.mainevent_rule}
            </p>
            <p className="mt-4 border-t border-[var(--line)] pt-3 text-xs text-[var(--muted)]">
              <span className="font-semibold text-[var(--ink)]">
                Evidence required:{" "}
              </span>
              {p.evidence_required}
            </p>
          </Panel>
        ))}
      </div>
    </div>
  );
}
