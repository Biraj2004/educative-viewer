"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { notFound } from "next/navigation";
import AppNavbar from "@/components/AppNavbar";
import CourseDetailToc from "@/components/CourseDetailToc";
import UserMenu from "@/components/UserMenu";
import { getAuthToken, getProgress } from "@/utils/authClient";
import type { ProgressData } from "@/utils/authClient";

const BACKEND = (process.env.NEXT_PUBLIC_BACKEND_API_BASE ?? "").replace(/\/$/, "");
export default function CourseDetailPage() {
  const params = useParams<{ id: string; slug: string }>();
  const router = useRouter();
  const courseId = Number(params?.id);

  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [progress, setProgress] = useState<ProgressData>({ course_order: [], completed: {} });
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (isNaN(courseId)) { setMissing(true); setLoading(false); return; }
    const token = getAuthToken();
    if (!token) {
      router.replace(`/auth?next=/edu-viewer/courses/${params?.id}/${params?.slug}`);
      return;
    }
    Promise.all([
      fetch(`${BACKEND}/api/course-details`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ course_id: courseId }),
      }).then(async (r) => {
        if (r.status === 404) return null;
        if (!r.ok) throw new Error(`Failed to load course (${r.status})`);
        return r.json() as Promise<CourseDetail>;
      }),
      getProgress(),
    ])
      .then(([data, prog]) => {
        if (!data) { setMissing(true); return; }
        setCourse(data);
        setProgress(prog);
      })
      .catch(() => setMissing(true))
      .finally(() => setLoading(false));
  }, [courseId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (missing || !course) return notFound();

  const completedIds: number[] = progress.completed[String(courseId)] ?? [];
  const completedTopicIndices = new Set(completedIds);
  const totalTopics = course.toc.reduce(
    (acc, entry) => acc + ("topics" in entry ? entry.topics.length : 1),
    0
  );

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <AppNavbar
        crumbs={[
          { label: "Courses", href: "/edu-viewer/courses" },
          { label: course.title },
        ]}
        backHref="/edu-viewer/courses"
        backLabel="Courses"
        actions={<UserMenu />}
      />
      <div className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="max-w-5xl mx-auto px-6 py-5">
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
      </div>
      <div className="max-w-5xl mx-auto px-6 py-8">
        <CourseDetailToc toc={course.toc} courseId={courseId} slug={course.slug} completedTopicIndices={completedTopicIndices} />
      </div>
    </main>
  );
}


interface Topic {
  api_url: string;
  course_id: number;
  index: number;
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