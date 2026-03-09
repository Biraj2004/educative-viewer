import { Suspense } from "react";
import AppNavbar from "@/components/AppNavbar";
import CoursesListClient from "@/components/CoursesListClient";

// ─── Data Fetching ────────────────────────────────────────────────────────────

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

async function fetchCourses(): Promise<Course[]> {
  const base = process.env.BACKEND_API_BASE ?? "";
  const isProd = process.env.VERCEL_ENV === "production";
  const res = await fetch(`${base}/backend/courses`, {
    ...(isProd ? { next: { revalidate: 3600, tags: ["courses"] } } : { cache: "no-store" }),
  } as RequestInit);
  if (!res.ok) throw new Error(`Failed to fetch courses: ${res.status}`);
  const json = await res.json();
  if (Array.isArray(json)) return json;
  if (Array.isArray(json.data)) return json.data;
  if (Array.isArray(json.courses)) return json.courses;
  return [];
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export const metadata = { title: "Courses · Edu-Viewer PRO" };

export default async function CoursesPage() {
  let courses: Course[] = [];
  let error: string | null = null;

  try {
    courses = await fetchCourses();
  } catch (e) {
    error = e instanceof Error ? e.message : "Unknown error";
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <AppNavbar
        crumbs={[{ label: "Courses" }]}
        backHref="/edu-viewer"
        backLabel="Back to Home"
      />

      {/* Sub-header */}
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

      {/* Search + list rendered entirely on the client — no server round-trip per keystroke */}
      <Suspense fallback={<div className="h-11 mx-6 mt-6 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />}>
        <CoursesListClient courses={courses} error={error ?? undefined} />
      </Suspense>
    </div>
  );
}

