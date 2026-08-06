import { redirect } from "next/navigation";
import {
  homePathForRole,
  notificationsPathForRole,
} from "@/features/users/role-nav";
import { getSessionUser } from "@/features/users/session";

export const dynamic = "force-dynamic";

/** Legacy /dashboard — send roles to Notifications Center (or home). */
export default async function LegacyDashboardRedirect() {
  const session = await getSessionUser();
  if (!session) redirect("/login");
  redirect(
    notificationsPathForRole(session.roleKey) ??
      homePathForRole(session.roleKey),
  );
}
