import { createHash } from "crypto";
import { cookies } from "next/headers";
import { DEMO_PASSWORD, roles, users } from "@/features/users/seed";
import { findUserByEmail } from "@/features/users/directory";
import {
  findRegisteredByEmail,
  updateRegisteredUser,
  upsertRegisteredUser,
} from "@/features/users/registered-store";
import type { AppUser, SessionUser } from "@/features/users/types";

export { homePathForRole, navSectionsForRole, notificationsPathForRole } from "@/features/users/role-nav";
export type { NavSection } from "@/features/users/role-nav";
export { findUserByEmail } from "@/features/users/directory";

export const SESSION_COOKIE = "mainevent_demo_session";

export function hashPassword(password: string): string {
  return createHash("sha256")
    .update(`mainevent-demo:${password}`)
    .digest("hex");
}

/** Seed directory + persisted self-registered customers (Node only). */
export function findAuthUser(email: string): AppUser | undefined {
  return findUserByEmail(email) ?? findRegisteredByEmail(email);
}

function syncRegisteredIntoMemory(user: AppUser) {
  if (!users.some((u) => u.email.toLowerCase() === user.email.toLowerCase())) {
    users.push(user);
  }
}

export function authenticateDemo(
  email: string,
  password: string,
): { ok: true; user: AppUser } | { ok: false; error: string } {
  const user = findAuthUser(email);
  if (!user) {
    return { ok: false, error: "No account found for that email." };
  }
  if (user.status === "disabled") {
    return { ok: false, error: "This account is disabled." };
  }

  const passwordOk =
    (user.passwordHash
      ? user.passwordHash === hashPassword(password)
      : password === user.demoPassword) ||
    (!user.passwordHash && password === DEMO_PASSWORD);

  if (!passwordOk) {
    return { ok: false, error: "Incorrect email or password." };
  }

  if (user.passwordHash) {
    syncRegisteredIntoMemory(user);
  }
  return { ok: true, user };
}

export function registerCustomerAccount(input: {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
}): { ok: true; user: AppUser } | { ok: false; error: string } {
  const email = input.email.trim().toLowerCase();
  if (findAuthUser(email)) {
    return {
      ok: false,
      error: "An account with this email already exists. Please sign in instead.",
    };
  }

  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  const phone = input.phone.trim();
  if (!firstName || !lastName || !email || !phone || !input.password) {
    return { ok: false, error: "All fields are required." };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Enter a valid email address." };
  }
  if (input.password.length < 6) {
    return { ok: false, error: "Password must be at least 6 characters." };
  }

  const user: AppUser = {
    id: `usr-reg-${Date.now()}`,
    fullName: `${firstName} ${lastName}`,
    firstName,
    lastName,
    email,
    phone,
    demoPassword: "",
    passwordHash: hashPassword(input.password),
    roleKey: "customer",
    status: "active",
    organization: "Self-registered client",
    lastLoginAt: new Date().toISOString(),
    createdAt: new Date().toISOString().slice(0, 10),
    needsIntake: true,
  };
  users.push(user);
  upsertRegisteredUser(user);
  return { ok: true, user };
}

export function toSessionUser(user: AppUser): SessionUser {
  const role = roles.find((r) => r.key === user.roleKey);
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    roleKey: user.roleKey,
    roleName: role?.name ?? user.roleKey,
    organization: user.organization,
    needsIntake: !!user.needsIntake,
  };
}

export async function writeSessionCookie(session: SessionUser) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, encodeURIComponent(JSON.stringify(session)), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearNeedsIntake(userId: string) {
  const seeded = users.find((u) => u.id === userId);
  if (seeded) seeded.needsIntake = false;
  const updated = updateRegisteredUser(userId, { needsIntake: false });

  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE)?.value;
  if (!raw) return;
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as SessionUser;
    if (
      parsed.id === userId ||
      parsed.email === seeded?.email ||
      parsed.email === updated?.email
    ) {
      parsed.needsIntake = false;
      await writeSessionCookie(parsed);
    }
  } catch {
    /* ignore */
  }
}

/**
 * Resolve the signed-in user. Seed + registered file store, with cookie
 * fallback for customer so self-registration always stays signed in.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as SessionUser;
    if (!parsed?.email || !parsed?.roleKey) return null;

    const user = findAuthUser(parsed.email);
    if (user) {
      if (user.status === "disabled") return null;
      if (user.passwordHash) syncRegisteredIntoMemory(user);
      return toSessionUser(user);
    }

    // Cookie-only customer (Edge/HMR gap) — still treat as signed in
    if (parsed.roleKey === "customer" && parsed.id) {
      return {
        id: parsed.id,
        email: parsed.email,
        fullName: parsed.fullName || parsed.email,
        roleKey: "customer",
        roleName: parsed.roleName || "Customer",
        organization: parsed.organization || "Self-registered client",
        needsIntake: !!parsed.needsIntake,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export async function getSessionAppUser(): Promise<AppUser | null> {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as SessionUser;
    if (!parsed?.email) return null;

    const user = findAuthUser(parsed.email);
    if (user) {
      if (user.status === "disabled") return null;
      if (user.passwordHash) syncRegisteredIntoMemory(user);
      return user;
    }

    if (parsed.roleKey === "customer" && parsed.id) {
      return {
        id: parsed.id,
        fullName: parsed.fullName || parsed.email,
        email: parsed.email,
        phone: "",
        demoPassword: "",
        roleKey: "customer",
        status: "active",
        organization: parsed.organization || "Self-registered client",
        lastLoginAt: null,
        createdAt: new Date().toISOString().slice(0, 10),
        needsIntake: !!parsed.needsIntake,
      };
    }
    return null;
  } catch {
    return null;
  }
}
