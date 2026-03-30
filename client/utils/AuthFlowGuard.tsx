"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  canAccessDeactivatedPage,
  clearAuthToken,
  getAuthToken,
  isRestrictedAuthFlow,
  parseAuthTokenPayload,
} from "@/utils/authClient";

const PUBLIC_ALLOWLIST = new Set(["/", "/about", "/contact"]);

function isAuthRoute(pathname: string): boolean {
  return pathname === "/auth" || pathname.startsWith("/auth/");
}

function isPublicAllowedRoute(pathname: string): boolean {
  return PUBLIC_ALLOWLIST.has(pathname);
}

function isDeactivatedRoute(pathname: string): boolean {
  return pathname === "/deactivated";
}

function authRedirect(pathname: string): string {
  if (!pathname || pathname === "/") {
    return "/auth";
  }
  return `/auth?next=${encodeURIComponent(pathname)}`;
}

/**
 * Global client-side route guard.
 * Public marketing pages are always accessible.
 * Non-public routes require full authentication.
 * Partial/scoped tokens are blocked from non-public app routes until auth flow is completed.
 */
export default function AuthFlowGuard() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const checkAuth = () => {
      if (!pathname) return;

      const token = getAuthToken();
      const payload = token ? parseAuthTokenPayload(token) : null;
      const isExpired =
        payload &&
        typeof payload.exp === "number" &&
        payload.exp <= Math.floor(Date.now() / 1000);

      const isAuthenticated =
        !!token && !!payload && !isExpired && !isRestrictedAuthFlow(payload);

      const isDeactivated = canAccessDeactivatedPage();

      // Rule 3: Deactivated Enforcement (Lock them to /deactivated)
      if (isDeactivated) {
        if (!isDeactivatedRoute(pathname)) {
          router.replace("/deactivated");
        }
        return;
      }

      // If they are NOT deactivated, stop them from manually accessing /deactivated
      if (isDeactivatedRoute(pathname)) {
        router.replace(isAuthenticated ? "/dashboard" : "/auth");
        return;
      }

      // Rule 2: "Already Logged In" feature (Bounce them from /auth to /dashboard)
      if (isAuthRoute(pathname)) {
        if (isAuthenticated) {
          router.replace("/dashboard");
        }
        return; // Allow unauthenticated to see /auth
      }

      // Rule 1: Public Routes (/ , /about, /contact) are allowed to stay
      if (isPublicAllowedRoute(pathname)) {
        return;
      }

      // For all other routes (Protected App Routes):
      if (!token || !payload || isExpired) {
        if (token && (isExpired || !payload)) clearAuthToken();
        router.replace(authRedirect(pathname));
        return;
      }

      // If they have a token but are in a restricted flow (e.g. pending 2FA)
      if (isRestrictedAuthFlow(payload)) {
        router.replace("/auth");
      }
    };

    // Run the check on mount and pathname change
    checkAuth();

    // Listen to cross-tab storage changes (e.g. user logs out in another tab)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "ev_token" || e.key === null) {
        checkAuth();
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [pathname, router]);

  return null;
}
