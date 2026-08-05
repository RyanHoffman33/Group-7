import { redirect } from "next/navigation";
import { homePathForRole } from "@/features/users/role-nav";
import { getSessionUser } from "@/features/users/session";

export const dynamic = "force-dynamic";

/** Legacy /home entry — send each role to their My Dashboard. */
export default async function HomePage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  redirect(homePathForRole(user.roleKey));
}
