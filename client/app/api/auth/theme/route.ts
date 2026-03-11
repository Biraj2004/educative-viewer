import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE } from "@/utils/auth";

const BACKEND = process.env.BACKEND_API_BASE ?? "";

// ─── PUT /api/auth/theme ──────────────────────────────────────────────────────
// Persists the user's preferred theme ('light' | 'dark') to the backend.

export async function PUT(request: NextRequest) {
  const token = request.cookies.get(AUTH_COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));

  const res = await fetch(`${BACKEND}/auth/theme`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
