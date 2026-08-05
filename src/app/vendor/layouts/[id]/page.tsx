import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/billing/ui";
import { RoomLayoutPlannerClient } from "@/components/vendor/RoomLayoutPlannerClient";
import { getRoomLayout } from "@/features/events/queries";
import { getSessionUser } from "@/features/users/session";

export const dynamic = "force-dynamic";

export default async function VendorLayoutPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSessionUser();
  if (!session) redirect("/login");
  if (
    !["vendor", "project_manager", "system_admin"].includes(session.roleKey)
  ) {
    redirect("/home");
  }

  const detail = await getRoomLayout(id);
  if (!detail?.current) notFound();

  if (
    session.roleKey === "vendor" &&
    detail.layout.vendorUserId !== session.id
  ) {
    redirect("/vendor");
  }

  const canEdit = ["vendor", "system_admin"].includes(session.roleKey);
  const canApprove = ["project_manager", "system_admin"].includes(
    session.roleKey,
  );

  return (
    <div>
      <div className="mb-2">
        <Link href="/vendor" className="text-sm text-[var(--accent)] hover:underline">
          ← Vendor portal
        </Link>
      </div>
      <PageHeader
        title="Room layout planner"
        description="Drag objects on the canvas, save versions, and submit for PM approval. Capacity warnings are advisory."
      />
      <RoomLayoutPlannerClient
        layout={detail.layout}
        versions={detail.versions}
        current={detail.current}
        actor={session.fullName}
        canEdit={canEdit}
        canApprove={canApprove}
      />
    </div>
  );
}
