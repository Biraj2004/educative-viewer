import { SignJWT } from "jose";

/**
 * Generate a short-lived (60 s) service JWT signed with CLIENT_SERVER_SECRET.
 * This token is sent as `Authorization: Bearer <token>` on every server-side
 * fetch to the Flask data endpoints (/courses, /course-details, /topic-details).
 *
 * IMPORTANT: CLIENT_SERVER_SECRET must NOT have the NEXT_PUBLIC_ prefix — it is
 * a server-only secret and must never be exposed in the browser bundle.
 */
export async function makeServiceToken(): Promise<string> {
  const secret = new TextEncoder().encode(
    process.env.CLIENT_SERVER_SECRET ?? "cs-internal-dev-secret-change-in-prod"
  );
  return new SignJWT({ role: "service" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("60s")
    .sign(secret);
}
