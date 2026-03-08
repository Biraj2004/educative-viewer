import Link from "next/link";
import DarkModeToggle from "./DarkModeToggle";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Crumb {
  label: string;
  href?: string;
}

interface AppNavbarProps {
  /** Breadcrumb segments shown after the EV logo, with "/" separators */
  crumbs?: Crumb[];
  /** Shows a "← backLabel" button on the right */
  backHref?: string;
  backLabel?: string;
  /** Extra React nodes inserted between back button and DarkModeToggle */
  actions?: React.ReactNode;
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function ChevronLeft() {
  return (
    <svg
      className="w-3 h-3"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AppNavbar({
  crumbs,
  backHref,
  backLabel = "Back",
  actions,
}: AppNavbarProps) {
  return (
    <div className="sticky top-0 z-20 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border-b border-gray-200 dark:border-gray-800 shadow-sm">
      <div className="w-full px-8 h-14 flex items-center justify-between gap-5">

        {/* ── Left: logo + breadcrumbs ─────────────────────────────────── */}
        <div className="flex items-center min-w-0 overflow-hidden">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group shrink-0">
            <span className="w-7 h-7 rounded-md bg-indigo-600 group-hover:bg-indigo-700 transition-colors flex items-center justify-center select-none">
              <span className="text-white font-bold text-[11px] tracking-tight">EV</span>
            </span>
            <span className="hidden sm:block font-semibold text-sm text-gray-800 dark:text-gray-200 group-hover:text-indigo-700 dark:group-hover:text-indigo-400 transition-colors whitespace-nowrap">
              Edu-Viewer{" "}
              <span className="text-indigo-600 dark:text-indigo-400 font-bold">PRO</span>
            </span>
          </Link>

          {/* Breadcrumbs */}
          {crumbs?.map((crumb, i) => (
            <span key={i} className="flex items-center min-w-0">
              <span className="mx-2.5 text-gray-300 dark:text-gray-700 select-none text-sm shrink-0">/</span>
              {crumb.href ? (
                <Link
                  href={crumb.href}
                  className="text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors truncate max-w-45"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate max-w-45">
                  {crumb.label}
                </span>
              )}
            </span>
          ))}
        </div>

        {/* ── Right: actions + back + toggle ───────────────────────────── */}
        <div className="flex items-center gap-4 shrink-0">
          {actions}
          {backHref && (
            <Link
              href={backHref}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-indigo-300 dark:hover:border-indigo-700 hover:text-indigo-700 dark:hover:text-indigo-400 text-xs font-medium transition-all"
            >
              <ChevronLeft />
              {backLabel}
            </Link>
          )}
          <span className="ml-2">
            <DarkModeToggle />
          </span>
        </div>

      </div>
    </div>
  );
}
