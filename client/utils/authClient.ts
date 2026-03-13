/**
 * Client-side auth API helpers.
 * All calls go directly from the browser to NEXT_PUBLIC_BACKEND_API_BASE (Flask).
 * JWT is stored in localStorage — stateless, no cookies.
 *
 * Single-session enforcement:
 *   The Flask backend embeds a `sessionId` (UUID) in every JWT and stores the same
 *   value in the `users_sensitive` table. On each new login the DB value is rotated,
 *   so any old JWT that still carries the previous sessionId gets a 401 from the
 *   backend on the very next API call → the global 401 handler fires → sign-in page.
 */

const BACKEND = (process.env.NEXT_PUBLIC_BACKEND_API_BASE ?? "").replace(/\/$/, "");
const API = `${BACKEND}/api/auth`;
const LS_KEY = "ev_token";
const IS_BROWSER = typeof window !== "undefined";

// ─── Global 401 handler ───────────────────────────────────────────────────────
// Registered once by AuthProvider. Fires when any protected API call returns 401
// (expired token, or session superseded by a login from another browser).

type UnauthorizedHandler = () => void | Promise<void>;
let _unauthorizedHandler: UnauthorizedHandler | null = null;

export function setUnauthorizedHandler(fn: UnauthorizedHandler | null): void {
  _unauthorizedHandler = fn;
}

/** Called internally whenever a protected fetch returns 401. */
async function _handleUnauthorized(): Promise<void> {
  if (_unauthorizedHandler) {
    await _unauthorizedHandler();
  } else {
    // Fallback if AuthProvider hasn't mounted yet (e.g. SSR or early client render).
    clearAuthToken();
    if (IS_BROWSER) window.location.replace("/auth?reason=session_expired");
  }
}

// ─── Token storage ────────────────────────────────────────────────────────────

export function getAuthToken(): string | null {
  if (!IS_BROWSER) return null;
  return localStorage.getItem(LS_KEY);
}

export function storeAuthToken(token: string): void {
  if (!IS_BROWSER) return;
  localStorage.setItem(LS_KEY, token);
}

export function clearAuthToken(): void {
  if (!IS_BROWSER) return;
  localStorage.removeItem(LS_KEY);
}

// ─── Errors ──────────────────────────────────────────────────────────────────

/** Carries the HTTP status so callers can react to specific status codes. */
export class ApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "ApiError";
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProgressData {
  /** Course IDs sorted by most-recently-visited first */
  course_order: number[];
  /** Completed topic indices per course: { "course_id": [topic_idx, ...] } */
  completed: Record<string, number[]>;
}

export interface AuthUser {
  id: number;
  email: string;
  name?: string;
  username?: string;
  avatar?: string;
  role: string;
  theme: "light" | "dark";
  twoFactorEnabled: boolean;
  createdAt: string;
  progress?: ProgressData;
}

export interface AuthResponse {
  token?: string;
  user?: AuthUser;
  requiresTwoFactor?: boolean;
  requiresTwoFactorSetup?: boolean;
  message?: string;
  error?: string;
}

