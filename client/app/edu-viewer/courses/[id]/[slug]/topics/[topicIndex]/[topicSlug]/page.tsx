"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { notFound } from "next/navigation";
import TopicLayoutClient from "@/components/TopicLayoutClient";
import { getAuthToken, getProgress } from "@/utils/authClient";

const BACKEND = (process.env.NEXT_PUBLIC_BACKEND_API_BASE ?? "").replace(/\/$/, "");

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
    Promise.all([
      fetch(`${BACKEND}/api/topic-details`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ course_id: courseId, topic_index: topicIdx }),
      }).then(async (r) => {
        if (r.status === 404) return null;
        if (!r.ok) throw new Error(`Failed to load topic (${r.status})`);
        return r.json() as Promise<TopicDetail>;
      }),
      fetch(`${BACKEND}/api/course-details`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ course_id: courseId }),
      }).then(async (r) => r.ok ? r.json() as Promise<CourseDetail> : null),
      getProgress(),
    ])
      .then(([topicData, courseData, prog]) => {
        if (!topicData) { setMissing(true); return; }
        setTopic(topicData);
        setCourse(courseData);
        setInitialCompleted(prog.completed[String(courseId)] ?? []);
      })
      .catch(() => setMissing(true))
      .finally(() => setLoading(false));
  }, [courseId, topicIdx]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" />
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