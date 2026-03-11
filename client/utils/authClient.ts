/**
 * Client-side auth API helpers.
 * All calls go through the Next.js server (which proxies to BACKEND_API_BASE)
 * so we hit relative paths from the browser.
 */

const API = "/api/auth";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string | number;
  email: string;
  name?: string;
  username?: string;
  avatar?: string;
  role?: string;
  twoFactorEnabled?: boolean;
  createdAt?: string;
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
    throw new Error(data?.error ?? data?.message ?? `Request failed (${res.status})`);
  }
  return data as T;
}

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(path, { credentials: "include" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error ?? data?.message ?? `Request failed (${res.status})`);
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
