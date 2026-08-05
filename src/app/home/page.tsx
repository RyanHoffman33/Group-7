import { redirect } from "next/navigation";
import {
  AccountingDashboard,
  AdminDashboard,
  CoordinatorDashboard,
  CustomerDashboard,
  DepartmentManagerDashboard,
  ExecutiveDashboard,
  ProjectManagerDashboard,
} from "@/components/users/RoleDashboards";
import { listEventHealth } from "@/features/users/queries";
import { getSessionUser } from "@/features/users/session";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  if (user.roleKey === "attendee") {
    redirect("/attendee");
  }
  if (user.roleKey === "vendor") {
    redirect("/vendor");
  }

  const events = await listEventHealth();
  const customerEvent =
    events.find((e) => e.id === "eh-3") ?? events[0];

  switch (user.roleKey) {
    case "executive":
      return <ExecutiveDashboard user={user} events={events} />;
    case "project_manager":
      return <ProjectManagerDashboard user={user} events={events} />;
    case "event_coordinator":
      return <CoordinatorDashboard user={user} />;
    case "accounting":
      return <AccountingDashboard user={user} />;
    case "customer":
      return <CustomerDashboard user={user} event={customerEvent} />;
    case "department_manager":
      return <DepartmentManagerDashboard user={user} />;
    case "system_admin":
      return <AdminDashboard user={user} events={events} />;
    default:
      return <AdminDashboard user={user} events={events} />;
  }
}
