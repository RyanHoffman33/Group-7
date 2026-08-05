import Link from "next/link";
import { redirect } from "next/navigation";
import { formatCurrency } from "@/features/billing/aging";
import { PageHeader, Panel, StatusPill } from "@/components/billing/ui";
import { FeatureCard, AlertCard } from "@/components/dashboard";
import {
  getOpsEvent,
  listRoomLayouts,
  listVendorAssignments,
  getRoomLayout,
} from "@/features/events/queries";
import { listVendorFacingWork } from "@/features/work/queries";
import { getSessionUser } from "@/features/users/session";

export const dynamic = "force-dynamic";

function statusLabel(status: string): string {
  return status.replace(/_/g, " ");
}

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

  const liveWork = await listVendorFacingWork().catch(() => []);

  return (
    <div>
      <PageHeader
        title="Vendor Portal"
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
          <Panel title="Assigned Event">
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
                <dt className="text-[var(--muted)]">Work Order</dt>
                <dd className="text-right">{assignment.workOrder}</dd>
              </div>
            </dl>
          </Panel>
          <Panel title="Invoice & Completion">
            <ul className="space-y-2 text-sm">
              <li>Invoice: {assignment.invoiceStatus}</li>
              <li>Completion: {assignment.completionStatus}</li>
            </ul>
          </Panel>
        </div>
      ) : null}

      {liveWork.length ? (
        <Panel title="My Live Assignments" className="mb-4" bodyClassName="px-0 py-0">
          <ul>
            {liveWork.map((w) => (
              <li
                key={w.id}
                className="flex flex-wrap items-start justify-between gap-2 border-b border-[var(--line)] px-4 py-3 last:border-0"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{w.title}</p>
                  <p className="text-[12px] text-[var(--muted)]">
                    {w.event_name ?? "Event"}
                    {w.location ? ` · ${w.location}` : ""}
                  </p>
                  <p className="mt-1 text-[11px] text-[var(--muted)]">
                    Status:{" "}
                    <span className="font-medium capitalize text-[var(--ink)]">
                      {statusLabel(w.status)}
                    </span>
                    {w.invoice_ref
                      ? ` · Invoice ${w.invoice_ref}${
                          w.cost_amount != null
                            ? ` (${formatCurrency(w.cost_amount)})`
                            : ""
                        }`
                      : " · Invoice not submitted"}
                  </p>
                </div>
                <StatusPill
                  tone={
                    w.status === "completed"
                      ? "ok"
                      : w.status === "checked_in"
                        ? "accent"
                        : "neutral"
                  }
                >
                  {statusLabel(w.status)}
                </StatusPill>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      <p className="mb-2 text-sm font-semibold">Room Layouts</p>
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
            actionLabel="Open Planner"
            href={`/vendor/layouts/${layout.id}`}
          />
        ))}
      </div>

      {session.roleKey === "project_manager" ? (
        <p className="mt-4 text-sm text-[var(--muted)]">
          PM view — approve layouts from the planner.{" "}
          <Link className="text-[var(--accent)] hover:underline" href="/events/evt-ops-1">
            Back to Event
          </Link>
        </p>
      ) : null}
    </div>
  );
}
