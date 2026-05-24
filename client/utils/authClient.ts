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

import { getBackendApiBase } from "./runtime-config";

/** Lazily resolved at call-time so runtime config (window.__EV_RUNTIME_CONFIG__) is used. */
function getAPI() {
  return `${getBackendApiBase()}/api/auth`;
}
function getAdminAPI() {
  return `${getBackendApiBase()}/api/admin`;
}

const LS_KEY = "ev_token";
const LS_DEACTIVATED_KEY = "ev_deactivated";
const IS_BROWSER = typeof window !== "undefined";

// ─── RSA password encryption ──────────────────────────────────────────────────
// Passwords are encrypted with the server's RSA-2048 public key (RSA-OAEP /
// SHA-256) before being sent over the wire. The server decrypts them before
// any bcrypt operations. No npm libraries needed — uses the Web Crypto API.

let _cachedPublicKey: CryptoKey | null = null;

/** Import a PEM-encoded RSA public key into a CryptoKey — no fetch needed. */
async function _importPem(pem: string): Promise<CryptoKey> {
  if (!IS_BROWSER || !window.crypto?.subtle) {
    throw new Error(
      "Secure browser crypto is unavailable. Open the app on localhost or HTTPS."
    );
  }

  // Env vars often store newlines as literal \n — normalise them first.
  const normalised = pem.replace(/\\n/g, "\n");
  const b64 = normalised.replace(/-----[^-]+-----/g, "").replace(/\s/g, "");
  const der = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  try {
    return await window.crypto.subtle.importKey(
      "spki",
      der.buffer,
      { name: "RSA-OAEP", hash: "SHA-256" },
      false,
      ["encrypt"],
    );
  } catch {
    throw new Error(
      "Invalid NEXT_PUBLIC_RSA_PUBLIC_KEY. Sync it from server/.env (RSA_PRIVATE_KEY) and restart the Next.js dev server."
    );
  }
}

/** Return the server RSA public key from the baked-in env var. */
async function _getPublicKey(): Promise<CryptoKey> {
  if (_cachedPublicKey) return _cachedPublicKey;

  const baked = process.env.NEXT_PUBLIC_RSA_PUBLIC_KEY;
  if (baked) {
    _cachedPublicKey = await _importPem(baked);
    return _cachedPublicKey;
  }

  throw new Error(
    "RSA Public Key missing. Please set NEXT_PUBLIC_RSA_PUBLIC_KEY in .env.local"
  );
}

/**
 * Encrypt a plaintext password with the server's RSA public key.
 * Returns a Base64-encoded ciphertext string.
 */
async function _encryptPassword(password: string): Promise<string> {
  const publicKey = await _getPublicKey();
  const encoded = new TextEncoder().encode(password);
  const encrypted = await window.crypto.subtle.encrypt(
    { name: "RSA-OAEP" },
    publicKey,
    encoded,
  );
  return btoa(String.fromCharCode(...new Uint8Array(encrypted)));
}

// ─── Global 401 handler ───────────────────────────────────────────────────────
// Registered once by AuthProvider. Fires when any protected API call returns 401
// (expired token, or session superseded by a login from another browser).

type UnauthorizedHandler = () => void | Promise<void>;
type ForbiddenHandler = (message?: string) => void | Promise<void>;
let _unauthorizedHandler: UnauthorizedHandler | null = null;
let _forbiddenHandler: ForbiddenHandler | null = null;

export function setUnauthorizedHandler(fn: UnauthorizedHandler | null): void {
  _unauthorizedHandler = fn;
}

export function setForbiddenHandler(fn: ForbiddenHandler | null): void {
  _forbiddenHandler = fn;
}

/** Called internally whenever a protected fetch returns 401. */
async function _handleUnauthorized(): Promise<void> {
  if (_unauthorizedHandler) {
    await _unauthorizedHandler();
  } else {
    clearAuthToken();
    if (IS_BROWSER) window.location.replace("/auth?reason=session_expired");
  }
}

