import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/features/users/session";
import { roleHasPermission } from "@/features/access/matrix";
import { getEventRequestById } from "@/features/requests/actions";
import { RequestDetailClient } from "./RequestDetailClient";

export const dynamic = "force-dynamic";

export default async function RequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSessionUser();
  if (!session) redirect("/login");
  if (!roleHasPermission(session.roleKey, "contracts.read")) {
    redirect("/access-denied?from=/contracts/requests");
  }
  const { id } = await params;
  const request = await getEventRequestById(id);
  if (!request) notFound();

  return (
    <RequestDetailClient
      request={request}
      canWrite={roleHasPermission(session.roleKey, "contracts.write")}
    />
  );
}
