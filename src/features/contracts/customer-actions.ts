"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/features/users/session";
import { roleHasPermission } from "@/features/access/matrix";
import { addEventType, listEventTypes } from "./event-types";
import {
  ensureCustomerForOrganization,
  listCustomersMerged,
  type DemoCustomer,
} from "./customers-demo";

export async function listEventTypesAction() {
  return listEventTypes();
}

export async function addEventTypeAction(formData: FormData): Promise<{
  ok: boolean;
  error?: string;
  value?: string;
  label?: string;
}> {
  const session = await getSessionUser();
  if (!session) return { ok: false, error: "Sign in required." };
  if (!roleHasPermission(session.roleKey, "contracts.write")) {
    return { ok: false, error: "Not allowed." };
  }
  const label = String(formData.get("label") ?? "");
  const result = addEventType(label);
  if (!result.ok) return { ok: false, error: result.error };
  return {
    ok: true,
    value: result.option.value,
    label: result.option.label,
  };
}

export async function createCustomerAction(formData: FormData): Promise<{
  ok: boolean;
  error?: string;
  customer?: DemoCustomer;
}> {
  const session = await getSessionUser();
  if (!session) return { ok: false, error: "Sign in required." };
  if (!roleHasPermission(session.roleKey, "contracts.write")) {
    return { ok: false, error: "Only contract managers can create customers." };
  }
  const name = String(formData.get("name") ?? "").trim();
  const billingEmail = String(formData.get("billingEmail") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  if (!name) return { ok: false, error: "Customer name is required." };
  if (!billingEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(billingEmail)) {
    return { ok: false, error: "Valid billing email is required." };
  }
  const customer = await ensureCustomerForOrganization({
    name,
    billingEmail,
    phone,
  });
  revalidatePath("/contracts/new");
  revalidatePath("/contracts");
  return { ok: true, customer };
}

export async function listCustomersForCreateAction() {
  return listCustomersMerged();
}