/** Called internally whenever an API call returns 403. */
async function _handleForbidden(message?: string): Promise<void> {
  if (_forbiddenHandler) {
    await _forbiddenHandler(message);
  } else {
    // Fallback (no AuthProvider mounted): clear token + set flag so the
    // AuthFlowGuard enforces the /deactivated lock on every subsequent navigation.
    clearAuthToken();
    setDeactivatedFlag();
    if (IS_BROWSER) window.location.replace("/deactivated");
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

export function setDeactivatedFlag(): void {
  if (!IS_BROWSER) return;
  localStorage.setItem(LS_DEACTIVATED_KEY, "1");
}

export function clearDeactivatedFlag(): void {
  if (!IS_BROWSER) return;
  localStorage.removeItem(LS_DEACTIVATED_KEY);
}

export interface JwtPayload {
  exp?: number;
  restricted?: boolean;
  scope?: string;
  two_factor_pending?: boolean;
  status?: string;
  role?: string;
  [key: string]: unknown;
}

export function parseAuthTokenPayload(token: string): JwtPayload | null {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(window.atob(base64)) as JwtPayload;
  } catch {
    return null;
  }
}

export function isRestrictedAuthFlow(payload: JwtPayload): boolean {
  if (!payload) return false;
  // If the JWT was issued specifically for a restricted flow (like 2FA waiting, pw reset)
  // or lacks full access scopes.
  return (
    payload.restricted === true ||
    payload.scope === "partial" ||
    payload.partial === true ||
    payload.two_factor_pending === true
  );
}

export function canAccessDeactivatedPage(): boolean {
  // Determine if the current user session is allowed to sit on the /deactivated page.
  // We'll decode the current token and see if the token or local state marks them as deactivated.
  if (IS_BROWSER && localStorage.getItem(LS_DEACTIVATED_KEY) === "1") return true;
  const token = getAuthToken();
  if (!token) return false;
  const payload = parseAuthTokenPayload(token);
  return payload?.status === "deactivated" || payload?.role === "deactivated";
}


// ─── Errors ──────────────────────────────────────────────────────────────────

/** Carries the HTTP status so callers can react to specific status codes. */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
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

export interface ViewerHighlight {
  id: string;
  text: string;
  context?: string;
  note?: string;
  created_at?: string;
  start_offset?: number | null;
  end_offset?: number | null;
  component_index?: number | null;
}

export interface CourseViewerSettings {
  last_topic_index?: number;
  bookmarks?: number[];
  highlights?: Record<string, ViewerHighlight[]>;
}

export interface ViewerSettingsData {
  courses: Record<string, CourseViewerSettings>;
}

export interface ViewerFeatures {
  highlights_enabled: boolean;
  bookmarks_enabled: boolean;
  notes_enabled: boolean;
  search_enabled: boolean;
}

export interface ViewerSettingsPayload {
  settings: ViewerSettingsData;
  features: ViewerFeatures;
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
  isFirstLogin?: boolean;
  createdAt: string;
  progress?: ProgressData;
}

export interface AuthResponse {
  token?: string;
  user?: AuthUser;
  requiresTwoFactor?: boolean;
  requiresTwoFactorSetup?: boolean;
  requiresFirstLogin?: boolean;
  message?: string;
  error?: string;
}

export interface TwoFASetup {
  qrCodeUrl: string;
  secret?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function apiPost<T>(
  path: string,
  body: Record<string, unknown>,
): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(path, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && token) {
    if (path.endsWith("/2fa/verify") && data?.error !== "Not authenticated") {
      throw new ApiError(data?.error ?? "Invalid authenticator code", 401);
    }
    await _handleUnauthorized();
    throw new ApiError(data?.error ?? "Session expired.", 401);
  }
  if (res.status === 403) {
    await _handleForbidden(data?.error ?? data?.message);
    throw new ApiError(data?.error ?? data?.message ?? "Access denied", 403);
  }
  if (!res.ok) {
    throw new ApiError(
      data?.error ?? data?.message ?? `Request failed (${res.status})`,
      res.status,
    );
  }
  return data as T;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
        throw new ApiError(data?.error ?? "Session expired.", 401);
      }
      if (res.status === 403) {
        await _handleForbidden(data?.error ?? data?.message);
        throw new ApiError(data?.error ?? data?.message ?? "Access denied", 403);
      }
      if (!res.ok) {
        throw new ApiError(
          data?.error ?? data?.message ?? `Request failed (${res.status})`,
          res.status,
        );
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

export async function login(
  email: string,
  password: string,
): Promise<AuthResponse> {
  const encryptedPassword = await _encryptPassword(password);
  const result = await apiPost<AuthResponse>(`${getAPI()}/login`, {
    email,
    password: encryptedPassword,
  });
  if (result.token) storeAuthToken(result.token);
  return result;
}

export async function signup(
  email: string,
  password: string,
  inviteCode: string,
  name?: string,
): Promise<AuthResponse> {
  const encryptedPassword = await _encryptPassword(password);
  const result = await apiPost<AuthResponse>(`${getAPI()}/signup`, {
    email,
    password: encryptedPassword,
    inviteCode,
    name,
  });
  if (result.token) storeAuthToken(result.token);
  return result;
}

export async function logout(): Promise<void> {
  try {
    await apiPost<unknown>(`${getAPI()}/logout`, {});
  } catch {
    /* best-effort */
  }
  clearAuthToken();
}

export async function getUser(): Promise<AuthUser> {
  return apiGet<AuthUser>(`${getAPI()}/me`);
}

export async function verify2FA(code: string): Promise<AuthResponse> {
  const result = await apiPost<AuthResponse>(`${getAPI()}/2fa/verify`, { code });
  if (result.token && !result.requiresTwoFactor) storeAuthToken(result.token);
  return result;
}

export async function get2FASetup(): Promise<TwoFASetup> {
  return apiGet<TwoFASetup>(`${getAPI()}/2fa/setup`);
}

export async function enable2FA(code: string): Promise<AuthResponse> {
  const result = await apiPost<AuthResponse>(`${getAPI()}/2fa/enable`, { code });
  if (result.token) storeAuthToken(result.token);
  return result;
}

export async function rollbackSignup(): Promise<void> {
  await apiPost<unknown>(`${getAPI()}/signup/rollback`, {});
  clearAuthToken();
}

// ─── Forgot password ──────────────────────────────────────────────────────────

/** Step 1 — verify email; stores the pw_reset_pending token. */
export async function forgotPasswordRequest(
  email: string,
): Promise<AuthResponse> {
  const result = await apiPost<AuthResponse>(`${getAPI()}/forgot-password/request`, {
    email,
  });
  if (result.token) storeAuthToken(result.token);
  return result;
}

/** Step 2 — verify TOTP code; stores the pw_reset_confirmed token. */
export async function forgotPasswordVerify(
  code: string,
): Promise<AuthResponse> {
  const result = await apiPost<AuthResponse>(`${getAPI()}/forgot-password/verify`, {
    code,
  });
  if (result.token) storeAuthToken(result.token);
  return result;
}

/** Step 3 — set new password using the confirmed token. */
export async function forgotPasswordReset(
  password: string,
): Promise<{ message: string }> {
  const encryptedPassword = await _encryptPassword(password);
  return apiPost<{ message: string }>(`${getAPI()}/forgot-password/reset`, {
    password: encryptedPassword,
  });
}

/** Change password for the currently authenticated user. */
export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<{ message: string }> {
  const [encryptedCurrent, encryptedNew] = await Promise.all([
    _encryptPassword(currentPassword),
    _encryptPassword(newPassword),
  ]);
  return apiPost<{ message: string }>(`${getAPI()}/change-password`, {
    current_password: encryptedCurrent,
    new_password: encryptedNew,
  });
}

export async function setTheme(theme: "light" | "dark"): Promise<void> {
  // Public pages also use the theme toggle; only persist to DB when authenticated.
  if (!getAuthToken()) return;
  await apiFetch(`${getAPI()}/theme`, {
    method: "PUT",
    body: JSON.stringify({ theme }),
  });
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
  completed = false,
): Promise<void> {
  await apiPost<unknown>(`${getAPI()}/progress/topic`, {
    course_id: courseId,
    topic_index: topicIndex,
    completed,
  });
}

export async function resetCourseProgress(courseId: number): Promise<void> {
  await apiFetch(`${getAPI()}/progress/course`, {
    method: "DELETE",
    body: JSON.stringify({ course_id: courseId }),
  });
}

export async function getViewerSettings(): Promise<ViewerSettingsPayload> {
  try {
    const data = await apiGet<{
      settings?: ViewerSettingsData;
      features?: Partial<ViewerFeatures>;
    }>(`${getAPI()}/viewer-settings`);
    const settings = data?.settings;
    const features = data?.features;
    if (!settings || typeof settings !== "object" || typeof settings.courses !== "object") {
      return {
        settings: { courses: {} },
        features: {
          highlights_enabled: true,
          bookmarks_enabled: true,
          notes_enabled: true,
          search_enabled: true,
        },
      };
    }
    return {
      settings,
      features: {
        highlights_enabled: features?.highlights_enabled !== false,
        bookmarks_enabled: features?.bookmarks_enabled !== false,
        notes_enabled: features?.notes_enabled !== false,
        search_enabled: features?.search_enabled !== false,
      },
    };
  } catch {
    return {
      settings: { courses: {} },
      features: {
        highlights_enabled: true,
        bookmarks_enabled: true,
        notes_enabled: true,
        search_enabled: true,
      },
    };
  }
}

export interface UpdateViewerCourseSettingsPayload {
  course_id: number;
  last_topic_index?: number;
  bookmark_topic_index?: number;
  bookmarked?: boolean;
  add_highlight?: {
    topic_index: number;
    text: string;
    context?: string;
    note?: string;
    start_offset?: number;
    end_offset?: number;
    component_index?: number;
  };
  remove_highlight?: {
    topic_index: number;
    highlight_id: string;
  };
  update_highlight_note?: {
    topic_index: number;
    highlight_id: string;
    note: string;
  };
  clear_highlights_topic_index?: number;
}

export async function updateViewerCourseSettings(
  payload: UpdateViewerCourseSettingsPayload,
): Promise<CourseViewerSettings | null> {
  const token = getAuthToken();
  if (!token) return null;
  const res = await fetch(`${getAPI()}/viewer-settings/course`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401) {
      await _handleUnauthorized();
    }
    if (res.status === 403) {
      await _handleForbidden(data?.error ?? data?.message);
    }
    throw new ApiError(data?.error ?? `Request failed (${res.status})`, res.status);
  }
  return (data?.course as CourseViewerSettings) ?? null;
}

// ─── Internal helper ──────────────────────────────────────────────────────────

async function apiFetch(path: string, init: RequestInit): Promise<void> {
  const token = getAuthToken();
  const authHeaders: Record<string, string> = token
    ? { Authorization: `Bearer ${token}` }
    : {};
  const headers = {
    "Content-Type": "application/json",
    ...authHeaders,
    ...(init.headers as Record<string, string> | undefined),
  };
  const res = await fetch(path, { ...init, headers });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) {
      await _handleUnauthorized();
      throw new ApiError(data?.error ?? "Session expired.", 401);
    }
    if (res.status === 403) {
      await _handleForbidden();
      throw new ApiError(data?.error ?? data?.message ?? "Access denied", 403);
    }
    throw new ApiError(
      data?.error ?? `Request failed (${res.status})`,
      res.status,
    );
  }
}

