import { redirect } from "next/navigation";
import { listOpsEvents } from "@/features/events/queries";
import { getSessionUser } from "@/features/users/session";
import { listSpeakers } from "@/features/events/queries";

export const dynamic = "force-dynamic";

/** Prefer an ops event that has content (speakers), else first upcoming. */
export default async function EventHubEntryPage() {
  const session = await getSessionUser();
  if (!session) redirect("/login");
  const events = await listOpsEvents();
  if (!events.length) redirect("/events");

  let preferred = events.find((e) => e.id === "evt-ops-1");
  if (!preferred) {
    for (const e of events) {
      const speakers = await listSpeakers(e.id);
      if (speakers.length > 0) {
        preferred = e;
        break;
      }
    }
  }
  const target = preferred ?? events.find((e) => e.status === "upcoming") ?? events[0];
  redirect(`/events/${target.id}`);
}
