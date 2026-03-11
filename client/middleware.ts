import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const PROXY_SECRET_HEADER = "x-edu-proxy";
const PROXY_SECRET_VALUE = process.env.PROXY_SECRET; // same secret as in Worker

const AUTH_COOKIE = "ev_token";

// All /edu-viewer/* sub-pages require authentication; /edu-viewer itself is also protected
const PROTECTED_PREFIX = "/edu-viewer";

// Paths that are always public
const PUBLIC_PATHS_EXACT = new Set(["/", "/auth"]);
const PUBLIC_PREFIXES = ["/_next", "/favicon", "/api/auth", "/icon", "/auth/"];

function isProtected(pathname: string): boolean {
  if (PUBLIC_PATHS_EXACT.has(pathname)) return false;
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) return false;
  return pathname === PROTECTED_PREFIX || pathname.startsWith(PROTECTED_PREFIX + "/");
}

async function verifyToken(token: string): Promise<boolean> {
  try {
    const secret = new TextEncoder().encode(
      process.env.JWT_SECRET ?? "changeme-dev-secret"
    );
    await jwtVerify(token, secret);
    return true;
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Proxy secret check (production only) ────────────────────────────────
  const isProduction = process.env.VERCEL_ENV === "production";
  if (isProduction) {
    const header = request.headers.get(PROXY_SECRET_HEADER);
    if (!header || header !== PROXY_SECRET_VALUE) {
      return new NextResponse("Forbidden – direct access not allowed", {
        status: 403,
      });
    }
  }

  // ── JWT auth guard ───────────────────────────────────────────────────────
  if (isProtected(pathname)) {
    const token = request.cookies.get(AUTH_COOKIE)?.value;
    const authenticated = token ? await verifyToken(token) : false;
    if (!authenticated) {
      const loginUrl = new URL("/auth", request.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