// ─── Admin CRUD helpers ───────────────────────────────────────────────────────

export interface AdminUser {
  id: number;
  email: string;
  name: string | null;
  username: string | null;
  role_id: number;
  role_name: string;
  is_active: boolean;
  two_factor_enabled: boolean;
  is_first_login: boolean;
  failed_attempts: number;
  locked_until: string | null;
  created_at: string;
}

export interface AdminCreateResult {
  success: boolean;
  user_id: number;
  email: string;
  name: string | null;
  role_id: number;
  temp_password: string;
  temp_password_expires_at: string;
}

export interface AdminResetResult {
  success: boolean;
  user_id: number;
  temp_password: string;
  temp_password_expires_at: string;
}

async function adminApiCall<T>(
  path: string,
  method: string,
  body?: Record<string, unknown>,
): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(data?.error ?? data?.message ?? `Request failed (${res.status})`, res.status);
  }
  return data as T;
}

export async function adminGetUsers(): Promise<AdminUser[]> {
  return adminApiCall<AdminUser[]>(`${getAdminAPI()}/users`, "GET");
}

export async function adminCreateUser(
  email: string,
  name: string | null,
  role_id: number,
): Promise<AdminCreateResult> {
  return adminApiCall<AdminCreateResult>(`${getAdminAPI()}/users/create`, "POST", {
    email,
    name,
    role_id,
  });
}

export async function adminEditUser(
  userId: number,
  email: string,
  name: string | null,
  role_id: number,
): Promise<{ success: boolean }> {
  return adminApiCall<{ success: boolean }>(
    `${getAdminAPI()}/users/${userId}/edit`,
    "PATCH",
    { email, name, role_id },
  );
}

export async function adminDeleteUser(userId: number): Promise<{ success: boolean }> {
  return adminApiCall<{ success: boolean }>(`${getAdminAPI()}/users/${userId}`, "DELETE");
}

export async function adminResetUserPassword(userId: number): Promise<AdminResetResult> {
  return adminApiCall<AdminResetResult>(`${getAdminAPI()}/users/${userId}/reset-password`, "POST");
}

export async function adminGetSettings(): Promise<Record<string, string>> {
  return adminApiCall<Record<string, string>>(`${getAdminAPI()}/settings`, "GET");
}

export async function adminSaveSettings(settings: Record<string, string>): Promise<{ success: boolean }> {
  return adminApiCall<{ success: boolean }>(`${getAdminAPI()}/settings`, "POST", settings);
}
