import { users } from "@/features/users/seed";
import type { AppUser } from "@/features/users/types";

/** Edge-safe user directory lookup (used by middleware + server auth). */
export function findUserByEmail(email: string): AppUser | undefined {
  const normalized = email.trim().toLowerCase();
  return users.find((u) => u.email.toLowerCase() === normalized);
}
