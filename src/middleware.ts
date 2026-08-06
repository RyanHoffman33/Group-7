import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  allowedRoutePrefixes,
  canAccessDashboardPath,
  homePathForRole,
  notificationsPathForRole,
} from "@/features/users/role-nav";
import { findUserByEmail } from "@/features/users/directory";
import type { AppRole } from "@/features/users/types";

const SESSION_COOKIE = "mainevent_demo_session";

function parseSession(raw: string | undefined): {
  email?: string;
  roleKey?: AppRole;
  needsIntake?: boolean;
} | null {
  if (!raw) return null;
  try {
    return JSON.parse(decodeURIComponent(raw)) as {
      email?: string;
      roleKey?: AppRole;
      needsIntake?: boolean;
    };
  } catch {
    return null;
  }
}

/**
 * Resolve role from seeded account email — never trust cookie roleKey alone
 * for privileged roles. Self-registered customers may exist only in the Node
 * process memory, so Edge middleware accepts cookie roleKey === "customer"
 * when the email is not yet visible in this isolate.
 */
function roleFromSession(parsed: {
  email?: string;
  roleKey?: AppRole;
}): AppRole | null {
  if (!parsed.email) return null;
  const user = findUserByEmail(parsed.email);
  if (user) {
    if (user.status === "disabled") return null;
    return user.roleKey;
  }
  if (parsed.roleKey === "customer") {
    return "customer";
  }
  return null;
}

/**
 * Middleware enforces route allowlists.
 * Role is always re-resolved from the demo user directory by email so a
 * forged cookie roleKey cannot elevate privileges at the edge.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionRaw = request.cookies.get(SESSION_COOKIE)?.value;
  const parsed = parseSession(sessionRaw);
  const roleKey = parsed ? roleFromSession(parsed) : null;

  const isStaticPublic =
    pathname.startsWith("/_next") ||
    pathname.startsWith("/brand") ||
    pathname === "/favicon.ico";

  const isLogin = pathname === "/login";
  const isRegister = pathname === "/register";
  const isPublicAuth = isLogin || isRegister;
  const isAccessDenied = pathname === "/access-denied";

  const isApi = pathname.startsWith("/api");

  if (isStaticPublic) return NextResponse.next();

  if (pathname === "/") {
    const url = request.nextUrl.clone();
    if (roleKey) {
      url.pathname =
        parsed?.needsIntake && roleKey === "customer"
          ? "/request"
          : homePathForRole(roleKey);
    } else {
      url.pathname = "/login";
    }
    return NextResponse.redirect(url);
  }

  if (!parsed?.email && !isPublicAuth) {
    if (isApi) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Cookie present but email not in directory / disabled
  if (parsed?.email && !roleKey && !isPublicAuth) {
    if (isApi) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (parsed?.email && roleKey && isPublicAuth) {
    const url = request.nextUrl.clone();
    url.pathname =
      parsed.needsIntake && roleKey === "customer"
        ? "/request"
        : homePathForRole(roleKey);
    return NextResponse.redirect(url);
  }

  // New self-registered customers finish intake before the customer dashboard.
  if (
    roleKey === "customer" &&
    parsed?.needsIntake &&
    !pathname.startsWith("/request") &&
    !isAccessDenied
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/request";
    return NextResponse.redirect(url);
  }

  if (roleKey && !isPublicAuth && !isAccessDenied) {
    const isDashboard =
      pathname === "/dashboard" || pathname.startsWith("/dashboard/");
    if (isDashboard) {
      if (!canAccessDashboardPath(roleKey, pathname)) {
        const url = request.nextUrl.clone();
        url.pathname = "/access-denied";
        url.searchParams.set("from", pathname);
        return NextResponse.redirect(url);
      }
      return NextResponse.next();
    }

    const notif = notificationsPathForRole(roleKey);
    if (
      pathname === "/notifications" ||
      pathname.startsWith("/notifications/")
    ) {
      if (notif !== "/notifications") {
        const url = request.nextUrl.clone();
        url.pathname = "/access-denied";
        url.searchParams.set("from", pathname);
        return NextResponse.redirect(url);
      }
      return NextResponse.next();
    }

    const allowed = allowedRoutePrefixes(roleKey);
    const ok = allowed.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    );
    if (!ok) {
      if (isApi) {
        return NextResponse.json(
          { error: "Access denied for your role." },
          { status: 403 },
        );
      }
      const url = request.nextUrl.clone();
      url.pathname = "/access-denied";
      url.searchParams.set("from", pathname);
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|.*\\.(?:png|jpg|jpeg|gif|svg|webp)$).*)",
  ],
};
