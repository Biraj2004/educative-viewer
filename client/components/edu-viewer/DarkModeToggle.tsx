"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/edu-viewer/AuthProvider";
import { setTheme as syncThemeToBackend } from "@/utils/authClient";

function saveTheme(theme: "dark" | "light") {
  try { localStorage.setItem("theme", theme); } catch {}
  document.cookie = `theme=${theme}; path=/; max-age=31536000; SameSite=Lax`;
}

function readSavedTheme(): "dark" | "light" | null {
  try {
    const ls = localStorage.getItem("theme");
    if (ls === "dark" || ls === "light") return ls;
  } catch {}
  // fall back to cookie
  const match = document.cookie.match(/(?:^|;\s*)theme=(dark|light)/);
  if (match) return match[1] as "dark" | "light";
  return null;
}

export default function DarkModeToggle() {
  const { user } = useAuth();
  const [isDark, setIsDark] = useState(false);

  // Hydrate from localStorage/cookie on first render
  useEffect(() => {
    const saved = readSavedTheme();
    const useDark = saved === "dark";
    setIsDark(useDark);
    document.documentElement.classList.toggle("dark", useDark);
    if (!saved) saveTheme("light");
  }, []);

  // When user data arrives (or changes), apply the stored theme from the DB.
  // This overrides the local cookie/localStorage value so the DB is the source
  // of truth for logged-in users.
  useEffect(() => {
    if (!user?.theme) return;
    const useDark = user.theme === "dark";
    setIsDark(useDark);
    document.documentElement.classList.toggle("dark", useDark);
    saveTheme(user.theme);
  }, [user?.theme]);

  const toggle = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    const theme = next ? "dark" : "light";
    saveTheme(theme);
    // Persist to database (fire-and-forget — don't block the toggle)
    syncThemeToBackend(theme).catch(() => {});
  };

  return (
    <button
      onClick={toggle}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className={`relative inline-flex items-center w-11 h-6 rounded-full transition-colors duration-200 shrink-0 cursor-pointer ${
        isDark ? "bg-indigo-600" : "bg-gray-300"
      }`}
    >
      <span
        className={`inline-flex items-center justify-center w-5 h-5 rounded-full bg-white shadow-sm transform transition-transform duration-200 ${
          isDark ? "translate-x-5.5" : "translate-x-0.5"
        }`}
      >
        {isDark ? (
          <svg className="w-3 h-3 text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
            <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
          </svg>
        ) : (
          <svg className="w-3 h-3 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
          </svg>
        )}
      </span>
    </button>
  );
}
