import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, SESSION_COOKIE, verifyToken } from "@/utils/auth";
import { isSessionValid } from "@/utils/sessionStore";

const BACKEND = process.env.BACKEND_API_BASE ?? "";

export async function GET(request: NextRequest) {
  const token = request.cookies.get(AUTH_COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Verify JWT signature locally (fast — avoids a backend round-trip on every rejection)
  const payload = await verifyToken(token);
  if (!payload) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  // Reject if this session has been superseded by a newer login
  const sessionId = request.cookies.get(SESSION_COOKIE)?.value;
  if (sessionId) {
    const userId = String(payload.id ?? payload.sub ?? "");
    if (userId && !isSessionValid(userId, sessionId)) {
      return NextResponse.json(
        { error: "Session superseded by a newer login. Please sign in again." },
        { status: 401 }
      );
    }
  }

  const res = await fetch(`${BACKEND}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
