"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { getUser, logout as logoutApi } from "@/utils/authClient";
import type { AuthUser } from "@/utils/authClient";

// ─── Context ──────────────────────────────────────────────────────────────────

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  logout: async () => {},
  refresh: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();

  // Re-run on every client-side navigation (pathname change).
  // Next.js layouts don't remount on navigation, so without this dependency
  // the check would only fire once when first entering /edu-viewer/*.
  useEffect(() => {
    let cancelled = false;
    getUser()
      .then((u) => { if (!cancelled) setUser(u); })
      .catch((err) => {
        if (!cancelled) {
          setUser(null);
          // If the server rejected the session (401 — superseded by a newer login),
          // force the user back to the sign-in page.
          const msg: string = err instanceof Error ? err.message : "";
          if (msg.includes("401") || msg.toLowerCase().includes("session") || msg.toLowerCase().includes("authenticated")) {
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
      window.location.href = "/auth";
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}
