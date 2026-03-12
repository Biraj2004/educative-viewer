/**
 * Client-side auth API helpers.
 * All calls go directly from the browser to NEXT_PUBLIC_BACKEND_API_BASE (Flask).
 * JWT is stored in localStorage — no httpOnly cookies, no Next.js proxy needed.
 */

const BACKEND = (process.env.NEXT_PUBLIC_BACKEND_API_BASE ?? "").replace(/\/$/, "");
const API = `${BACKEND}/api/auth`;
const LS_KEY = "ev_token";
const IS_BROWSER = typeof window !== "undefined";

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

/** Carries the HTTP status so callers can react to 401 vs 5xx etc. */
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
  id: string | number;
  email: string;
  name?: string;
  username?: string;
  avatar?: string;
  role?: string;
  theme?: "light" | "dark";
  twoFactorEnabled?: boolean;
  createdAt?: string;
  progress?: ProgressData;
}

export interface AuthResponse {
  token?: string;
  user?: AuthUser;
  requiresTwoFactor?: boolean;
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
  if (!res.ok) {
    throw new ApiError(data?.error ?? data?.message ?? `Request failed (${res.status})`, res.status);
  }
  return data as T;
}

async function apiGet<T>(path: string): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(path, { headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(data?.error ?? data?.message ?? `Request failed (${res.status})`, res.status);
  }
  return data as T;
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

export async function setTheme(theme: "light" | "dark"): Promise<void> {
  await apiFetch(`${API}/theme`, { method: "PUT", body: JSON.stringify({ theme }) });
}

export async function getProgress(): Promise<ProgressData> {
  try {
    const data = await apiGet<{ course_order?: number[]; completed?: Record<string, number[]> }>(`${API}/progress`);
    return {
      course_order: Array.isArray(data?.course_order) ? data.course_order : [],
      completed: (data?.completed && typeof data.completed === "object") ? data.completed : {},
    };
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
    throw new ApiError(data?.error ?? `Request failed (${res.status})`, res.status);
  }
}
