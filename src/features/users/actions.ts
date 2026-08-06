"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { findUserByEmail } from "@/features/users/directory";
import {
  SESSION_COOKIE,
  authenticateDemo,
  homePathForRole,
  registerCustomerAccount,
  toSessionUser,
  writeSessionCookie,
} from "./session";

export type LoginState = { error?: string } | null;
export type RegisterState =
  | { error?: string; fieldErrors?: Record<string, string> }
  | null;

async function establishSession(email: string, password: string) {
  const result = authenticateDemo(email, password);
  if (!result.ok) {
    return { ok: false as const, error: result.error };
  }
  const session = toSessionUser(result.user);
  await writeSessionCookie(session);
  return {
    ok: true as const,
    roleKey: result.user.roleKey,
    needsIntake: !!result.user.needsIntake,
  };
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
  if (result.needsIntake) {
    redirect("/request");
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

export async function registerAction(
  _prev: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  const fieldErrors: Record<string, string> = {};
  if (!firstName) fieldErrors.firstName = "First name is required.";
  if (!lastName) fieldErrors.lastName = "Last name is required.";
  if (!email) fieldErrors.email = "Email is required.";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    fieldErrors.email = "Enter a valid email address.";
  }
  if (!phone) fieldErrors.phone = "Phone number is required.";
  if (!password) fieldErrors.password = "Password is required.";
  else if (password.length < 6) {
    fieldErrors.password = "Password must be at least 6 characters.";
  }
  if (!confirmPassword) {
    fieldErrors.confirmPassword = "Confirm your password.";
  } else if (password !== confirmPassword) {
    fieldErrors.confirmPassword = "Passwords do not match.";
  }

  if (Object.keys(fieldErrors).length) {
    return { error: "Please correct the highlighted fields.", fieldErrors };
  }

  if (findUserByEmail(email)) {
    return {
      error: "An account with this email already exists. Please sign in instead.",
      fieldErrors: { email: "This email is already registered." },
    };
  }

  const created = registerCustomerAccount({
    firstName,
    lastName,
    email,
    phone,
    password,
  });
  if (!created.ok) {
    return { error: created.error };
  }

  const sessionResult = await establishSession(email, password);
  if (!sessionResult.ok) {
    return {
      error:
        "Account created, but sign-in failed. Please sign in with your new credentials.",
    };
  }
  redirect("/request");
}

export async function logoutAction() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  redirect("/login");
}
