import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE } from "@/utils/auth";

const BACKEND = process.env.BACKEND_API_BASE ?? "";

// ─── POST /api/auth/progress/topic ───────────────────────────────────────────
// Upserts a topic visit / completion record.

export async function POST(request: NextRequest) {
  const token = request.cookies.get(AUTH_COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));

  const res = await fetch(`${BACKEND}/api/auth/progress/topic`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
