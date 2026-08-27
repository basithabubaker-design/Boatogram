import { SignJWT, jwtVerify } from "jose";
import { config } from "@/lib/config";
import type { Role } from "@/generated/prisma/enums";

export type SessionPayload = {
  sub: string; // user id
  email: string;
  role: Role;
  name: string;
};

function getSecretKey() {
  if (!config.auth.secret || config.auth.secret.length < 16) {
    throw new Error(
      "AUTH_SECRET is not set (or too short). Set a strong random value in your .env file.",
    );
  }
  return new TextEncoder().encode(config.auth.secret);
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ email: payload.email, role: payload.role, name: payload.name })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${config.auth.sessionTtlSeconds}s`)
    .sign(getSecretKey());
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (!payload.sub || !payload.email || !payload.role || !payload.name) return null;
    return {
      sub: payload.sub as string,
      email: payload.email as string,
      role: payload.role as Role,
      name: payload.name as string,
    };
  } catch {
    return null;
  }
}
