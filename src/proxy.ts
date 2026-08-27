import { NextRequest, NextResponse } from "next/server";
import { config as appConfig } from "@/lib/config";
import { verifySession } from "@/lib/auth/jwt";

const ROLE_PREFIXES: Record<string, "CUSTOMER" | "OWNER" | "ADMIN"> = {
  "/dashboard": "CUSTOMER",
  "/owner": "OWNER",
  "/admin": "ADMIN",
};

// Proxy (formerly "middleware") only checks that a validly signed session
// cookie with the right role prefix exists before letting the request
// through. Route handlers and server components still call
// requireUser()/requireRole() from lib/auth/session.ts for the authoritative
// check (fresh user row, isActive flag, real role) — this is a fast
// redirect for the common case, not the sole authorization boundary.
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const matchedPrefix = Object.keys(ROLE_PREFIXES).find(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  if (!matchedPrefix) return NextResponse.next();

  const token = request.cookies.get(appConfig.auth.sessionCookieName)?.value;
  const session = token ? await verifySession(token) : null;

  if (!session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const requiredRole = ROLE_PREFIXES[matchedPrefix];
  if (session.role !== requiredRole) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = { matcher: ["/dashboard/:path*", "/owner/:path*", "/admin/:path*"] };
