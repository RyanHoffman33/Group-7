import { listGaapPolicies } from "@/features/gaap/queries";
import { controls, type Control } from "@/features/controls/registry";
import { getControlEvidence } from "@/features/controls/evidence";
import { PageHeader, Panel, StatusPill } from "@/components/billing/ui";

export const dynamic = "force-dynamic";

const assertionLabel: Record<string, string> = {
  existence: "Existence",
  completeness: "Completeness",
  accuracy: "Accuracy",
  cutoff: "Cutoff",
  valuation: "Valuation",
};

function ControlCard({
  control,
  evidence,
}: {
  control: Control;
  evidence?: { label: string; tone: "ok" | "warn" | "danger" };
}) {
  return (
    <Panel title={control.name}>
      <div className="flex flex-wrap items-center gap-1.5">
        <StatusPill tone="accent">{control.category}</StatusPill>
        {control.assertions.map((a) => (
          <StatusPill key={a} tone="neutral">
            {assertionLabel[a]}
          </StatusPill>
        ))}
        {evidence ? (
          <StatusPill tone={evidence.tone}>Live: {evidence.label}</StatusPill>
        ) : null}
      </div>
      <p className="mt-3 text-sm leading-relaxed text-[var(--ink)]">
        {control.plainEnglish}
      </p>
      <p className="mt-4 border-t border-[var(--line)] pt-3 text-xs text-[var(--muted)]">
        <span className="font-semibold text-[var(--ink)]">Risk: </span>
        {control.risk}
      </p>
      <p className="mt-2 text-xs text-[var(--muted)]">
        <span className="font-semibold text-[var(--ink)]">Enforced at: </span>
        {control.enforcement
          .map((e) => `${e.point} (${e.mechanism})`)
          .join(" · ")}
      </p>
      {control.alsoSupports && control.alsoSupports.length > 0 ? (
        <p className="mt-2 text-xs text-[var(--muted)]">
          <span className="font-semibold text-[var(--ink)]">
            Also supports:{" "}
          </span>
          {control.alsoSupports.join("; ")}
        </p>
      ) : null}
    </Panel>
  );
}

export default async function ControlsPage() {
  const [policies, evidence] = await Promise.all([
    listGaapPolicies(),
    getControlEvidence(),
  ]);
  const byPrimary = new Map<string, Control[]>();
  for (const c of controls) {
    if (!c.primaryPolicy) continue;
    const list = byPrimary.get(c.primaryPolicy) ?? [];
    list.push(c);
    byPrimary.set(c.primaryPolicy, list);
  }
  const crossCutting = controls.filter((c) => !c.primaryPolicy);

  return (
    <div>
      <PageHeader
        title="Controls"
        description="How each GAAP policy is enforced in the system, in plain English, with live enforcement evidence where observable. The rules themselves live under Policies. Read-only."
      />

      <div className="space-y-6">
        {policies
          .filter((p) => (byPrimary.get(p.topic) ?? []).length > 0)
          .map((p) => (
            <section key={p.topic}>
              <h3 className="mb-3 text-sm font-semibold text-[var(--ink)]">
                {p.topic}{" "}
                <span className="font-normal text-[var(--muted)]">
                  · {p.asc_reference}
                </span>
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                {(byPrimary.get(p.topic) ?? []).map((c) => (
                  <ControlCard
                    key={c.id}
                    control={c}
                    evidence={c.evidenceKey ? evidence[c.evidenceKey] : undefined}
                  />
                ))}
              </div>
            </section>
          ))}

        {crossCutting.length > 0 ? (
          <section>
            <h3 className="mb-3 text-sm font-semibold text-[var(--ink)]">
              Cross-cutting controls{" "}
              <span className="font-normal text-[var(--muted)]">
                · not tied to a single policy
              </span>
            </h3>
            <div className="grid gap-4 md:grid-cols-2">
              {crossCutting.map((c) => (
                <ControlCard
                  key={c.id}
                  control={c}
                  evidence={c.evidenceKey ? evidence[c.evidenceKey] : undefined}
                />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
