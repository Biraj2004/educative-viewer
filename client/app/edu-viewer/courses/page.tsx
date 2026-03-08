import Link from "next/link";
import DarkModeToggle from "@/components/DarkModeToggle";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Course {
  id: number | string;
  title: string;
  description?: string;
  slug?: string;
  thumbnail?: string;
  author?: string;
  level?: string;
  duration?: string;
  lessons?: number;
  rating?: number;
  [key: string]: unknown;
}

// ─── Data Fetching ────────────────────────────────────────────────────────────

async function fetchCourses(): Promise<Course[]> {
  const base = process.env.BACKEND_API_BASE ?? "";
  const res = await fetch(`${base}/backend/courses`, {
    // ISR: revalidate every 60 seconds
    next: { revalidate: 60 },
  } as RequestInit);
  if (!res.ok) throw new Error(`Failed to fetch courses: ${res.status}`);
  const json = await res.json();
  // Handle both array and { data: [...] } / { courses: [...] } shapes
  if (Array.isArray(json)) return json;
  if (Array.isArray(json.data)) return json.data;
  if (Array.isArray(json.courses)) return json.courses;
  return [];
}

// ─── Page ──────────────────────────────────────────────────────────────────── 

export const metadata = { title: "Courses" };

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
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 shadow-sm px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Courses</h1>
            {!error && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                {courses.length} course{courses.length !== 1 ? "s" : ""} available
              </p>
            )}
          </div>
          <DarkModeToggle />
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Error state */}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 px-5 py-4 text-sm text-red-700 dark:text-red-400">
            <span className="font-medium">Failed to load courses:</span> {error}
          </div>
        )}

        {/* Empty state */}
        {!error && courses.length === 0 && (
          <div className="text-center py-20 text-gray-400 dark:text-gray-600 text-sm">
            No courses found.
          </div>
        )}

        {/* Course grid */}
        {courses.length > 0 && (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((course) => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────

function CourseCard({ course }: { course: Course }) {
  const href = `/edu-viewer/courses/${course.id}/${course.slug ?? course.id}`;

  return (
    <Link
      href={href}
      className="group flex flex-col bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-700 transition-all duration-150 overflow-hidden"
    >
      {/* Thumbnail */}
      {course.thumbnail ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={course.thumbnail}
          alt={course.title}
          className="w-full h-40 object-cover"
        />
      ) : (
        <div className="w-full h-40 bg-linear-to-br from-indigo-50 to-indigo-100 dark:from-indigo-950/50 dark:to-indigo-900/30 flex items-center justify-center">
          <svg
            width="40" height="40" viewBox="0 0 24 24" fill="none"
            stroke="#a5b4fc" strokeWidth="1.5"
          >
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
          </svg>
        </div>
      )}

      {/* Content */}
      <div className="flex flex-col flex-1 px-5 py-4 gap-2">
        {/* Level badge */}
        {course.level && (
          <span className="self-start text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-900/40 text-indigo-500 dark:text-indigo-400">
            {course.level}
          </span>
        )}

        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-snug group-hover:text-indigo-700 dark:group-hover:text-indigo-400 transition-colors line-clamp-2">
          {course.title}
        </h2>

        {course.description && (
          <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed line-clamp-2">
            {course.description}
          </p>
        )}

        {/* Meta row */}
          <div className="mt-auto pt-3 flex flex-wrap items-center gap-3 text-xs text-gray-400 dark:text-gray-500 border-t border-gray-100 dark:border-gray-700/60">
          {course.author && (
            <span className="flex items-center gap-1">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
              {course.author}
            </span>
          )}
          {course.lessons !== undefined && (
            <span className="flex items-center gap-1">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
              </svg>
              {course.lessons} lessons
            </span>
          )}
          {course.duration && (
            <span className="flex items-center gap-1">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="9" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2" />
              </svg>
              {course.duration}
            </span>
          )}
          {course.rating !== undefined && (
            <span className="flex items-center gap-1 text-amber-400">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
              </svg>
              <span className="text-gray-400">{course.rating}</span>
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
