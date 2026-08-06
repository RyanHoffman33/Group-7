import { cookies } from "next/headers";
import { DEMO_PASSWORD, roles, users } from "@/features/users/seed";
import type { AppUser, SessionUser } from "@/features/users/types";

export { homePathForRole, navSectionsForRole, notificationsPathForRole } from "@/features/users/role-nav";
export type { NavSection } from "@/features/users/role-nav";

export const SESSION_COOKIE = "mainevent_demo_session";

export function findUserByEmail(email: string): AppUser | undefined {
  const normalized = email.trim().toLowerCase();
  return users.find((u) => u.email.toLowerCase() === normalized);
}

export function authenticateDemo(
  email: string,
  password: string,
): { ok: true; user: AppUser } | { ok: false; error: string } {
  const user = findUserByEmail(email);
  if (!user) {
    return { ok: false, error: "No account found for that email." };
  }
  if (user.status === "disabled") {
    return { ok: false, error: "This account is disabled." };
  }
  if (password !== user.demoPassword && password !== DEMO_PASSWORD) {
    return { ok: false, error: "Incorrect password. Use demo for all demo accounts." };
  }
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
  };
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as SessionUser;
    if (!parsed?.email || !parsed?.roleKey) return null;
    const user = findUserByEmail(parsed.email);
    if (!user || user.status === "disabled") return null;
    return toSessionUser(user);
  } catch {
    return null;
  }
}
