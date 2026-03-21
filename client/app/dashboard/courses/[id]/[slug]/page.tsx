"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { notFound } from "next/navigation";
import AppNavbar from "@/components/edu-viewer/AppNavbar";
import CourseDetailToc from "@/components/edu-viewer/CourseDetailToc";
import UserMenu from "@/components/edu-viewer/UserMenu";
import { getAuthToken, clearAuthToken, getProgress, getUser, resetCourseProgress } from "@/utils/authClient";
import type { ProgressData } from "@/utils/authClient";

const BACKEND = (process.env.NEXT_PUBLIC_BACKEND_API_BASE ?? "").replace(/\/$/, "");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const inflightFetches = new Map<string, Promise<any>>();

function safeFromPath(path: string | null): string | null {
  if (!path) return null;
  if (!path.startsWith("/") || path.startsWith("//")) return null;
  return path;
}

export default function CourseDetailPage() {
  const params = useParams<{ id: string; slug: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const routeId = params?.id ?? "";
  const routeSlug = params?.slug ?? "";
  const courseId = Number(routeId);
  const fromPath = safeFromPath(searchParams.get("from"));
  const fromPathsPage = Boolean(fromPath?.startsWith("/dashboard/paths"));
  const fromProjectsPage = Boolean(fromPath?.startsWith("/dashboard/projects"));
  const sectionCrumb = fromPathsPage
    ? { label: "Paths", href: fromPath ?? "/dashboard/paths" }
    : fromProjectsPage
      ? { label: "Projects", href: fromPath ?? "/dashboard/projects" }
      : { label: "Courses", href: "/dashboard/courses" };
  const backHref = fromPathsPage
    ? (fromPath ?? "/dashboard/paths")
    : fromProjectsPage
      ? (fromPath ?? "/dashboard/projects")
      : "/dashboard/courses";
  const backLabel = fromPathsPage ? "Paths" : fromProjectsPage ? "Projects" : "Courses";

  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [progress, setProgress] = useState<ProgressData>({ course_order: [], completed: {} });
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [showConfirmReset, setShowConfirmReset] = useState(false);

  useEffect(() => {
    if (isNaN(courseId)) { setMissing(true); setLoading(false); return; }
    let cancelled = false;
    const basePath = `/dashboard/courses/${routeId}/${routeSlug}`;
    const nextPath = fromPath ? `${basePath}?from=${encodeURIComponent(fromPath)}` : basePath;
    const hadToken = Boolean(getAuthToken());

    getUser()
      .then(() => {
        if (cancelled) return;

        const token = getAuthToken();
        if (!token) {
          router.replace(`/auth?next=${nextPath}`);
          return;
        }

        const fetchKey = `course-details-${courseId}`;
        let coursePromise = inflightFetches.get(fetchKey);
        if (!coursePromise) {
          coursePromise = fetch(`${BACKEND}/api/course-details`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ course_id: courseId }),
          }).then(async (r) => {
            if (r.status === 401) throw Object.assign(new Error("Unauthorized"), { status: 401 });
            if (r.status === 404) return null;
            if (!r.ok) throw new Error(`Failed to load course (${r.status})`);
            return r.json() as Promise<CourseDetail>;
          }).finally(() => setTimeout(() => inflightFetches.delete(fetchKey), 50));
          inflightFetches.set(fetchKey, coursePromise);
        }

        Promise.all([coursePromise, getProgress()])
          .then(([data, prog]) => {
            if (cancelled) return;
            if (!data) { setMissing(true); setLoading(false); return; }
            setCourse(data);
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
            setMissing(true);
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

        router.replace(`/auth?next=${nextPath}`);
      });

    return () => {
      cancelled = true;
    };
  }, [courseId, routeId, routeSlug, router, fromPath]);

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
        <AppNavbar
          crumbs={[
            { label: "Dashboard", href: "/dashboard" },
            sectionCrumb,
            { label: "…" }
          ]}
          backHref={backHref}
          backLabel={backLabel}
          actions={<UserMenu />}
        />
        <div className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <div className="max-w-5xl mx-auto px-6 py-5 space-y-2.5">
            <div className="h-5 w-14 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
            <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" style={{ width: "55%" }} />
            <div className="h-4 w-36 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          </div>
        </div>
        <div className="max-w-5xl mx-auto px-6 py-8 space-y-7">
          {([3,5,2,4] as const).map((count, i) => (
            <div key={i}>
              <div className="h-4 w-40 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-3" />
              <div className="space-y-2">
                {Array.from({ length: count }).map((_, j) => (
                  <div key={j} className="h-12 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 animate-pulse" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </main>
    );
  }

  if (missing || !course) return notFound();

  const completedIds: number[] = progress.completed[String(courseId)] ?? [];
  const completedTopicIndices = new Set(completedIds);
  const totalTopics = course.toc.reduce(
    (acc, entry) => acc + ("topics" in entry ? entry.topics.length : 1),
    0
  );

  const handleResetProgress = async () => {
    if (!showConfirmReset) {
      setShowConfirmReset(true);
      return;
    }
    
    setResetting(true);
    try {
      await resetCourseProgress(courseId);
      setProgress(p => {
        const next = { ...p.completed };
        delete next[String(courseId)];
        return { ...p, completed: next };
      });
    } catch (err) {
      console.error("Failed to reset progress", err);
    } finally {
      setResetting(false);
      setShowConfirmReset(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <AppNavbar
        crumbs={[
          { label: "Dashboard", href: "/dashboard" },
          sectionCrumb,
          { label: course.title },
        ]}
        backHref={backHref}
        backLabel={backLabel}
        actions={<UserMenu />}
      />
      <div className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="max-w-5xl mx-auto px-6 py-5 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              {course.type && (
                <span className="text-[10px] font-semibold uppercase tracking-wider bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 px-2.5 py-0.5 rounded-full border border-indigo-100 dark:border-indigo-800">
                  {course.type}
                </span>
              )}
            </div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white leading-snug">{course.title}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {totalTopics} lesson{totalTopics !== 1 ? "s" : ""} &middot;{" "}
              {course.toc.length} chapter{course.toc.length !== 1 ? "s" : ""}
            </p>
          </div>
          
          {/* Reset Progress Action */}
          {completedIds.length > 0 && (
            <button
              onClick={handleResetProgress}
              disabled={resetting}
              className={[
                "shrink-0 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed",
                showConfirmReset 
                  ? "border-red-500 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40" 
                  : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              ].join(" ")}
              onMouseLeave={() => setShowConfirmReset(false)}
            >
              {resetting ? (
                <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : showConfirmReset ? (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              )}
              {showConfirmReset ? "Confirm Reset" : "Reset progress"}
            </button>
          )}
        </div>
      </div>
      <div className="max-w-5xl mx-auto px-6 py-8">
        <CourseDetailToc
          toc={course.toc}
          courseId={courseId}
          slug={course.slug}
          fromPath={fromPath}
          completedTopicIndices={completedTopicIndices}
        />
      </div>
    </main>
  );
}


interface Topic {
  api_url: string;
  course_id: number;
  slug: string;
  title: string;
  topic_index: number;
}

interface Category {
  category: string;
  topics: Topic[];
}

type TocEntry = Category | Topic;

interface CourseDetail {
  id: number;
  slug: string;
  title: string;
  toc: TocEntry[];
  type: string;
}