/**
 * Server-side session registry — enforces single active session per user.
 *
 * Maps userId → current active sessionId (a random UUID set on every login).
 * When a new login supersedes an existing one, the old sessionId is overwritten.
 * Any request still bearing the old sessionId is rejected with 401, forcing the
 * previous client to re-authenticate.
 *
 * ⚠️  This is a module-level in-memory store (Node.js process scope).
 *   - Correct for single-server deployments (`next start` / `node server.js`).
 *   - Resets on server restart — users will need to sign in again.
 *   - For multi-instance or serverless deployments, replace the Map with
 *     an external store (e.g. Upstash Redis, a DB table).
 *
 * NOT imported by middleware (Edge runtime) — only by API routes and server components.
 */

const sessions = new Map<string, string>(); // userId → sessionId

/** Register (or replace) the active session for a user. Called on login / signup / 2FA verify. */
export function registerSession(userId: string, sessionId: string): void {
  sessions.set(userId, sessionId);
}

/**
 * Returns true if `sessionId` is the current active session for `userId`.
 * Returns true when no record exists (first login after server restart) to
 * avoid locking out all users on restart.
 */
export function isSessionValid(userId: string, sessionId: string): boolean {
  const current = sessions.get(userId);
  if (current === undefined) return true; // no record → allow (first login / restart)
  return current === sessionId;
}

/** Remove a user's session entry. Call this on logout. */
export function removeSession(userId: string): void {
  sessions.delete(userId);
}
