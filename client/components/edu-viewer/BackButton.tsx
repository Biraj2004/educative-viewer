"use client";

import { useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";

const PREV_PATH_KEY = "ev_prev_path";

function sanitizePath(path: string | null, currentPath: string): string | null {
  if (!path || !path.startsWith("/")) return null;
  const clean = path.split("#")[0];
  if (!clean || clean === currentPath) return null;
  return clean;
}

function isAuthPath(path: string): boolean {
  return path === "/auth" || path.startsWith("/auth/") || path.startsWith("/auth?");
}

function isTopicDetailPath(path: string | null): boolean {
  if (!path) return false;
  return /\/dashboard\/courses\/[^/]+\/[^/]+\/topics\/\d+\/[^/]+$/.test(path);
}

function isCourseDetailPath(path: string | null): boolean {
  if (!path) return false;
  return /^\/dashboard\/courses\/[^/]+\/[^/]+$/.test(path);
}

function isParentRouteTarget(currentPath: string | null, targetPath: string): boolean {
  if (!currentPath || !targetPath.startsWith("/")) return false;
  const bareCurrent = currentPath.split("?")[0];
  const bareTarget = targetPath.split("?")[0];
  if (!bareTarget || bareTarget === "/") return false;
  return bareCurrent !== bareTarget && bareCurrent.startsWith(`${bareTarget}/`);
}

function labelFromPath(path: string): string {
  const bare = path.split("?")[0];
  if (bare.includes("/topics/")) return "Topic";
  if (/^\/dashboard\/courses\/[^/]+\/[^/]+$/.test(bare)) return "Course";
  if (bare.startsWith("/dashboard/courses")) return "Courses";
  if (bare.startsWith("/dashboard/paths")) return "Paths";
  if (bare.startsWith("/dashboard/projects")) return "Projects";
  if (bare.startsWith("/dashboard/profile")) return "Profile";
  if (bare.startsWith("/dashboard/test")) return "Test";
  if (bare === "/") return "Home";
  if (bare.startsWith("/dashboard")) return "Dashboard";
  return "Home";
}

/**
 * Smart back button.
 * - Always prefers `router.back()` (browser history) to return to the
 *   actual previous page.
 * - If there is no browser history entry, falls back to the provided `href`
 *   (or `/` as a final fallback).
 *
 * Usage:
 *   <BackButton href="back" label="Courses" />          ← browser history
 *   <BackButton href="/dashboard" label="Dashboard" />  ← history first, then /dashboard fallback
 */
export default function BackButton({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon?: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const previousPath = useMemo(() => {
    if (typeof window === "undefined") return null;
    try {
      const stored = window.sessionStorage.getItem(PREV_PATH_KEY);
      return sanitizePath(stored, pathname ?? "");
    } catch {
      return null;
    }
  }, [pathname]);

  const buttonCls =
    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-indigo-300 dark:hover:border-indigo-700 hover:text-indigo-700 dark:hover:text-indigo-400 text-xs font-medium transition-all";

  const canUseHistoryTarget = Boolean(previousPath && !isAuthPath(previousPath));

  const resolvedLabel = useMemo(() => {
    if ((label === "Home" || label === "Back") && previousPath && !isAuthPath(previousPath)) {
      return labelFromPath(previousPath);
    }
    return label;
  }, [label, previousPath]);

  const handleBack = () => {
    // Topic pages can add in-page history entries when navigating between topics.
    // For navbar back there, users expect to jump straight to the course page.
    if (isTopicDetailPath(pathname) && href && href !== "back" && !isAuthPath(href)) {
      router.push(href);
      return;
    }

    // Returning from a topic to its course detail should not bounce back into
    // topic history. Honor the explicit section back target instead.
    if (
      isCourseDetailPath(pathname) &&
      isTopicDetailPath(previousPath?.split("?")[0] ?? null) &&
      href &&
      href !== "back" &&
      !isAuthPath(href)
    ) {
      router.push(href);
      return;
    }

    // For explicit parent-route targets (e.g. /dashboard from /dashboard/paths),
    // go directly to the provided target instead of stepping into history.
    if (href && href !== "back" && !isAuthPath(href) && isParentRouteTarget(pathname, href)) {
      router.push(href);
      return;
    }

    if (canUseHistoryTarget && typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }

    if (canUseHistoryTarget && previousPath) {
      router.push(previousPath);
      return;
    }

    if (href && href !== "back" && !isAuthPath(href)) {
      router.push(href);
      return;
    }

    router.push("/");
  };

  return (
    <button type="button" onClick={handleBack} className={buttonCls}>
      {icon}
      {resolvedLabel}
    </button>
  );
}
