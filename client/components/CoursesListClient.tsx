"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import CourseSearchInput from "./CourseSearchInput";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Course {
  id: number | string;
  title: string;
  description?: string;
  slug?: string;
  author?: string;
  level?: string;
  duration?: string;
  lessons?: number;
  chapters?: number;
  rating?: number;
  [key: string]: unknown;
}

// ─── Level colour ─────────────────────────────────────────────────────────────

function levelBadge(level?: string) {
  if (!level) return null;
  const lower = level.toLowerCase();
  let cls = "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400";
  if (lower.includes("begin")) cls = "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400";
  if (lower.includes("inter")) cls = "bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400";
  if (lower.includes("adv"))   cls = "bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400";
  return (
    <span className={`inline-flex items-center text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${cls}`}>
      {level}
    </span>
  );
}

// ─── Course initials avatar ────────────────────────────────────────────────────

const PALETTE = [
  ["bg-indigo-100 dark:bg-indigo-900/50", "text-indigo-600 dark:text-indigo-400"],
  ["bg-violet-100 dark:bg-violet-900/50", "text-violet-600 dark:text-violet-400"],
  ["bg-sky-100 dark:bg-sky-900/50",       "text-sky-600 dark:text-sky-400"],
  ["bg-emerald-100 dark:bg-emerald-900/50","text-emerald-600 dark:text-emerald-400"],
  ["bg-rose-100 dark:bg-rose-900/50",     "text-rose-600 dark:text-rose-400"],
  ["bg-amber-100 dark:bg-amber-900/50",   "text-amber-600 dark:text-amber-400"],
];

function CourseAvatar({ title, index }: { title: string; index: number }) {
  const [bg, text] = PALETTE[index % PALETTE.length];
  const initials = title
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
  return (
    <div className={`w-11 h-11 rounded-lg flex items-center justify-center shrink-0 font-bold text-sm select-none ${bg} ${text}`}>
      {initials}
    </div>
  );
}

// ─── Component ─────────────────────────────────────────────────────────────────

interface Props {
  courses: Course[];
  error?: string;
}

export default function CoursesListClient({ courses, error }: Props) {
  const searchParams = useSearchParams();
  // Initialise from URL so shared ?q= links still work on first load
  const [q, setQ] = useState(() => searchParams.get("q") ?? "");
  const normalised = q.toLowerCase().trim();

  const filtered = normalised
    ? courses.filter((c) => c.title.toLowerCase().includes(normalised))
    : courses;

  return (
    <>
      {/* Search */}
      <div className="max-w-5xl mx-auto px-6 pt-6 pb-2">
        <CourseSearchInput
          value={q}
          onChange={setQ}
          placeholder="Search courses…"
          totalCount={courses.length}
          filteredCount={filtered.length}
        />
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6">

        {/* Error state */}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 px-5 py-4 text-sm text-red-700 dark:text-red-400">
            <span className="font-medium">Failed to load courses:</span> {error}
          </div>
        )}

        {/* Empty state */}
        {!error && filtered.length === 0 && (
          <div className="text-center py-24 text-gray-400 dark:text-gray-600">
            <svg className="w-10 h-10 mx-auto mb-3 opacity-40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <p className="text-sm">
              {normalised ? <>No courses matched &ldquo;{q}&rdquo;</> : "No courses found."}
            </p>
          </div>
        )}

        {/* Course list */}
        {filtered.length > 0 && (
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden divide-y divide-gray-100 dark:divide-gray-800">
            {filtered.map((course, i) => {
              const href = `/edu-viewer/courses/${course.id}/${course.slug ?? course.id}`;
              return (
                <Link
                  key={course.id}
                  href={href}
                  className="group flex items-center gap-4 px-5 py-4 hover:bg-gray-50/70 dark:hover:bg-gray-800/50 transition-colors"
                >
                  {/* Index number */}
                  <span className="w-6 text-right text-xs font-medium text-gray-400 dark:text-gray-600 shrink-0 tabular-nums">
                    {i + 1}
                  </span>

                  {/* Initials avatar */}
                  <CourseAvatar title={course.title} index={i} />

                  {/* Text block */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 group-hover:text-indigo-700 dark:group-hover:text-indigo-400 transition-colors leading-snug">
                        {course.title}
                      </h2>
                      {levelBadge(course.level)}
                    </div>
                    {course.description && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed line-clamp-1">
                        {course.description}
                      </p>
                    )}
                    {/* Meta */}
                    <div className="flex flex-wrap items-center gap-3 mt-1.5 text-[11px] text-gray-400 dark:text-gray-500">
                      {course.author && (
                        <span className="flex items-center gap-1">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0zM4.501 20.118a7.5 7.5 0 0 1 14.998 0" />
                          </svg>
                          {course.author}
                        </span>
                      )}
                      {course.lessons !== undefined && (
                        <span className="flex items-center gap-1">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
                          </svg>
                          {course.lessons} lessons
                        </span>
                      )}
                      {course.duration && (
                        <span className="flex items-center gap-1">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="9" />
                            <path strokeLinecap="round" d="M12 6v6l4 2" />
                          </svg>
                          {course.duration}
                        </span>
                      )}
                      {course.rating !== undefined && (
                        <span className="flex items-center gap-1 text-amber-400">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                          </svg>
                          <span className="text-gray-400">{course.rating}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Arrow */}
                  <svg
                    className="w-4 h-4 text-gray-300 dark:text-gray-700 group-hover:text-indigo-400 transition-colors shrink-0"
                    viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"
                  >
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                </Link>
              );
            })}
          </div>
        )}

      </div>
    </>
  );
}
