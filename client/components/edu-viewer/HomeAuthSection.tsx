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
import { motion } from "framer-motion";
import { ArrowRight, LogIn, Rocket } from "lucide-react";

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
  initialIsAuthed?: boolean; 
  children: React.ReactNode;
}) {
  const [isAuthed, setIsAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    getUser()
      .then(() => setIsAuthed(true))
      .catch((err) => {
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

// ─── Nav sign-in button ───────────────────────────────────────────────────────

const MotionLink = motion.create(Link);

export function HomeNavSignIn() {
  const { isAuthed } = useContext(HomeAuthCtx);
  if (isAuthed !== false) return null;
  
  return (
    <MotionLink
      href="/auth?next=/dashboard"
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 dark:bg-gray-800/50 backdrop-blur-md border border-gray-200 dark:border-gray-700 hover:bg-white/20 dark:hover:bg-gray-800 hover:border-indigo-400 dark:hover:border-indigo-500 text-gray-800 dark:text-gray-200 text-sm font-medium transition-colors"
    >
      <LogIn className="w-4 h-4" />
      Sign In
    </MotionLink>
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
        window.dispatchEvent(new Event("navprogress:done")); 
      } else {
        router.push(appHref);
      }
    }
  };

  const buttonClasses = "relative group inline-flex items-stretch overflow-hidden rounded-full p-[1px]";
  const innerClasses = "inline-flex items-center gap-2 px-6 py-3 rounded-full bg-indigo-600 group-hover:bg-indigo-700 text-white text-base font-semibold transition-colors shadow-[0_0_20px_rgba(99,102,241,0.4)] backdrop-blur-xl relative z-10";

  if (isAuthed) {
    return (
      <motion.button 
        onClick={handleLaunch} 
        className={buttonClasses}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <div className="absolute inset-0 bg-linear-to-r from-indigo-400 via-fuchsia-400 to-indigo-400 opacity-70 group-hover:opacity-100 animate-[marquee_3s_linear_infinite]" style={{ backgroundSize: '200% auto' }} />
        <span className={innerClasses}>
          Launch App
          <Rocket className="w-5 h-5" />
        </span>
      </motion.button>
    );
  }

  return (
    <MotionLink 
      href={signInHref} 
      className={buttonClasses}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      <div className="absolute inset-0 bg-linear-to-r from-indigo-400 via-violet-500 to-fuchsia-400 opacity-70 group-hover:opacity-100 animate-[marquee_3s_linear_infinite]" style={{ backgroundSize: '200% auto' }} />
      <span className={innerClasses}>
        Sign In to Platform
        <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
      </span>
    </MotionLink>
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
        window.dispatchEvent(new Event("navprogress:done")); 
      } else {
        router.push(appHref);
      }
    }
  };

  const ctaButtonClasses = "inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gray-900 border border-transparent dark:bg-white dark:text-gray-900 text-white hover:bg-gray-800 dark:hover:bg-gray-100 text-base font-semibold shadow-xl hover:shadow-2xl transition-all relative z-10";

  return (
    <motion.div 
      className="max-w-xl mx-auto rounded-4xl p-10 bg-white/5 dark:bg-gray-900/40 backdrop-blur-2xl border border-gray-200/50 dark:border-gray-800/50 relative overflow-hidden"
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, ease: "easeOut" }}
    >
      <div className="absolute inset-0 bg-linear-to-b from-indigo-500/10 to-transparent pointer-events-none" />
      <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-4 relative z-10">
        Ready to build the future?
      </h2>
      <p className="text-base text-gray-600 dark:text-gray-400 mb-8 relative z-10">
        {isAuthed
          ? "Welcome back. Jump straight into your workspace."
          : "Join today and experience the most advanced learning viewer."}
      </p>
      {isAuthed ? (
        <motion.button
          onClick={handleLaunch}
          className={ctaButtonClasses}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          Launch Edu-Viewer PRO
          <Rocket className="w-4 h-4" />
        </motion.button>
      ) : (
        <MotionLink
          href={signInHref}
          className={ctaButtonClasses}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          Get Started Now
          <ArrowRight className="w-5 h-5 ml-1" />
        </MotionLink>
      )}
    </motion.div>
  );
}
