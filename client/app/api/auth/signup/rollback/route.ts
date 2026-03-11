import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, SESSION_COOKIE } from "@/utils/auth";

const BACKEND = process.env.BACKEND_API_BASE ?? "";

// ─── POST /api/auth/signup/rollback ──────────────────────────────────────────
// Deletes a partially-created account (two_factor_confirmed = 0) and clears
// the auth cookies so the browser is back to a clean unauthenticated state.

export async function POST(request: NextRequest) {
  const token = request.cookies.get(AUTH_COOKIE)?.value;

  const res = await fetch(`${BACKEND}/api/auth/signup/rollback`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  const data = await res.json().catch(() => ({}));
  const status = res.ok ? 200 : res.status;

  const response = NextResponse.json(data, { status });

  // Always clear cookies regardless of backend response
  response.cookies.set(AUTH_COOKIE, "", { maxAge: 0, path: "/" });
  response.cookies.set(SESSION_COOKIE, "", { maxAge: 0, path: "/" });

  return response;
}
