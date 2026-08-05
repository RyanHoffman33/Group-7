import { redirect } from "next/navigation";
import Link from "next/link";
import {
  buildFallbackInsights,
  getAnalyticsBundle,
} from "@/features/analytics/queries";
import { getSessionUser } from "@/features/users/session";
import { roleHasPermission } from "@/features/access/matrix";
import { PageHeader } from "@/components/billing/ui";
import { ProjectionsClient } from "@/components/analytics/ProjectionsClient";

export const dynamic = "force-dynamic";

export default async function AnalyticsProjectionsPage() {
  const session = await getSessionUser();
  if (!session) redirect("/login");
  if (!roleHasPermission(session.roleKey, "analytics.read")) {
    redirect("/access-denied?from=/analytics/projections");
  }

  const bundle = await getAnalyticsBundle();
  const insights = buildFallbackInsights(bundle);

  return (
    <div>
      <PageHeader
        title="Analytics · Projections"
        description="Forward-looking revenue and cost projections from a trend/seasonal model, with scenario stress and AI commentary."
      />
      <p className="mb-4 text-xs text-[var(--muted)]">
        <Link href="/analytics" className="text-[var(--accent)] hover:underline">
          ← Analytics Center
        </Link>
      </p>
      <ProjectionsClient
        history={bundle.history}
        initialForecast={bundle.forecast}
        initialInsights={insights}
        method={bundle.forecast.method}
        source={bundle.source}
      />
    </div>
  );
}
