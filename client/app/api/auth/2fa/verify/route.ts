import { NextRequest, NextResponse } from "next/server";
import { decodeJwt } from "jose";
import { AUTH_COOKIE, SESSION_COOKIE } from "@/utils/auth";
import { registerSession } from "@/utils/sessionStore";

const BACKEND = process.env.BACKEND_API_BASE ?? "";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

export async function POST(request: NextRequest) {
  const token = request.cookies.get(AUTH_COOKIE)?.value;
  const body = await request.json().catch(() => ({}));

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BACKEND}/auth/2fa/verify`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    return NextResponse.json(data, { status: res.status });
  }

  const response = NextResponse.json(data, { status: 200 });

  const newToken: string | undefined = data?.token;
  if (newToken) {
    const sessionId = crypto.randomUUID();
    try {
      const payload = decodeJwt(newToken);
      const userId = String(payload.id ?? payload.sub ?? "");
      if (userId) registerSession(userId, sessionId);
    } catch { /* ignore malformed token */ }

    response.cookies.set(AUTH_COOKIE, newToken, {
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

  return response;
}
