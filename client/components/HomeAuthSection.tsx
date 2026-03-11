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

// ─── Auth context shared across all auth-sensitive spots on the page ──────────

const HomeAuthCtx = createContext<boolean | null>(null); // null = still loading

export function HomeAuthProvider({
  initialIsAuthed,
  children,
}: {
  initialIsAuthed: boolean;
  children: React.ReactNode;
}) {
  // Initialise from SSR value so there is no flash on first load.
  // The useEffect will immediately correct it if the router-cache was stale.
  const [isAuthed, setIsAuthed] = useState<boolean | null>(initialIsAuthed);

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then((r) => setIsAuthed(r.ok))
      .catch(() => setIsAuthed(false));
  }, []);

  return (
    <HomeAuthCtx.Provider value={isAuthed}>{children}</HomeAuthCtx.Provider>
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
  const isAuthed = useContext(HomeAuthCtx);
  // While loading keep whatever was SSR'd (null treated as true so we don't
  // flash an extra button while the fetch is in flight).
  if (isAuthed !== false) return null;
  return (
    <Link
      href="/auth?next=/edu-viewer"
      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors"
    >
      Sign In
      <IconArrow />
    </Link>
  );
}

// ─── Hero primary CTA ─────────────────────────────────────────────────────────

export function HomeHeroCTA() {
  const isAuthed = useContext(HomeAuthCtx);
  const appHref = "/edu-viewer";
  const signInHref = "/auth?next=/edu-viewer";

  return (
    <Link
      href={isAuthed ? appHref : signInHref}
      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold shadow-md shadow-indigo-500/20 hover:shadow-lg hover:shadow-indigo-500/30 hover:-translate-y-px transition-all"
    >
      {isAuthed ? "Launch App" : "Sign In"}
      <IconArrow />
    </Link>
  );
}

// ─── Bottom CTA section (text + button) ──────────────────────────────────────

export function HomeBottomCTA() {
  const isAuthed = useContext(HomeAuthCtx);
  const appHref = "/edu-viewer";
  const signInHref = "/auth?next=/edu-viewer";

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
      <Link
        href={isAuthed ? appHref : signInHref}
        className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold shadow-md shadow-indigo-500/20 hover:shadow-lg hover:shadow-indigo-500/30 hover:-translate-y-px transition-all"
      >
        {isAuthed ? "Launch Edu-Viewer PRO" : "Sign In to Get Started"}
        <IconArrow />
      </Link>
    </div>
  );
}
