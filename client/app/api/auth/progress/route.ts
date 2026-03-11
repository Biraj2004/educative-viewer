import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE } from "@/utils/auth";

const BACKEND = process.env.BACKEND_API_BASE ?? "";

// ─── GET /api/auth/progress ───────────────────────────────────────────────────
// Returns compact progress for the authenticated user.

export async function GET(request: NextRequest) {
  const token = request.cookies.get(AUTH_COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const res = await fetch(`${BACKEND}/auth/progress`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
