"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import DarkModeToggle from "./DarkModeToggle";
import BackButton from "@/components/edu-viewer/BackButton";
import { BRAND_LOGO_URL } from "@/utils/branding";
import { useAuth } from "@/components/edu-viewer/AuthProvider";

interface Crumb {
  label: string;
  href?: string;
  onClick?: () => void;
}

interface AppNavbarProps {
  /** Breadcrumb segments shown after the EV logo, with "/" separators */
  crumbs?: Crumb[];
  /**
   * Shows a "<- backLabel" button on the right.
   * Pass "back" (the literal string) to use browser history (router.back()),
   * or a full path string to navigate to that specific page.
   */
  backHref?: string;
  backLabel?: string;
  /** Extra React nodes inserted between back button and DarkModeToggle */
  actions?: React.ReactNode;
  /** Button rendered to the left of the logo on mobile/tablet (hidden on desktop) */
  mobileMenuTrigger?: React.ReactNode;
  /** Optional custom URL for the logo click. Defaults to "/" */
  logoHref?: string;
  /** Optional custom click handler for the logo */
  onLogoClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
  /** Optional custom click handler for the back button */
  onBackClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
}

const NAVBAR_COLLAPSE_STORAGE_KEY = "ev_navbar_collapsed_v1";
const NAVBAR_OFFSET_CSS_VAR = "--ev-navbar-offset";

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

function ChevronDown() {
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
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function ChevronUp() {
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
      <path d="m18 15-6-6-6 6" />
    </svg>
  );
}

export default function AppNavbar({
  crumbs,
  backHref,
  backLabel = "Back",
  actions,
  mobileMenuTrigger,
  logoHref,
  onLogoClick,
  onBackClick,
}: AppNavbarProps) {
  const { user } = useAuth();
  const [navbarCollapsed, setNavbarCollapsed] = useState(false);
  const [navbarPrefReady, setNavbarPrefReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(NAVBAR_COLLAPSE_STORAGE_KEY);
      if (raw === "1") {
        setNavbarCollapsed(true);
      }
    } catch {
      // ignore localStorage read errors
    } finally {
      setNavbarPrefReady(true);
    }
  }, []);

  useEffect(() => {
    if (!navbarPrefReady) return;
    try {
      localStorage.setItem(NAVBAR_COLLAPSE_STORAGE_KEY, navbarCollapsed ? "1" : "0");
    } catch {
      // ignore localStorage write errors
    }
  }, [navbarCollapsed, navbarPrefReady]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    root.style.setProperty(NAVBAR_OFFSET_CSS_VAR, navbarCollapsed ? "0px" : "56px");
    return () => {
      root.style.removeProperty(NAVBAR_OFFSET_CSS_VAR);
    };
  }, [navbarCollapsed]);

  if (navbarCollapsed) {
    return (
      <div className="fixed top-0 left-0 right-0 z-[60] h-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 pointer-events-auto">
          <button
            type="button"
            onClick={() => setNavbarCollapsed(false)}
            aria-label="Show navigation bar"
            title="Show navigation bar"
            className="inline-flex items-center justify-center h-5 w-7 rounded-b-md border-x border-b border-gray-200/70 dark:border-white/10 bg-white/80 dark:bg-[#030712]/80 backdrop-blur-xl text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer shadow-sm"
          >
            <ChevronDown />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="sticky top-0 z-[60] bg-white/60 dark:bg-[#030712]/60 backdrop-blur-2xl border-b border-gray-200/50 dark:border-white/5 dark:supports-backdrop-filter:bg-[#030712]/40 shadow-sm dark:shadow-[0_4px_24px_-8px_rgba(0,0,0,0.5)] transition-all duration-500">
      <div className="absolute left-1/2 -translate-x-1/2 z-10" style={{ top: "calc(100% + 4px)" }}>
        <button
          type="button"
          onClick={() => setNavbarCollapsed(true)}
          aria-label="Hide navigation bar"
          title="Hide navigation bar"
          className="inline-flex items-center justify-center h-5 w-7 rounded-b-md border-x border-b border-gray-200/70 dark:border-white/10 bg-white/80 dark:bg-[#030712]/80 backdrop-blur-xl text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer shadow-sm"
        >
          <ChevronUp />
        </button>
      </div>

      <div className="w-full px-4 sm:px-8 h-14 flex items-center justify-between gap-3 sm:gap-5 relative">
        <div className="absolute bottom-0 left-0 w-full h-px bg-linear-to-r from-transparent via-gray-300 dark:via-white/12 to-transparent" />

        <div className="flex items-center min-w-0 overflow-hidden gap-2">
          {mobileMenuTrigger && (
            <span className="lg:hidden shrink-0">{mobileMenuTrigger}</span>
          )}

          <Link href={logoHref || "/"} prefetch={false} onClick={onLogoClick} className="flex items-center gap-2 group shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={BRAND_LOGO_URL}
              alt="Edu-Viewer logo"
              width={28}
              height={28}
              className="no-dark-invert w-7 h-7 bg-transparent object-contain group-hover:opacity-90 transition-opacity select-none"
              style={{ filter: "none", background: "transparent" }}
              loading="eager"
              decoding="async"
            />
            <span className="hidden sm:flex flex-col font-semibold text-sm text-gray-800 dark:text-gray-200 group-hover:text-indigo-700 dark:group-hover:text-indigo-400 transition-colors whitespace-nowrap leading-tight">
              <span>
                Edu-Viewer <span className="text-indigo-600 dark:text-indigo-400 font-bold">PRO</span>
              </span>
              {process.env.NEXT_PUBLIC_VERSION && (
                <span className="text-[10px] font-normal text-gray-400 dark:text-gray-500 leading-none tracking-wide">
                  v{process.env.NEXT_PUBLIC_VERSION}
                </span>
              )}
            </span>
          </Link>

          {crumbs?.map((crumb, i) => {
            const isLast = i === crumbs.length - 1;
            return (
              <span key={i} className={`items-center min-w-0 ${isLast ? "flex" : "hidden sm:flex"}`}>
                <span className="mx-1.5 sm:mx-2.5 text-gray-300 dark:text-gray-700 select-none text-sm shrink-0">/</span>
                {crumb.onClick ? (
                  <button
                    onClick={crumb.onClick}
                    className="text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors truncate max-w-[7rem] sm:max-w-[15rem] cursor-pointer"
                  >
                    {crumb.label}
                  </button>
                ) : crumb.href ? (
                  <Link
                    href={crumb.href}
                    prefetch={false}
                    className="text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors truncate max-w-[7rem] sm:max-w-[15rem]"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate max-w-[7rem] sm:max-w-[15rem]">
                    {crumb.label}
                  </span>
                )}
              </span>
            );
          })}
        </div>

        <div className="flex items-center gap-4 shrink-0">
          {actions}
          {backHref && (
            <BackButton href={backHref} label={backLabel} icon={<ChevronLeft />} onClick={onBackClick} />
          )}
          {!user && (
            <span className="ml-2">
              <DarkModeToggle />
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
