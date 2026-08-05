import { redirect } from "next/navigation";
import { CustomerPortalProvider } from "@/components/dashboard/CustomerPortalContext";
import { CustomerPortalShell } from "@/components/dashboard/CustomerPortalShell";
import { getSessionUser } from "@/features/users/session";

export const dynamic = "force-dynamic";

export default async function CustomerPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSessionUser();
  if (!session) redirect("/login");
  if (session.roleKey !== "customer") {
    redirect("/access-denied?from=/dashboard/customer");
  }

  return (
    <CustomerPortalProvider
      fullName={session.fullName}
      organization={session.organization}
    >
      <CustomerPortalShell>{children}</CustomerPortalShell>
    </CustomerPortalProvider>
  );
}
