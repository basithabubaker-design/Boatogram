import "server-only";
import { cookies } from "next/headers";
import { config } from "@/lib/config";
import { signSession, verifySession, type SessionPayload } from "@/lib/auth/jwt";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/generated/prisma/enums";

export async function createSession(payload: SessionPayload) {
  const token = await signSession(payload);
  const store = await cookies();
  store.set(config.auth.sessionCookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: config.auth.sessionTtlSeconds,
  });
}

export async function destroySession() {
  const store = await cookies();
  store.delete(config.auth.sessionCookieName);
}

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(config.auth.sessionCookieName)?.value;
  if (!token) return null;
  return verifySession(token);
}

/** Loads the current session and re-fetches the live user row, so a
 * deactivated account or role change takes effect without waiting for the
 * session to expire. Returns null when unauthenticated or inactive. */
export async function getCurrentUser() {
  const session = await getSession();
  if (!session) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    include: { ownerProfile: true },
  });
  if (!user || !user.isActive) return null;
  return user;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new AuthError("Not authenticated");
  return user;
}

export async function requireRole(...roles: Role[]) {
  const user = await requireUser();
  if (!roles.includes(user.role)) {
    throw new AuthError("Not authorized");
  }
  return user;
}

export class AuthError extends Error {}
