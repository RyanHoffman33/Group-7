import { redirect } from "next/navigation";
import { getSessionAppUser } from "@/features/users/session";
import RequestFormClient from "./RequestFormClient";

export default async function RequestPage() {
  const user = await getSessionAppUser();
  if (!user) {
    redirect("/login");
  }
  if (user.roleKey !== "customer") {
    redirect("/access-denied?from=/request");
  }

  return (
    <RequestFormClient
      contactName={user.fullName}
      contactEmail={user.email}
      contactPhone={user.phone ?? ""}
    />
  );
}
