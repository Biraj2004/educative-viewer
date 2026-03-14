"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppNavbar from "@/components/AppNavbar";
import UserMenu from "@/components/UserMenu";
import { getAuthToken } from "@/utils/authClient";

// ─── Section data ─────────────────────────────────────────────────────────────

const sections = [
  {
    href: "/dashboard/courses",
    label: "Courses",
    accent: "indigo",
    available: true,
    desc: "Structured, text-based courses with live coding, quizzes, and interactive exercises. Learn at your own pace.",
    icon: (
      <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
      </svg>
    ),
    tags: ["Text-first", "Interactive", "Sandboxes"],
  },
  {
    href: "#",
    label: "Paths",
    accent: "violet",
    available: false,
    desc: "Curated skill paths that sequence multiple courses into a guided learning journey toward a specific goal.",
    icon: (
      <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="5" r="2" />
        <circle cx="5" cy="19" r="2" />
        <circle cx="19" cy="19" r="2" />
        <path d="M12 7v4M8.5 17.5 12 11l3.5 6.5M8.5 17.5h7" />
      </svg>
    ),
    tags: ["Multi-course", "Skill paths", "Certificates"],
  },
  {
    href: "#",
    label: "Projects",
    accent: "emerald",
    available: false,
    desc: "Hands-on projects with step-by-step guided implementation. Build real things you can show off.",
    icon: (
      <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <path d="M14 17.5h7M17.5 14v7" />
      </svg>
    ),
    tags: ["Build", "Portfolio", "Guided"],
  },
  {
    href: "#",
    label: "Cloud Labs",
    accent: "sky",
    available: false,
    desc: "Pre-configured cloud environments for hands-on practice. No setup required — just open and code.",
    icon: (
      <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
      </svg>
    ),
    tags: ["No setup", "Browser-based", "Sandboxed"],
  },
];

const accentBg: Record<string, string> = {
  indigo: "bg-indigo-50 dark:bg-indigo-950/50",
  violet: "bg-violet-50 dark:bg-violet-950/50",
  emerald: "bg-emerald-50 dark:bg-emerald-950/50",
  sky: "bg-sky-50 dark:bg-sky-950/50",
};
const accentIcon: Record<string, string> = {
  indigo: "text-indigo-500 dark:text-indigo-400",
  violet: "text-violet-500 dark:text-violet-400",
  emerald: "text-emerald-500 dark:text-emerald-400",
  sky: "text-sky-500 dark:text-sky-400",
};
const accentBorder: Record<string, string> = {
  indigo: "hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-indigo-100/60 dark:hover:shadow-indigo-950/40",
  violet: "hover:border-violet-300 dark:hover:border-violet-700 hover:shadow-violet-100/60 dark:hover:shadow-violet-950/40",
  emerald: "hover:border-emerald-300 dark:hover:border-emerald-700 hover:shadow-emerald-100/60 dark:hover:shadow-emerald-950/40",
  sky: "hover:border-sky-300 dark:hover:border-sky-700 hover:shadow-sky-100/60 dark:hover:shadow-sky-950/40",
};
const accentTag: Record<string, string> = {
  indigo: "bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400",
  violet: "bg-violet-50 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400",
  emerald: "bg-emerald-50 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400",
  sky: "bg-sky-50 dark:bg-sky-900/40 text-sky-600 dark:text-sky-400",
};

function IconArrow() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  );
}

export default function DashboardHome() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getAuthToken()) {
      window.location.replace("/");
    } else {
      // eslint-disable-next-line
      setReady(true);
    }
  }, []);

  if (!ready) return null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <AppNavbar crumbs={[{ label: "Dashboard" }]} backHref="/" backLabel="Home" actions={<UserMenu />} />

      {/* Page header */}
      <div className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="max-w-5xl mx-auto px-6 py-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-indigo-500 dark:text-indigo-400 mb-1">Edu-Viewer PRO</p>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">What do you want to learn?</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Choose a learning format to get started.</p>
        </div>
      </div>

      {/* Section grid */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="grid sm:grid-cols-2 gap-4">
          {sections.map((s) => {
            const cardBase =
              "group relative flex flex-col rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 transition-all duration-150 hover:shadow-lg " +
              accentBorder[s.accent];

            const inner = (
              <>
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-5 ${accentBg[s.accent]} ${accentIcon[s.accent]}`}>
                  {s.icon}
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">{s.label}</h2>
                  {!s.available && (
                    <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500">
                      Coming soon
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed mb-5 flex-1">{s.desc}</p>
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {s.tags.map((tag) => (
                    <span key={tag} className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full ${accentTag[s.accent]}`}>
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-800">
                  {s.available ? (
                    <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 group-hover:underline flex items-center gap-1">
                      Browse {s.label} <IconArrow />
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400 dark:text-gray-600">Not available yet</span>
                  )}
                </div>
              </>
            );

            return s.available ? (
              <Link key={s.label} href={s.href} className={cardBase}>{inner}</Link>
            ) : (
              <div key={s.label} className={`${cardBase} opacity-60 cursor-not-allowed`}>{inner}</div>
            );
          })}
        </div>

        {/* Dev tools */}
        <div className="mt-6 flex justify-end">
          <Link
            href="/dashboard/test"
            className="inline-flex font-bold items-center gap-1.5 text-xs text-gray-400 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-400 transition-colors"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="16 18 22 12 16 6" />
              <polyline points="8 6 2 12 8 18" />
            </svg>
            Component&apos;s Test Page
          </Link>
        </div>
      </div>
    </div>
  );
}