export interface TwoFASetup {
  qrCodeUrl: string;
  secret?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function apiPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(path, { method: "POST", headers, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && token) {
    // A 401 on a call that had a token means session is invalid/superseded.
    await _handleUnauthorized();
    throw new ApiError(data?.error ?? "Session expired. Please sign in again.", 401);
  }
  if (!res.ok) {
    throw new ApiError(data?.error ?? data?.message ?? `Request failed (${res.status})`, res.status);
  }
  return data as T;
}
const inflightGets = new Map<string, Promise<any>>();

async function apiGet<T>(path: string): Promise<T> {
  if (inflightGets.has(path)) {
    return inflightGets.get(path) as Promise<T>;
  }

  const token = getAuthToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const fetchPromise = fetch(path, { headers })
    .then(async (res) => {
      const data = await res.json().catch(() => ({}));
      if (res.status === 401 && token) {
        await _handleUnauthorized();
        throw new ApiError(data?.error ?? "Session expired. Please sign in again.", 401);
      }
      if (!res.ok) {
        throw new ApiError(data?.error ?? data?.message ?? `Request failed (${res.status})`, res.status);
      }
      return data as T;
    })
    .finally(() => {
      // Clear the cache shortly after the request completes or fails,
      // so future requests aren't permanently cached, just deduplicated
      // if they occur in the same tick / render cycle.
      setTimeout(() => inflightGets.delete(path), 50);
    });

  inflightGets.set(path, fetchPromise);
  return fetchPromise;
}

// ─── Auth API ─────────────────────────────────────────────────────────────────

export async function login(email: string, password: string): Promise<AuthResponse> {
  const result = await apiPost<AuthResponse>(`${API}/login`, { email, password });
  if (result.token) storeAuthToken(result.token);
  return result;
}

export async function signup(
  email: string,
  password: string,
  inviteCode: string,
  name?: string
): Promise<AuthResponse> {
  const result = await apiPost<AuthResponse>(`${API}/signup`, { email, password, inviteCode, name });
  if (result.token) storeAuthToken(result.token);
  return result;
}

export async function logout(): Promise<void> {
  try { await apiPost<unknown>(`${API}/logout`, {}); } catch { /* best-effort */ }
  clearAuthToken();
}

export async function getUser(): Promise<AuthUser> {
  return apiGet<AuthUser>(`${API}/me`);
}

export async function verify2FA(code: string): Promise<AuthResponse> {
  const result = await apiPost<AuthResponse>(`${API}/2fa/verify`, { code });
  if (result.token && !result.requiresTwoFactor) storeAuthToken(result.token);
  return result;
}

export async function get2FASetup(): Promise<TwoFASetup> {
  return apiGet<TwoFASetup>(`${API}/2fa/setup`);
}

export async function enable2FA(code: string): Promise<AuthResponse> {
  const result = await apiPost<AuthResponse>(`${API}/2fa/enable`, { code });
  if (result.token) storeAuthToken(result.token);
  return result;
}

export async function rollbackSignup(): Promise<void> {
  await apiPost<unknown>(`${API}/signup/rollback`, {});
  clearAuthToken();
}

// ─── Forgot password ──────────────────────────────────────────────────────────

/** Step 1 — verify email; stores the pw_reset_pending token. */
export async function forgotPasswordRequest(email: string): Promise<AuthResponse> {
  const result = await apiPost<AuthResponse>(`${API}/forgot-password/request`, { email });
  if (result.token) storeAuthToken(result.token);
  return result;
}

/** Step 2 — verify TOTP code; stores the pw_reset_confirmed token. */
export async function forgotPasswordVerify(code: string): Promise<AuthResponse> {
  const result = await apiPost<AuthResponse>(`${API}/forgot-password/verify`, { code });
  if (result.token) storeAuthToken(result.token);
  return result;
}

/** Step 3 — set new password using the confirmed token. */
export async function forgotPasswordReset(password: string): Promise<{ message: string }> {
  return apiPost<{ message: string }>(`${API}/forgot-password/reset`, { password });
}

/** Change password for the currently authenticated user. */
export async function changePassword(currentPassword: string, newPassword: string): Promise<{ message: string }> {
  return apiPost<{ message: string }>(`${API}/change-password`, {
    current_password: currentPassword,
    new_password: newPassword,
  });
}

export async function setTheme(theme: "light" | "dark"): Promise<void> {
  await apiFetch(`${API}/theme`, { method: "PUT", body: JSON.stringify({ theme }) });
}

export async function getProgress(): Promise<ProgressData> {
  try {
    const user = await getUser();
    if (user.progress) return user.progress;
    return { course_order: [], completed: {} };
  } catch {
    return { course_order: [], completed: {} };
  }
}

export async function recordTopicVisit(
  courseId: number,
  topicIndex: number,
  completed = false
): Promise<void> {
  await apiPost<unknown>(`${API}/progress/topic`, {
    course_id: courseId,
    topic_index: topicIndex,
    completed,
  });
}

// ─── Internal helper ──────────────────────────────────────────────────────────

async function apiFetch(path: string, init: RequestInit): Promise<void> {
  const token = getAuthToken();
  const authHeaders: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
  const headers = { "Content-Type": "application/json", ...authHeaders, ...(init.headers as Record<string, string> | undefined) };
  const res = await fetch(path, { ...init, headers });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && token) {
      await _handleUnauthorized();
    }
    throw new ApiError(data?.error ?? `Request failed (${res.status})`, res.status);
  }
}
