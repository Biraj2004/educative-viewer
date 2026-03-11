import { NextRequest, NextResponse } from "next/server";
import { decodeJwt } from "jose";
import { AUTH_COOKIE, SESSION_COOKIE } from "@/utils/auth";
import { registerSession } from "@/utils/sessionStore";

const BACKEND = process.env.BACKEND_API_BASE ?? "";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const res = await fetch(`${BACKEND}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    return NextResponse.json(data, { status: res.status });
  }

  const response = NextResponse.json(data, { status: 200 });

  const token: string | undefined = data?.token;
  if (token) {
    if (data?.requiresTwoFactor) {
      // Partial token: short-lived (10 min) — allows 2FA setup/enable to authenticate
      response.cookies.set(AUTH_COOKIE, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 600,
        path: "/",
      });
    } else {
      const sessionId = crypto.randomUUID();
      try {
        const payload = decodeJwt(token);
        const userId = String(payload.id ?? payload.sub ?? "");
        if (userId) registerSession(userId, sessionId);
      } catch { /* ignore malformed token */ }

      response.cookies.set(AUTH_COOKIE, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: COOKIE_MAX_AGE,
        path: "/",
      });
      response.cookies.set(SESSION_COOKIE, sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: COOKIE_MAX_AGE,
        path: "/",
      });
    }
  }

  return response;
}
