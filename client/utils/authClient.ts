/**
 * Client-side auth API helpers.
 * All calls go through the Next.js server (which proxies to BACKEND_API_BASE)
 * so we hit relative paths from the browser.
 */

const API = "/api/auth";

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
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    credentials: "include",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(data?.error ?? data?.message ?? `Request failed (${res.status})`, res.status);
  }
  return data as T;
}

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(path, { credentials: "include" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(data?.error ?? data?.message ?? `Request failed (${res.status})`, res.status);
  }
  return data as T;
}

// ─── Auth API ─────────────────────────────────────────────────────────────────

export async function login(email: string, password: string): Promise<AuthResponse> {
  return apiPost<AuthResponse>(`${API}/login`, { email, password });
}

export async function signup(
  email: string,
  password: string,
  inviteCode: string,
  name?: string
): Promise<AuthResponse> {
  return apiPost<AuthResponse>(`${API}/signup`, { email, password, inviteCode, name });
}

export async function logout(): Promise<void> {
  await apiPost<unknown>(`${API}/logout`, {});
}

export async function getUser(): Promise<AuthUser> {
  return apiGet<AuthUser>(`${API}/me`);
}

export async function verify2FA(code: string): Promise<AuthResponse> {
  return apiPost<AuthResponse>(`${API}/2fa/verify`, { code });
}

export async function get2FASetup(): Promise<TwoFASetup> {
  return apiGet<TwoFASetup>(`${API}/2fa/setup`);
}

export async function enable2FA(code: string): Promise<AuthResponse> {
  return apiPost<AuthResponse>(`${API}/2fa/enable`, { code });
}

export async function rollbackSignup(): Promise<void> {
  await apiPost<unknown>(`${API}/signup/rollback`, {});
}

export async function setTheme(theme: "light" | "dark"): Promise<void> {
  await apiFetch(`${API}/theme`, { method: "PUT", body: JSON.stringify({ theme }) });
}

export async function getProgress(): Promise<ProgressData> {
  const res = await fetch(`${API}/progress`, { credentials: "include" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(data?.error ?? data?.message ?? `Request failed (${res.status})`, res.status);
  }
  return {
    course_order: Array.isArray(data?.course_order) ? data.course_order : [],
    completed: (data?.completed && typeof data.completed === "object") ? data.completed : {},
  };
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
  const headers = { "Content-Type": "application/json", ...(init.headers as Record<string, string> | undefined) };
  const res = await fetch(path, { ...init, headers, credentials: "include" });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(data?.error ?? `Request failed (${res.status})`, res.status);
  }
}
