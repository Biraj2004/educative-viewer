"use client";

import { useRef, useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "./AuthProvider";

// ─── Avatar initials helper ───────────────────────────────────────────────────

function getInitials(user: { name?: string; username?: string; email: string }): string {
  const source = user.name ?? user.username ?? user.email ?? "";
  return source
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("") || "?";
}

function getDisplayName(user: { name?: string; username?: string; email: string }): string {
  return user.name ?? user.username ?? user.email;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function UserMenu() {
  const { user, loading, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  if (loading) {
    return <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />;
  }

  if (!user) {
    return (
      <Link
        href="/auth"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors"
      >
        Sign In
      </Link>
    );
  }

  const initials = getInitials(user);
  const displayName = getDisplayName(user);
  const firstName = (user.name ?? user.username ?? "").split(/\s+/)[0] || user.email.split("@")[0];

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-full pr-2 pl-0.5 py-0.5 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer group"
        aria-expanded={open}
        aria-haspopup="true"
      >
        {/* Avatar */}
        <span className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center shrink-0 select-none">
          {user.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.avatar} alt={displayName} className="w-7 h-7 rounded-full object-cover" />
          ) : (
            <span className="text-white text-[10px] font-bold">{initials}</span>
          )}
        </span>
        {/* Name */}
        <span className="hidden sm:block text-xs font-semibold text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-gray-100 transition-colors max-w-24 truncate">
          {firstName}
        </span>
        {/* Chevron */}
        <svg
          className={`w-3 h-3 text-gray-400 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}
          strokeLinecap="round" strokeLinejoin="round"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-lg shadow-gray-100/50 dark:shadow-black/30 overflow-hidden z-50">
          {/* User info header */}
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-3">
              <span className="w-9 h-9 rounded-full bg-indigo-600 flex items-center justify-center shrink-0 select-none">
                {user.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.avatar} alt={displayName} className="w-9 h-9 rounded-full object-cover" />
                ) : (
                  <span className="text-white text-[11px] font-bold">{initials}</span>
                )}
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-gray-900 dark:text-gray-100 truncate">{displayName}</p>
                <p className="text-[11px] text-gray-400 dark:text-gray-600 truncate">{user.email}</p>
              </div>
            </div>
          </div>

          {/* Menu items */}
          <div className="py-1">
            <Link
              href="/dashboard/profile"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-indigo-700 dark:hover:text-indigo-400 transition-colors cursor-pointer"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
              </svg>
              <span className="text-xs font-medium">Profile</span>
            </Link>

            <div className="h-px bg-gray-100 dark:bg-gray-800 my-1" />

            <button
              type="button"
              onClick={() => { setOpen(false); logout(); }}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 transition-colors cursor-pointer"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              <span className="text-xs font-medium">Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
