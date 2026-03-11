import { Suspense } from "react";
import { cookies } from "next/headers";
import AppNavbar from "@/components/AppNavbar";
import CoursesListClient from "@/components/CoursesListClient";
import UserMenu from "@/components/UserMenu";
import { makeServiceToken } from "@/utils/serviceToken";
import { AUTH_COOKIE } from "@/utils/auth";

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

interface ProgressData {
  course_order: number[];
  completed: Record<string, number[]>;
}

async function fetchCourses(): Promise<Course[]> {
  const base = process.env.BACKEND_API_BASE ?? "";
  const isProd = process.env.VERCEL_ENV === "production";
  const serviceToken = await makeServiceToken();
  const res = await fetch(`${base}/courses`, {
    headers: { Authorization: `Bearer ${serviceToken}` },
    ...(isProd ? { next: { revalidate: 3600, tags: ["courses"] } } : { cache: "no-store" }),
  } as RequestInit);
  if (!res.ok) throw new Error(`Failed to fetch courses: ${res.status}`);
  const json = await res.json();
  if (Array.isArray(json)) return json;
  if (Array.isArray(json.data)) return json.data;
  if (Array.isArray(json.courses)) return json.courses;
  return [];
}

async function fetchProgress(token: string | undefined): Promise<ProgressData> {
  const empty: ProgressData = { course_order: [], completed: {} };
  if (!token) return empty;
  const base = process.env.BACKEND_API_BASE ?? "";
  try {
    const res = await fetch(`${base}/auth/progress`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return empty;
    const data = await res.json().catch(() => ({}));
    return {
      course_order: Array.isArray(data?.course_order) ? data.course_order : [],
      completed: (data?.completed && typeof data.completed === "object") ? data.completed : {},
    };
  } catch {
    return empty;
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export const metadata = { title: "Courses · Edu-Viewer PRO" };

export default async function CoursesPage() {
  let courses: Course[] = [];
  let error: string | null = null;

  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE)?.value;

  const [coursesResult, progress] = await Promise.allSettled([
    fetchCourses(),
    fetchProgress(token),
  ]);

  if (coursesResult.status === "fulfilled") {
    courses = coursesResult.value;
  } else {
    error = coursesResult.reason instanceof Error ? coursesResult.reason.message : "Unknown error";
  }

  const progressData: ProgressData =
    progress.status === "fulfilled" ? progress.value : { course_order: [], completed: {} };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <AppNavbar
        crumbs={[{ label: "Courses" }]}
        backHref="/edu-viewer"
        backLabel="Dashboard"
        actions={<UserMenu />}
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
        <CoursesListClient
          courses={courses}
          courseOrder={progressData.course_order}
          error={error ?? undefined}
        />
      </Suspense>
    </div>
  );
}

