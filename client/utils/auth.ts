import { jwtVerify, type JWTPayload } from "jose";
import { isSessionValid } from "@/utils/sessionStore";

export const AUTH_COOKIE = "ev_token";
export const SESSION_COOKIE = "ev_session";

export interface AuthUser {
  id: string | number;
  email: string;
  name?: string;
  username?: string;
  avatar?: string;
  role?: string;
  twoFactorEnabled?: boolean;
  createdAt?: string;
  theme?: "light" | "dark";
}

function getJwtSecret(): Uint8Array {
  // NEVER use NEXT_PUBLIC_* here — those vars are exposed in the browser bundle.
  // JWT_SECRET must be a server-only environment variable.
  const secret = process.env.JWT_SECRET ?? "changeme-dev-secret";
  return new TextEncoder().encode(secret);
}

/**
 * Verify a raw JWT string; returns the payload on success, null on failure.
 * Safe to call in both Edge (middleware) and Node.js runtimes.
 */
export async function verifyToken(token: string): Promise<(JWTPayload & Partial<AuthUser>) | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    return payload as JWTPayload & Partial<AuthUser>;
  } catch {
    return null;
  }
}

/**
 * Read the auth cookie from a Next.js `cookies()` store and verify it.
 * Returns the user payload or null.
 *
 * Usage (server component / route handler):
 *   import { cookies } from "next/headers";
 *   const user = await getServerUser(await cookies());
 */
export async function getServerUser(
  cookieStore: { get(name: string): { value: string } | undefined }
): Promise<(JWTPayload & Partial<AuthUser>) | null> {
  const cookie = cookieStore.get(AUTH_COOKIE);
  if (!cookie?.value) return null;
  const payload = await verifyToken(cookie.value);
  if (!payload) return null;

  // If a session cookie is present, validate it against the session store.
  // isSessionValid returns true when no record exists (first login / server restart).
  const sessionCookie = cookieStore.get(SESSION_COOKIE);
  if (sessionCookie?.value) {
    const userId = String(payload.id ?? payload.sub ?? "");
    if (userId && !isSessionValid(userId, sessionCookie.value)) return null;
  }

  return payload;
}
