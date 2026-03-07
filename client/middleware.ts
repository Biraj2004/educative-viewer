import { NextRequest, NextResponse } from "next/server";

const PROXY_SECRET_HEADER = "x-edu-proxy";
const PROXY_SECRET_VALUE = process.env.PROXY_SECRET; // same secret as in Worker

export function middleware(request: NextRequest) {
  // Only enforce in production (VERCEL_ENV is set automatically by Vercel)
  const isProduction = process.env.VERCEL_ENV === "production";
  if (isProduction) {
    const header = request.headers.get(PROXY_SECRET_HEADER);
    if (!header || header !== PROXY_SECRET_VALUE) {
      return new NextResponse("Forbidden – direct access not allowed", {
        status: 403,
      });
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
