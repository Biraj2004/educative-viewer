"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import AppNavbar from "@/components/edu-viewer/AppNavbar";
import UserMenu from "@/components/edu-viewer/UserMenu";
import { useAuth } from "@/components/edu-viewer/AuthProvider";
import { clearAuthToken, getAuthToken } from "@/utils/authClient";

const BACKEND = (process.env.NEXT_PUBLIC_BACKEND_API_BASE ?? "").replace(/\/$/, "");

interface PathItem {
  id: number;
  path_author_id: string;
  path_collection_id: string;
  path_url_slug: string | null;
  path_title: string | null;
  scraped_at: string;
  course_count: number;
}

interface CourseItem {
  id: number;
  slug: string | null;
  title: string | null;
  type: string | null;
  path_id: number;
}

interface PathCoursesResponse {
  path: {
    id: number;
    path_title: string | null;
  };
  courses: CourseItem[];
}

function pathDisplayName(path: PathItem): string {
  if (path.path_title?.trim()) return path.path_title.trim();
  if (path.path_url_slug?.trim()) return path.path_url_slug.trim();
  return `${path.path_author_id}/${path.path_collection_id}`;
}

function parsePositiveInt(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

export default function PathsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading } = useAuth();
  const initialSelectedPathId = parsePositiveInt(searchParams.get("path"));

  const [paths, setPaths] = useState<PathItem[]>([]);
  const [pathsLoading, setPathsLoading] = useState(true);
  const [pathsError, setPathsError] = useState<string | null>(null);

  const [selectedPathId, setSelectedPathId] = useState<number | null>(initialSelectedPathId);
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(initialSelectedPathId !== null);
  const [coursesError, setCoursesError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      window.location.replace("/auth?next=/dashboard/paths");
    }
  }, [loading, user]);

  useEffect(() => {
    if (loading || !user) return;

    const token = getAuthToken();
    if (!token) {
      window.location.replace("/auth?next=/dashboard/paths");
      return;
    }

    let cancelled = false;

    fetch(`${BACKEND}/api/paths`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then(async (res) => {
        if (res.status === 401) {
          clearAuthToken();
          window.location.replace("/auth?reason=session_expired");
          return [] as PathItem[];
        }
        if (!res.ok) {
          throw new Error(`Failed to load paths (${res.status})`);
        }
        return (await res.json()) as PathItem[];
      })
      .then((data) => {
        if (cancelled) return;
        setPaths(Array.isArray(data) ? data : []);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setPathsError(err instanceof Error ? err.message : "Failed to load paths");
      })
      .finally(() => {
        if (cancelled) return;
        setPathsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [loading, user]);

  useEffect(() => {
    if (selectedPathId == null || loading || !user) return;

    const token = getAuthToken();
    if (!token) {
      window.location.replace("/auth?next=/dashboard/paths");
      return;
    }

    let cancelled = false;

    fetch(`${BACKEND}/api/paths/${selectedPathId}/courses`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then(async (res) => {
        if (res.status === 401) {
          clearAuthToken();
          window.location.replace("/auth?reason=session_expired");
          return { path: { id: selectedPathId, path_title: null }, courses: [] } as PathCoursesResponse;
        }
        if (!res.ok) {
          throw new Error(`Failed to load path courses (${res.status})`);
        }
        return (await res.json()) as PathCoursesResponse;
      })
      .then((payload) => {
        if (cancelled) return;
        setCourses(Array.isArray(payload?.courses) ? payload.courses : []);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setCoursesError(err instanceof Error ? err.message : "Failed to load path courses");
      })
      .finally(() => {
        if (cancelled) return;
        setCoursesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedPathId, loading, user]);

  const selectedPath = useMemo(
    () => paths.find((p) => p.id === selectedPathId) ?? null,
    [paths, selectedPathId]
  );

  function handleSelectPath(pathId: number) {
    setSelectedPathId(pathId);
    setCourses([]);
    setCoursesError(null);
    setCoursesLoading(true);

    const params = new URLSearchParams(searchParams.toString());
    params.set("path", String(pathId));
    const query = params.toString();
    router.replace(query ? `/dashboard/paths?${query}` : "/dashboard/paths", { scroll: false });
  }

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
        <AppNavbar
          crumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Paths" }]}
          backHref="/dashboard"
          backLabel="Dashboard"
          actions={<UserMenu />}
        />
        <div className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <div className="max-w-5xl mx-auto px-6 py-5 space-y-2">
            <div className="h-6 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            <div className="h-4 w-64 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <AppNavbar
        crumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Paths" }]}
        backHref="/dashboard"
        backLabel="Dashboard"
        actions={<UserMenu />}
      />

      <div className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="max-w-5xl mx-auto px-6 py-5 flex items-end justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Learning Paths</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Select a path to view all linked courses.
            </p>
          </div>
          <Link
            href="/dashboard/courses"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors"
          >
            Browse Courses
          </Link>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {pathsLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((idx) => (
              <div
                key={idx}
                className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 space-y-3"
              >
                <div className="h-4 w-20 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                <div className="h-5 w-2/3 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                <div className="h-3 w-1/2 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
              </div>
            ))}
          </div>
        ) : pathsError ? (
          <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50/70 dark:bg-red-950/30 px-4 py-3 text-sm text-red-700 dark:text-red-300">
            {pathsError}
          </div>
        ) : paths.length === 0 ? (
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
            No paths found in the paths table.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {paths.map((path) => {
              const active = path.id === selectedPathId;
              return (
                <button
                  type="button"
                  key={path.id}
                  onClick={() => handleSelectPath(path.id)}
                  className={[
                    "text-left rounded-xl border bg-white dark:bg-gray-900 p-5 transition-colors cursor-pointer",
                    active
                      ? "border-indigo-400 dark:border-indigo-700 ring-2 ring-indigo-100 dark:ring-indigo-900/50"
                      : "border-gray-200 dark:border-gray-800 hover:border-indigo-300 dark:hover:border-indigo-700",
                  ].join(" ")}
                >
                  <div className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold bg-violet-50 dark:bg-violet-950/50 text-violet-600 dark:text-violet-400">
                    {Number(path.course_count) || 0} course{Number(path.course_count) === 1 ? "" : "s"}
                  </div>
                  <h2 className="mt-3 text-base font-bold text-gray-900 dark:text-gray-100">
                    {pathDisplayName(path)}
                  </h2>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Path ID: {path.id}
                  </p>
                </button>
              );
            })}
          </div>
        )}

        {selectedPathId != null && (
          <section className="mt-7 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {selectedPath ? pathDisplayName(selectedPath) : `Path ${selectedPathId}`}
              </h3>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Courses linked by courses.path_id = {selectedPathId}
              </p>
            </div>

            <div className="p-4">
              {coursesLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3, 4].map((idx) => (
                    <div key={idx} className="h-11 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/40 animate-pulse" />
                  ))}
                </div>
              ) : coursesError ? (
                <div className="text-sm text-red-600 dark:text-red-400">{coursesError}</div>
              ) : courses.length === 0 ? (
                <div className="text-sm text-gray-500 dark:text-gray-400">No courses found for this path.</div>
              ) : (
                <div className="space-y-2">
                  {courses.map((course) => {
                    const title = course.title?.trim() || `Course ${course.id}`;
                    const slug = course.slug?.trim() || String(course.id);
                    const fromPath = selectedPath ? `/dashboard/paths?path=${selectedPath.id}` : "/dashboard/paths";
                    const href = `/dashboard/courses/${course.id}/${slug}?from=${encodeURIComponent(fromPath)}`;

                    return (
                      <Link
                        key={course.id}
                        href={href}
                        className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 dark:border-gray-800 px-3 py-2.5 hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20 transition-colors"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{title}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            Course ID: {course.id}
                            {course.type ? ` · ${course.type}` : ""}
                          </p>
                        </div>
                        <svg className="w-4 h-4 shrink-0 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                          <path d="M5 12h14" />
                          <path d="m12 5 7 7-7 7" />
                        </svg>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}