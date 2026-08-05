import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader, Panel, StatusPill } from "@/components/billing/ui";
import { FeatureCard, AlertCard } from "@/components/dashboard";
import {
  getOpsEvent,
  listRoomLayouts,
  listVendorAssignments,
  getRoomLayout,
} from "@/features/events/queries";
import { getSessionUser } from "@/features/users/session";

export const dynamic = "force-dynamic";

export default async function VendorPortalPage() {
  const session = await getSessionUser();
  if (!session) redirect("/login");
  if (
    !["vendor", "project_manager", "system_admin"].includes(session.roleKey)
  ) {
    redirect("/home");
  }

  const vendorId =
    session.roleKey === "vendor" ? session.id : "usr-vendor";
  const assignments = await listVendorAssignments(
    session.roleKey === "vendor" ? vendorId : undefined,
  );
  const assignment = assignments[0];
  const event = assignment
    ? await getOpsEvent(assignment.eventId)
    : undefined;
  const layouts = assignment
    ? await listRoomLayouts(assignment.eventId)
    : await listRoomLayouts();

  const layoutRows = await Promise.all(
    layouts.map(async (l) => {
      const detail = await getRoomLayout(l.id);
      return { layout: l, current: detail?.current };
    }),
  );

  return (
    <div>
      <PageHeader
        title="Vendor portal"
        description={`Welcome, ${session.fullName}. Assigned work and room layouts only — no internal P&L.`}
      />
      {assignment && layoutRows.some((r) => r.current?.status === "pending_approval") ? (
        <div className="mb-4">
          <AlertCard
            tone="warn"
            title="Layout awaiting approval"
            body="A banquet alternative is pending PM review and shows a capacity warning."
          />
        </div>
      ) : null}

      {assignment && event ? (
        <div className="mb-4 grid gap-4 lg:grid-cols-2">
          <Panel title="Assigned event">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-[var(--muted)]">Event</dt>
                <dd>{event.name}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[var(--muted)]">Arrival</dt>
                <dd>{assignment.arrivalTime}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[var(--muted)]">Load-in</dt>
                <dd>{assignment.loadIn}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[var(--muted)]">Contact</dt>
                <dd>{assignment.contact}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[var(--muted)]">Work order</dt>
                <dd className="text-right">{assignment.workOrder}</dd>
              </div>
            </dl>
          </Panel>
          <Panel title="Invoice & completion">
            <ul className="space-y-2 text-sm">
              <li>Invoice: {assignment.invoiceStatus}</li>
              <li>Completion: {assignment.completionStatus}</li>
            </ul>
          </Panel>
        </div>
      ) : null}

      <p className="mb-2 text-sm font-semibold">Room layouts</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {layoutRows.map(({ layout, current }) => (
          <FeatureCard
            key={layout.id}
            title={layout.roomName}
            description={`${layout.layoutType} · capacity ${layout.capacity}${
              current
                ? ` · v${current.version} ${current.status.replace("_", " ")}`
                : ""
            }`}
            actionLabel="Open planner"
            href={`/vendor/layouts/${layout.id}`}
          />
        ))}
      </div>

      {session.roleKey === "project_manager" ? (
        <p className="mt-4 text-sm text-[var(--muted)]">
          PM view — approve layouts from the planner.{" "}
          <Link className="text-[var(--accent)] hover:underline" href="/events/evt-ops-1">
            Back to event
          </Link>
        </p>
      ) : null}

      <div className="mt-4">
        <StatusPill tone="neutral">Seed demo — not applied to shared Supabase</StatusPill>
      </div>
    </div>
  );
}
