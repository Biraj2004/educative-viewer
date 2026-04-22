import DarkModeToggle from "./DarkModeToggle";
import BackButton from "@/components/edu-viewer/BackButton";
import { BRAND_ICON_URL } from "@/utils/branding";

// ─── Types ────────────────────────────────────────────────────────────────────


interface Crumb {
  label: string;
  href?: string;
}

interface AppNavbarProps {
  /** Breadcrumb segments shown after the EV logo, with "/" separators */
  crumbs?: Crumb[];
  /**
   * Shows a "← backLabel" button on the right.
   * Pass `"back"` (the literal string) to use browser history (router.back()),
   * or a full path string to navigate to that specific page.
   */
  backHref?: string;
  backLabel?: string;
  /** Extra React nodes inserted between back button and DarkModeToggle */
  actions?: React.ReactNode;
  /** Button rendered to the LEFT of the logo on mobile/tablet (hidden on desktop) */
  mobileMenuTrigger?: React.ReactNode;
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
  mobileMenuTrigger,
}: AppNavbarProps) {
  return (
    <div className="sticky top-0 z-50 bg-white/60 dark:bg-[#030712]/60 backdrop-blur-2xl border-b border-gray-200/50 dark:border-white/5 dark:supports-backdrop-filter:bg-[#030712]/40 shadow-sm dark:shadow-[0_4px_24px_-8px_rgba(0,0,0,0.5)] transition-all duration-500">
      <div className="w-full px-8 h-14 flex items-center justify-between gap-5 relative">
        {/* Premium subtle glass edge reflection instead of "gamer" neon */}
        <div className="absolute bottom-0 left-0 w-full h-px bg-linear-to-r from-transparent via-gray-300 dark:via-white/12 to-transparent" />

        {/* ── Left: hamburger (mobile/tablet) + logo + breadcrumbs ──────── */}
        <div className="flex items-center min-w-0 overflow-hidden gap-2">
          {/* Hamburger — only shown on < lg, rendered before the logo */}
          {mobileMenuTrigger && (
            <span className="lg:hidden shrink-0">{mobileMenuTrigger}</span>
          )}
          {/* Logo */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/" className="flex items-center gap-2 group shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={BRAND_ICON_URL}
              alt="Edu-Viewer logo"
              width={28}
              height={28}
              className="no-dark-invert w-7 h-7 bg-transparent object-contain group-hover:opacity-90 transition-opacity select-none"
              style={{ filter: "none", background: "transparent" }}
              loading="eager"
              decoding="async"
            />
            <span className="hidden sm:block font-semibold text-sm text-gray-800 dark:text-gray-200 group-hover:text-indigo-700 dark:group-hover:text-indigo-400 transition-colors whitespace-nowrap">
              Edu-Viewer{" "}
              <span className="text-indigo-600 dark:text-indigo-400 font-bold">PRO</span>
            </span>
          </a>

          {/* Breadcrumbs */}
          {crumbs?.map((crumb, i) => (
            <span key={i} className="flex items-center min-w-0">
              <span className="mx-2.5 text-gray-300 dark:text-gray-700 select-none text-sm shrink-0">/</span>
              {crumb.href ? (
                <a
                  href={crumb.href}
                  className="text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors truncate max-w-45"
                >
                  {crumb.label}
                </a>
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
            <BackButton href={backHref} label={backLabel} icon={<ChevronLeft />} />
          )}
          <span className="ml-2">
            <DarkModeToggle />
          </span>
        </div>

      </div>
    </div>
  );
}
