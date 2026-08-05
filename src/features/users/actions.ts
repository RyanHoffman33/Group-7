"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  SESSION_COOKIE,
  authenticateDemo,
  homePathForRole,
  toSessionUser,
} from "./session";

export type LoginState = { error?: string } | null;

async function establishSession(email: string, password: string) {
  const result = authenticateDemo(email, password);
  if (!result.ok) {
    return { ok: false as const, error: result.error };
  }
  const session = toSessionUser(result.user);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, encodeURIComponent(JSON.stringify(session)), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return { ok: true as const, roleKey: result.user.roleKey };
}

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const result = await establishSession(email, password);
  if (!result.ok) {
    return { error: result.error };
  }
  redirect(homePathForRole(result.roleKey));
}

/** Demo account quick-open from login list. */
export async function loginAsEmailFormAction(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "");
  const result = await establishSession(email, "demo");
  if (!result.ok) {
    redirect("/login");
  }
  redirect(homePathForRole(result.roleKey));
}

export async function logoutAction() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  redirect("/login");
}
