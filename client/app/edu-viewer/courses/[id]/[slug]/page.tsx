import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import AppNavbar from "@/components/AppNavbar";
import CourseDetailToc from "@/components/CourseDetailToc";
import UserMenu from "@/components/UserMenu";
import { makeServiceToken } from "@/utils/serviceToken";
import { AUTH_COOKIE } from "@/utils/auth";

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

interface ProgressData {
  course_order: number[];
  completed: Record<string, number[]>;
}

async function fetchCourseDetail(courseId: number): Promise<CourseDetail | null> {
  try {
    const base = process.env.BACKEND_API_BASE ?? "";
    const isProd = process.env.VERCEL_ENV === "production";
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

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ id: string; slug: string }>;
}) {
  const { id } = await params;
  const courseId = Number(id);
  if (isNaN(courseId)) notFound();

  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE)?.value;

  const [course, progress] = await Promise.all([
    fetchCourseDetail(courseId),
    fetchProgress(token),
  ]);
  if (!course) notFound();

  const completedIds: number[] = progress.completed[String(courseId)] ?? [];
  const completedTopicIndices = new Set(completedIds);

  const totalTopics = course.toc.reduce(
    (acc, entry) => acc + ('topics' in entry ? entry.topics.length : 1),
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

      {/* Course info sub-header */}
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

      {/* Table of Contents */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        <CourseDetailToc toc={course.toc} courseId={courseId} slug={course.slug} completedTopicIndices={completedTopicIndices} />
      </div>
    </main>
  );
}
