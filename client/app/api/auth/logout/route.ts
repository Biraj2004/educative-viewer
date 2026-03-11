import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, SESSION_COOKIE, verifyToken } from "@/utils/auth";
import { removeSession } from "@/utils/sessionStore";

export async function POST(request: NextRequest) {
  // Remove the server-side session record so the old token is immediately invalid
  const token = request.cookies.get(AUTH_COOKIE)?.value;
  if (token) {
    const payload = await verifyToken(token);
    if (payload) {
      const userId = String(payload.id ?? payload.sub ?? "");
      if (userId) removeSession(userId);
    }
  }

  const response = NextResponse.json({ message: "Logged out" }, { status: 200 });
  response.cookies.set(AUTH_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
  return response;
}
