import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { allowedRoutePrefixes, canAccessDashboardPath, homePathForRole } from "@/features/users/role-nav";
import type { AppRole } from "@/features/users/types";

const SESSION_COOKIE = "mainevent_demo_session";

function parseSession(raw: string | undefined): {
  email?: string;
  roleKey?: AppRole;
} | null {
  if (!raw) return null;
  try {
    return JSON.parse(decodeURIComponent(raw)) as {
      email?: string;
      roleKey?: AppRole;
    };
  } catch {
    return null;
  }
}

/**
 * Middleware enforces route allowlists.
 * Role is taken from the cookie for edge speed; pages/actions re-resolve
 * from seed by email so forged roleKey alone cannot elevate privileges.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionRaw = request.cookies.get(SESSION_COOKIE)?.value;
  const parsed = parseSession(sessionRaw);

  const isStaticPublic =
    pathname.startsWith("/_next") ||
    pathname.startsWith("/brand") ||
    pathname === "/favicon.ico";

  const isLogin = pathname === "/login";
  const isAccessDenied = pathname === "/access-denied";

  // API is NOT public — require session + allowlist
  const isApi = pathname.startsWith("/api");

  if (isStaticPublic) return NextResponse.next();

  if (!parsed?.email && !isLogin) {
    if (isApi) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (parsed?.email && isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = homePathForRole(parsed.roleKey ?? "customer");
    return NextResponse.redirect(url);
  }

  if (parsed?.roleKey && !isLogin && !isAccessDenied) {
    const isDashboard =
      pathname === "/dashboard" || pathname.startsWith("/dashboard/");
    if (isDashboard) {
      if (!canAccessDashboardPath(parsed.roleKey, pathname)) {
        const url = request.nextUrl.clone();
        url.pathname = "/access-denied";
        url.searchParams.set("from", pathname);
        return NextResponse.redirect(url);
      }
      return NextResponse.next();
    }

    const allowed = allowedRoutePrefixes(parsed.roleKey);
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
  matcher: ["/((?!_next/static|_next/image|.*\\.(?:png|jpg|jpeg|gif|svg|webp)$).*)"],
};
