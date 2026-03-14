"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

/**
 * Smart back button.
 * - If `href` is `"back"` → calls `router.back()` (browser history).
 * - Otherwise → navigates to the given `href` as a normal link.
 *
 * Usage:
 *   <BackButton href="back" label="Courses" />          ← browser history
 *   <BackButton href="/dashboard" label="Dashboard" />  ← fixed destination
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

  if (href === "back") {
    return (
      <button
        type="button"
        onClick={() => router.back()}
        className={buttonCls}
      >
        {icon}
        {label}
      </button>
    );
  }

  return (
    <Link href={href} className={buttonCls}>
      {icon}
      {label}
    </Link>
  );
}
