"use client";

import { useState, useEffect } from "react";
import AppNavbar from "@/components/AppNavbar";
import CoursesListClient from "@/components/CoursesListClient";
import UserMenu from "@/components/UserMenu";
import { getAuthToken, clearAuthToken, getProgress, getUser } from "@/utils/authClient";
import type { ProgressData } from "@/utils/authClient";
import ScrollToTop from "@/components/ScrollToTop";

const BACKEND = (process.env.NEXT_PUBLIC_BACKEND_API_BASE ?? "").replace(/\/$/, "");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const inflightFetches = new Map<string, Promise<any>>();

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

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [progress, setProgress] = useState<ProgressData>({ course_order: [], completed: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const hadToken = Boolean(getAuthToken());

    getUser()
      .then(() => {
        if (cancelled) return;

        const token = getAuthToken();
        if (!token) {
          window.location.replace("/");
          return;
        }

        const fetchKey = "courses-list";
        let coursesPromise = inflightFetches.get(fetchKey);
        if (!coursesPromise) {
          coursesPromise = fetch(`${BACKEND}/api/courses`, {
            headers: { Authorization: `Bearer ${token}` },
          }).then(async (r) => {
            if (r.status === 401) throw Object.assign(new Error("Unauthorized"), { status: 401 });
            if (!r.ok) throw new Error(`Failed to load courses (${r.status})`);
            const json = await r.json();
            return (Array.isArray(json) ? json : (json.courses ?? json.data ?? [])) as Course[];
          }).finally(() => setTimeout(() => inflightFetches.delete(fetchKey), 50));
          inflightFetches.set(fetchKey, coursesPromise);
        }

        Promise.all([coursesPromise, getProgress()])
          .then(([data, prog]) => {
            if (cancelled) return;
            setCourses(data);
            setProgress(prog);
            setLoading(false);
          })
          .catch((err: unknown) => {
            if (cancelled) return;
            if (err && (err as { status?: number }).status === 401) {
              clearAuthToken();
              window.location.replace("/auth?reason=session_expired");
              return;
            }
            setError(err instanceof Error ? err.message : "Failed to load courses");
            setLoading(false);
          });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const status = (err as { status?: number })?.status;

        if (status === 401 && hadToken) {
          // authClient already redirected to /auth?reason=session_expired.
          return;
        }

        window.location.replace("/");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
        <AppNavbar
          crumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Courses" }]}
          backHref="/dashboard"
          backLabel="Dashboard"
          actions={<UserMenu />}
        />
        <div className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <div className="max-w-5xl mx-auto px-6 py-5 space-y-2">
            <div className="h-6 w-28 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          </div>
        </div>
        <div className="max-w-5xl mx-auto px-6 py-6">
          <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse mb-5" />
          <div className="space-y-3">
            {[1,2,3,4,5,6,7,8].map((i) => (
              <div key={i} className="flex items-center gap-4 p-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700" style={{ opacity: 1 - i * 0.07 }}>
                <div className="w-11 h-11 rounded-lg bg-gray-200 dark:bg-gray-700 shrink-0 animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" style={{ width: `${48 + (i % 3) * 14}%` }} />
                  <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" style={{ width: `${60 + (i % 4) * 8}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <AppNavbar
        crumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Courses" }]}
        backHref="/dashboard"
        backLabel="Dashboard"
        actions={<UserMenu />}
      />
      <div className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="max-w-5xl mx-auto px-6 py-5 flex items-end justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">All Courses</h1>
            {!error && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                {courses.length} course{courses.length !== 1 ? "s" : ""} available
              </p>
            )}
          </div>
        </div>
      </div>
      <CoursesListClient
        courses={courses}
        courseOrder={progress.course_order}
        error={error ?? undefined}
      />
      <ScrollToTop />
    </div>
  );
}
