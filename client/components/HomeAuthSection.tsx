"use client";

/**
 * HomeAuthSection — client-side auth state for the landing page.
 *
 * Why this exists:
 *   The home page is a server component. Its SSR render is correct at request
 *   time, but Next.js stores the rendered payload in a client-side router cache.
 *   If another browser/tab logs in and supersedes the current session, the user
 *   gets redirected to /auth but navigating back to "/" serves the *cached* render
 *   (showing "Launch App" even though they are now signed out).
 *
 *   This component re-validates auth on every mount via /api/auth/me and updates
 *   the UI immediately, even if the page was served from the router cache.
 */

import { createContext, useContext, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getUser, clearAuthToken } from "@/utils/authClient";

// ─── Auth context shared across all auth-sensitive spots on the page ──────────

interface HomeAuthCtxValue {
  isAuthed: boolean | null; // null = still loading
  setIsAuthed: (v: boolean) => void;
}

const HomeAuthCtx = createContext<HomeAuthCtxValue>({
  isAuthed: null,
  setIsAuthed: () => {},
});

export function HomeAuthProvider({
  children,
}: {
  initialIsAuthed?: boolean; // kept for API compat, ignored — token is in localStorage
  children: React.ReactNode;
}) {
  // Start as null (loading) so we never flash "Sign In" for an authenticated user.
  const [isAuthed, setIsAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    getUser()
      .then(() => setIsAuthed(true))
      .catch((err) => {
        // If the token was revoked (session superseded), clear stale token.
        if (err?.status === 401) clearAuthToken();
        setIsAuthed(false);
      });
  }, []);

  return (
    <HomeAuthCtx.Provider value={{ isAuthed, setIsAuthed }}>
      {children}
    </HomeAuthCtx.Provider>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function IconArrow() {
  return (
    <svg
      className="w-4 h-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  );
}

// ─── Nav sign-in button ───────────────────────────────────────────────────────
// Shown in the navbar only when the user is NOT authenticated.

export function HomeNavSignIn() {
  const { isAuthed } = useContext(HomeAuthCtx);
  // While loading keep whatever was SSR'd (null treated as true so we don't
  // flash an extra button while the fetch is in flight).
  if (isAuthed !== false) return null;
  return (
    <Link
      href="/auth?next=/dashboard"
      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors"
    >
      Sign In
      <IconArrow />
    </Link>
  );
}

// ─── Hero primary CTA ─────────────────────────────────────────────────────────

export function HomeHeroCTA() {
  const { isAuthed, setIsAuthed } = useContext(HomeAuthCtx);
  const router = useRouter();
  const appHref = "/dashboard";
  const signInHref = "/auth?next=/dashboard";

  const handleLaunch = async (e: React.MouseEvent) => {
    e.preventDefault();
    window.dispatchEvent(new Event("navprogress:start"));
    try {
      await getUser();
      router.push(appHref);
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status;
      if (status === 401) {
        clearAuthToken();
        setIsAuthed(false);
        window.dispatchEvent(new Event("navprogress:done")); // not navigating — cancel bar
      } else {
        // Non-401 (network glitch etc.) — navigate anyway
        router.push(appHref);
      }
    }
  };

  if (isAuthed) {
    return (
      <button
        onClick={handleLaunch}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold shadow-md shadow-indigo-500/20 hover:shadow-lg hover:shadow-indigo-500/30 hover:-translate-y-px transition-all cursor-pointer"
      >
        Launch App
        <IconArrow />
      </button>
    );
  }

  return (
    <Link
      href={signInHref}
      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold shadow-md shadow-indigo-500/20 hover:shadow-lg hover:shadow-indigo-500/30 hover:-translate-y-px transition-all"
    >
      Sign In
      <IconArrow />
    </Link>
  );
}

// ─── Bottom CTA section (text + button) ──────────────────────────────────────

export function HomeBottomCTA() {
  const { isAuthed, setIsAuthed } = useContext(HomeAuthCtx);
  const router = useRouter();
  const appHref = "/dashboard";
  const signInHref = "/auth?next=/dashboard";

  const handleLaunch = async (e: React.MouseEvent) => {
    e.preventDefault();
    window.dispatchEvent(new Event("navprogress:start"));
    try {
      await getUser();
      router.push(appHref);
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status;
      if (status === 401) {
        clearAuthToken();
        setIsAuthed(false);
        window.dispatchEvent(new Event("navprogress:done")); // not navigating — cancel bar
      } else {
        router.push(appHref);
      }
    }
  };

  return (
    <div className="max-w-sm mx-auto">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
        Ready to explore?
      </h2>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-8">
        {isAuthed
          ? "Welcome back. Jump straight into your courses."
          : "Sign in to access your courses and start learning."}
      </p>
      {isAuthed ? (
        <button
          onClick={handleLaunch}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold shadow-md shadow-indigo-500/20 hover:shadow-lg hover:shadow-indigo-500/30 hover:-translate-y-px transition-all cursor-pointer"
        >
          Launch Edu-Viewer PRO
          <IconArrow />
        </button>
      ) : (
        <Link
          href={signInHref}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold shadow-md shadow-indigo-500/20 hover:shadow-lg hover:shadow-indigo-500/30 hover:-translate-y-px transition-all"
        >
          Sign In to Get Started
          <IconArrow />
        </Link>
      )}
    </div>
  );
}
