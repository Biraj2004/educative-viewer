"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { getUser, logout as logoutApi, ApiError, getAuthToken } from "@/utils/authClient";
import type { AuthUser } from "@/utils/authClient";

// ─── Context ──────────────────────────────────────────────────────────────────

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  authToken: string | null;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  logout: async () => {},
  refresh: async () => {},
  authToken: null,
});

export function useAuth() {
  return useContext(AuthContext);
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const pathname = usePathname();

  // Re-run on every client-side navigation (pathname change).
  // Next.js layouts don't remount on navigation, so without this dependency
  // the check would only fire once when first entering /edu-viewer/*.
  useEffect(() => {
    let cancelled = false;
    setAuthToken(getAuthToken());
    getUser()
      .then((u) => { if (!cancelled) setUser(u); })
      .catch(async (err) => {
        if (!cancelled) {
          setUser(null);
          // If the server rejected the session (401 — superseded by a newer login),
          // clear the stale cookie and force the user back to the sign-in page.
          if (err instanceof ApiError && err.status === 401) {
            await logoutApi().catch(() => {});
            window.location.replace("/auth?reason=session_expired");
          }
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [pathname]);

  async function refresh() {
    try {
      const u = await getUser();
      setUser(u);
    } catch {
      setUser(null);
    }
  }

  async function logout() {
    try {
      await logoutApi();
    } finally {
      setUser(null);
      setAuthToken(null);
      window.location.href = "/auth";
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, logout, refresh, authToken }}>
      {children}
    </AuthContext.Provider>
  );
}
