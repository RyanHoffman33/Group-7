import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import type { AppUser } from "@/features/users/types";

const DATA_DIR = path.join(process.cwd(), ".data");
const STORE_PATH = path.join(DATA_DIR, "registered-users.json");

function ensureDir() {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

/** Load self-registered customers from disk (survives HMR / worker restarts). */
export function loadRegisteredUsers(): AppUser[] {
  try {
    if (!existsSync(STORE_PATH)) return [];
    const raw = readFileSync(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as AppUser[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveRegisteredUsers(list: AppUser[]) {
  ensureDir();
  writeFileSync(STORE_PATH, JSON.stringify(list, null, 2), "utf8");
}

export function findRegisteredByEmail(email: string): AppUser | undefined {
  const normalized = email.trim().toLowerCase();
  return loadRegisteredUsers().find(
    (u) => u.email.toLowerCase() === normalized,
  );
}

export function upsertRegisteredUser(user: AppUser) {
  const list = loadRegisteredUsers();
  const idx = list.findIndex(
    (u) => u.email.toLowerCase() === user.email.toLowerCase(),
  );
  if (idx >= 0) list[idx] = user;
  else list.push(user);
  saveRegisteredUsers(list);
}

export function updateRegisteredUser(
  userId: string,
  patch: Partial<AppUser>,
): AppUser | null {
  const list = loadRegisteredUsers();
  const idx = list.findIndex((u) => u.id === userId);
  if (idx < 0) return null;
  list[idx] = { ...list[idx], ...patch };
  saveRegisteredUsers(list);
  return list[idx];
}
