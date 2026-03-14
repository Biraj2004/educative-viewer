"use client";

import { useRouter } from "next/navigation";

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

  const buttonCls =
    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-indigo-300 dark:hover:border-indigo-700 hover:text-indigo-700 dark:hover:text-indigo-400 text-xs font-medium transition-all";

  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }

    if (href && href !== "back") {
      router.push(href);
      return;
    }

    router.push("/");
  };

  return (
    <button type="button" onClick={handleBack} className={buttonCls}>
      {icon}
      {label}
    </button>
  );
}
