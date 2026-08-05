import { redirect } from "next/navigation";
import { listOpsEvents } from "@/features/events/queries";
import { getSessionUser } from "@/features/users/session";

export const dynamic = "force-dynamic";

/** Stable Event Hub entry — opens the first available ops event. */
export default async function EventHubEntryPage() {
  const session = await getSessionUser();
  if (!session) redirect("/login");
  const events = await listOpsEvents();
  const first = events[0];
  if (!first) redirect("/events");
  redirect(`/events/${first.id}`);
}
