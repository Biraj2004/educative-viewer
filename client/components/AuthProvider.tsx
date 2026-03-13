"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { getUser, logout as logoutApi, getAuthToken, setUnauthorizedHandler, clearAuthToken } from "@/utils/authClient";
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

  // Register a global 401 handler once on mount.
  // Every protected API call (apiGet / apiPost in authClient.ts) fires this when
  // the server returns 401 — session expired or superseded by a newer login.
  // We only clear the local token and redirect; no logout API call is needed
  // because the session is already invalid on the server.
  useEffect(() => {
    const handle401 = () => {
      clearAuthToken();
      window.location.replace("/auth?reason=session_expired");
    };
    setUnauthorizedHandler(handle401);
    return () => setUnauthorizedHandler(null);
  }, []);

  // Re-run /me on every client-side navigation to verify the session is still valid.
  // Next.js layouts don't remount between navigations, so the pathname dep
  // triggers this effect on every route change.
  useEffect(() => {
    let cancelled = false;
    setAuthToken(getAuthToken());
    getUser()
      .then((u) => { if (!cancelled) setUser(u); })
      .catch(() => { if (!cancelled) setUser(null); })
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
