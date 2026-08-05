import { redirect } from "next/navigation";
import { getAnalyticsBundle } from "@/features/analytics/queries";
import { getSessionUser } from "@/features/users/session";
import { roleHasPermission } from "@/features/access/matrix";
import { AnalyticsCenterClient } from "@/components/analytics/AnalyticsCenterClient";

export const dynamic = "force-dynamic";

export default async function AnalyticsCenterPage() {
  const session = await getSessionUser();
  if (!session) redirect("/login");
  if (!roleHasPermission(session.roleKey, "analytics.read")) {
    redirect("/access-denied?from=/analytics");
  }

  const bundle = await getAnalyticsBundle();

  return (
    <AnalyticsCenterClient
      bundle={bundle}
      showProfitabilityLinks={roleHasPermission(
        session.roleKey,
        "profitability.read",
      )}
    />
  );
}
