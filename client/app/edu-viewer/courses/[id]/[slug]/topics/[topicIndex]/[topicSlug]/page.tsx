import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import TopicLayoutClient from "@/components/TopicLayoutClient";
import { makeServiceToken } from "@/utils/serviceToken";
import { AUTH_COOKIE } from "@/utils/auth";

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

interface ProgressData {
  course_order: number[];
  completed: Record<string, number[]>;
}

async function fetchTopicDetail(
  courseId: number,
  topicIndex: number
): Promise<TopicDetail | null> {
  try {
    const base = process.env.BACKEND_API_BASE ?? "";
    const isProd = process.env.VERCEL_ENV === "production";
    const serviceToken = await makeServiceToken();
    const res = await fetch(`${base}/topic-details`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceToken}` },
      body: JSON.stringify({ course_id: courseId, topic_index: topicIndex }),
      ...(isProd ? { next: { revalidate: 3600, tags: ["topic-details", `course-${courseId}`, `topic-${courseId}-${topicIndex}`] } } : { cache: "no-store" }),
    } as RequestInit);
    if (!res.ok) return null;
    return (await res.json()) as TopicDetail;
  } catch {
    return null;
  }
}

async function fetchCourseDetail(courseId: number): Promise<CourseDetail | null> {
  try {
    const base = process.env.BACKEND_API_BASE ?? "";
    const isProd = process.env.NODE_ENV === "production";
    const serviceToken = await makeServiceToken();
    const res = await fetch(`${base}/course-details`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceToken}` },
      body: JSON.stringify({ course_id: courseId }),
      ...(isProd ? { next: { revalidate: 3600, tags: ["course-details", `course-${courseId}`] } } : { cache: "no-store" }),
    } as RequestInit);
    if (!res.ok) return null;
    return (await res.json()) as CourseDetail;
  } catch {
    return null;
  }
}

async function fetchProgress(token: string | undefined): Promise<ProgressData> {
  const empty: ProgressData = { course_order: [], completed: {} };
  if (!token) return empty;
  try {
    const base = process.env.BACKEND_API_BASE ?? "";
    const res = await fetch(`${base}/auth/progress`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return empty;
    const data = await res.json();
    return {
      course_order: Array.isArray(data?.course_order) ? data.course_order : [],
      completed: (data?.completed && typeof data.completed === "object") ? data.completed : {},
    };
  } catch {
    return empty;
  }
}

export default async function TopicDetailPage({
  params,
}: {
  params: Promise<{ id: string; slug: string; topicIndex: string; topicSlug: string }>;
}) {
  const { id, slug, topicIndex } = await params;
  const courseId = Number(id);
  const topicIdx = Number(topicIndex);

  if (isNaN(courseId) || isNaN(topicIdx)) notFound();

  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE)?.value;

  // Fetch topic data, course TOC, and user progress in parallel
  const [topic, course, progress] = await Promise.all([
    fetchTopicDetail(courseId, topicIdx),
    fetchCourseDetail(courseId),
    fetchProgress(token),
  ]);

  if (!topic) notFound();

  const initialCompleted: number[] = progress.completed[String(courseId)] ?? [];

  return (
    <TopicLayoutClient
      courseId={courseId}
      slug={slug}
      course={course}
      topic={topic}
      initialCompleted={initialCompleted}
    />
  );
}
