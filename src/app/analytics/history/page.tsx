import { redirect } from "next/navigation";
import { getAnalyticsBundle } from "@/features/analytics/queries";
import { getSessionUser } from "@/features/users/session";
import { roleHasPermission } from "@/features/access/matrix";
import { AnalyticsHistoryClient } from "@/components/analytics/AnalyticsHistoryClient";

export const dynamic = "force-dynamic";

export default async function AnalyticsHistoryPage() {
  const session = await getSessionUser();
  if (!session) redirect("/login");
  if (!roleHasPermission(session.roleKey, "analytics.read")) {
    redirect("/access-denied?from=/analytics/history");
  }

  const bundle = await getAnalyticsBundle();

  return (
    <AnalyticsHistoryClient history={bundle.history} source={bundle.source} />
  );
}
