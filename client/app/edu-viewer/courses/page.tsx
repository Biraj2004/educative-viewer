"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import AppNavbar from "@/components/AppNavbar";
import CoursesListClient from "@/components/CoursesListClient";
import UserMenu from "@/components/UserMenu";
import { getAuthToken, getProgress } from "@/utils/authClient";
import type { ProgressData } from "@/utils/authClient";

const BACKEND = (process.env.NEXT_PUBLIC_BACKEND_API_BASE ?? "").replace(/\/$/, "");

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
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [progress, setProgress] = useState<ProgressData>({ course_order: [], completed: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      router.replace("/auth?next=/edu-viewer/courses");
      return;
    }
    Promise.all([
      fetch(`${BACKEND}/api/courses`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then(async (r) => {
        if (!r.ok) throw new Error(`Failed to load courses (${r.status})`);
        const json = await r.json();
        return (Array.isArray(json) ? json : (json.courses ?? json.data ?? [])) as Course[];
      }),
      getProgress(),
    ])
      .then(([data, prog]) => {
        setCourses(data);
        setProgress(prog);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load courses"))
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <AppNavbar
        crumbs={[{ label: "Courses" }]}
        backHref="/edu-viewer"
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
    </div>
  );
}
