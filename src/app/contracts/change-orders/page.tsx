import { redirect } from "next/navigation";

/** Legacy change-orders URL → unified Contract Changes. */
export default function ChangeOrdersRedirectPage() {
  redirect("/contracts/changes");
}
