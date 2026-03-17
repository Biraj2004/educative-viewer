"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import AppNavbar from "@/components/edu-viewer/AppNavbar";
import UserMenu from "@/components/edu-viewer/UserMenu";
import { useAuth } from "@/components/edu-viewer/AuthProvider";
import { clearAuthToken, getAuthToken } from "@/utils/authClient";

const BACKEND = (process.env.NEXT_PUBLIC_BACKEND_API_BASE ?? "").replace(/\/$/, "");

interface ProjectItem {
  id: number;
  course_id: number;
  project_author_id: string;
  project_collection_id: string;
  project_work_id: string;
  project_title: string | null;
  project_url_slug: string | null;
  scraped_at: string;
  course_slug: string | null;
  course_title: string | null;
  course_type: string | null;
}

function projectDisplayName(project: ProjectItem): string {
  if (project.project_title?.trim()) return project.project_title.trim();
  if (project.project_url_slug?.trim()) return project.project_url_slug.trim();
  return `${project.project_author_id}/${project.project_collection_id}/${project.project_work_id}`;
}

function parsePositiveInt(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

export default function ProjectsPage() {
  const searchParams = useSearchParams();
  const { user, loading } = useAuth();

  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [projectsError, setProjectsError] = useState<string | null>(null);

  const selectedProjectId = parsePositiveInt(searchParams.get("project"));

  useEffect(() => {
    if (!loading && !user) {
      window.location.replace("/auth?next=/dashboard/projects");
    }
  }, [loading, user]);

  useEffect(() => {
    if (loading || !user) return;

    const token = getAuthToken();
    if (!token) {
      window.location.replace("/auth?next=/dashboard/projects");
      return;
    }

    let cancelled = false;

    fetch(`${BACKEND}/api/projects`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then(async (res) => {
        if (res.status === 401) {
          clearAuthToken();
          window.location.replace("/auth?reason=session_expired");
          return [] as ProjectItem[];
        }
        if (!res.ok) {
          throw new Error(`Failed to load projects (${res.status})`);
        }
        return (await res.json()) as ProjectItem[];
      })
      .then((data) => {
        if (cancelled) return;
        setProjects(Array.isArray(data) ? data : []);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setProjectsError(err instanceof Error ? err.message : "Failed to load projects");
      })
      .finally(() => {
        if (cancelled) return;
        setProjectsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [loading, user]);

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === selectedProjectId) ?? null,
    [projects, selectedProjectId]
  );

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
        <AppNavbar
          crumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Projects" }]}
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
        crumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Projects" }]}
        backHref="/dashboard"
        backLabel="Dashboard"
        actions={<UserMenu />}
      />

      <div className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="max-w-5xl mx-auto px-6 py-5 flex items-end justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Projects</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Open a project to jump to its linked course.
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
        {projectsLoading ? (
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
        ) : projectsError ? (
          <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50/70 dark:bg-red-950/30 px-4 py-3 text-sm text-red-700 dark:text-red-300">
            {projectsError}
          </div>
        ) : projects.length === 0 ? (
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
            No projects found in the projects table.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => {
              const active = project.id === selectedProjectId;
              const courseSlug = project.course_slug?.trim() || String(project.course_id);
              const courseTitle = project.course_title?.trim() || `Course ${project.course_id}`;
              const fromPath = `/dashboard/projects?project=${project.id}`;
              const href = `/dashboard/courses/${project.course_id}/${courseSlug}?from=${encodeURIComponent(fromPath)}`;

              return (
                <Link
                  key={project.id}
                  href={href}
                  className={[
                    "block rounded-xl border bg-white dark:bg-gray-900 p-5 transition-colors",
                    active
                      ? "border-indigo-400 dark:border-indigo-700 ring-2 ring-indigo-100 dark:ring-indigo-900/50"
                      : "border-gray-200 dark:border-gray-800 hover:border-indigo-300 dark:hover:border-indigo-700",
                  ].join(" ")}
                >
                  <div className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
                    Project ID: {project.id}
                  </div>
                  <h2 className="mt-3 text-base font-bold text-gray-900 dark:text-gray-100">
                    {projectDisplayName(project)}
                  </h2>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 truncate">
                    {courseTitle}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                    Course ID: {project.course_id}
                    {project.course_type ? ` · ${project.course_type}` : ""}
                  </p>
                </Link>
              );
            })}
          </div>
        )}

        {selectedProject && (
          <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
            Selected project: {projectDisplayName(selectedProject)}
          </p>
        )}
      </div>
    </div>
  );
}
