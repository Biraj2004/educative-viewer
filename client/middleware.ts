import { NextRequest, NextResponse } from "next/server";

const PROXY_SECRET_HEADER = "x-edu-proxy";
const PROXY_SECRET_VALUE = process.env.PROXY_SECRET;

export function middleware(request: NextRequest) {
  // ── Proxy secret check (production only) ────────────────────────────────
  // Rejects requests that didn't come through the Cloudflare Worker.
  const isProduction = process.env.VERCEL_ENV === "production";
  if (isProduction) {
    const header = request.headers.get(PROXY_SECRET_HEADER);
    if (!header || header !== PROXY_SECRET_VALUE) {
      return new NextResponse("Forbidden – direct access not allowed", {
        status: 403,
      });
    }
  }

  // Auth is enforced client-side via AuthProvider (localStorage JWT → Flask /api/auth/me).
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
