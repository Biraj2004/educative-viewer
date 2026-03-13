"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { notFound } from "next/navigation";
import TopicLayoutClient from "@/components/TopicLayoutClient";
import AppNavbar from "@/components/AppNavbar";
import UserMenu from "@/components/UserMenu";
import { getAuthToken, clearAuthToken, getProgress } from "@/utils/authClient";

const BACKEND = (process.env.NEXT_PUBLIC_BACKEND_API_BASE ?? "").replace(/\/$/, "");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const inflightFetches = new Map<string, Promise<any>>();
interface Component {
  type: string;
  content: Record<string, unknown>;
  index: number;
  width?: string;
}

interface TopicDetail {
  api_url: string;
  components: Component[];
  course_id: number;
  status: string;
  topic_index: number;
  topic_name: string;
  topic_slug: string;
  topic_url: string;
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

interface CourseDetail {
  id: number;
  slug: string;
  title: string;
  toc: Category[];
  type: string;
}

export default function TopicDetailPage() {
  const params = useParams<{ id: string; slug: string; topicIndex: string; topicSlug: string }>();
  const router = useRouter();
  const courseId = Number(params?.id);
  const topicIdx = Number(params?.topicIndex);

  const [topic, setTopic] = useState<TopicDetail | null>(null);
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [initialCompleted, setInitialCompleted] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (isNaN(courseId) || isNaN(topicIdx)) { setMissing(true); setLoading(false); return; }
    const token = getAuthToken();
    if (!token) {
      router.replace(`/auth?next=/edu-viewer/courses/${params?.id}/${params?.slug}/topics/${params?.topicIndex}/${params?.topicSlug}`);
      return;
    }
    const topicFetchKey = `topic-details-${courseId}-${topicIdx}`;
    let topicPromise = inflightFetches.get(topicFetchKey);
    if (!topicPromise) {
      topicPromise = fetch(`${BACKEND}/api/topic-details`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ course_id: courseId, topic_index: topicIdx }),
      }).then(async (r) => {
        if (r.status === 401) throw Object.assign(new Error("Unauthorized"), { status: 401 });
        if (r.status === 404) return null;
        if (!r.ok) throw new Error(`Failed to load topic (${r.status})`);
        return r.json() as Promise<TopicDetail>;
      }).finally(() => setTimeout(() => inflightFetches.delete(topicFetchKey), 50));
      inflightFetches.set(topicFetchKey, topicPromise);
    }

    const courseFetchKey = `course-details-${courseId}`;
    let coursePromise = inflightFetches.get(courseFetchKey);
    if (!coursePromise) {
      coursePromise = fetch(`${BACKEND}/api/course-details`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ course_id: courseId }),
      }).then(async (r) => {
        if (r.status === 401) throw Object.assign(new Error("Unauthorized"), { status: 401 });
        return r.ok ? r.json() as Promise<CourseDetail> : null;
      }).finally(() => setTimeout(() => inflightFetches.delete(courseFetchKey), 50));
      inflightFetches.set(courseFetchKey, coursePromise);
    }

    Promise.all([topicPromise, coursePromise, getProgress()])
      .then(([topicData, courseData, prog]) => {
        if (!topicData) { setMissing(true); setLoading(false); return; }
        setTopic(topicData);
        setCourse(courseData);
        setInitialCompleted(prog.completed[String(courseId)] ?? []);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (err && (err as { status?: number }).status === 401) {
          clearAuthToken();
          window.location.replace("/auth?reason=session_expired");
          return;
        }
        setMissing(true);
        setLoading(false);
      });
      // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, topicIdx]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-950">
        <AppNavbar
          crumbs={[{ label: "Courses", href: "/edu-viewer/courses" }, { label: "\u2026" }]}
          backHref={`/edu-viewer/courses/${params?.id}/${params?.slug}`}
          backLabel="Topics"
          actions={<UserMenu />}
        />
        <div className="flex flex-1">
          {/* Sidebar skeleton – desktop only */}
          <aside className="hidden lg:flex flex-col w-72 shrink-0 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
            <div className="p-4 border-b border-gray-100 dark:border-gray-800">
              <div className="h-4 w-28 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            </div>
            <div className="p-3 space-y-1.5">
              {Array.from({ length: 14 }).map((_, i) => (
                <div key={i} className="h-9 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse" style={{ opacity: 1 - i * 0.04 }} />
              ))}
            </div>
          </aside>
          {/* Content skeleton */}
          <main className="flex-1 overflow-auto">
            <div className="max-w-3xl mx-auto px-8 py-10 space-y-4">
              <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" style={{ width: "65%" }} />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" style={{ width: "100%" }} />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" style={{ width: "92%" }} />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" style={{ width: "85%" }} />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" style={{ width: "97%" }} />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" style={{ width: "78%" }} />
              <div className="h-40 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse mt-4" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" style={{ width: "90%" }} />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" style={{ width: "80%" }} />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" style={{ width: "100%" }} />
              <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse mt-2" />
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (missing || !topic) return notFound();

  return (
    <TopicLayoutClient
      courseId={courseId}
      slug={params?.slug ?? ""}
      course={course}
      topic={topic}
      initialCompleted={initialCompleted}
    />
  );
}


interface Component {
  type: string;
  content: Record<string, unknown>;
  index: number;
  width?: string;
}

interface TopicDetail {
  api_url: string;
  components: Component[];
  course_id: number;
  status: string;
  topic_index: number;
  topic_name: string;
  topic_slug: string;
  topic_url: string;
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

interface CourseDetail {
  id: number;
  slug: string;
  title: string;
  toc: Category[];
  type: string;
}