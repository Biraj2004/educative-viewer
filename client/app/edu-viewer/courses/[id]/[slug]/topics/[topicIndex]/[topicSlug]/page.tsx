import Link from "next/link";
import { notFound } from "next/navigation";
import { getRenderer, UnknownRenderer } from "@/utils/component-registry";
import TopicSidebar from "@/components/TopicSidebar";
import DarkModeToggle from "@/components/DarkModeToggle";

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

async function fetchTopicDetail(
  courseId: number,
  topicIndex: number
): Promise<TopicDetail | null> {
  try {
    const base = process.env.BACKEND_API_BASE ?? "";
    const res = await fetch(`${base}/backend/topic-details`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ course_id: courseId, topic_index: topicIndex }),
      next: { revalidate: 60 },
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
    const res = await fetch(`${base}/backend/course-details`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ course_id: courseId }),
      next: { revalidate: 60 },
    } as RequestInit);
    if (!res.ok) return null;
    return (await res.json()) as CourseDetail;
  } catch {
    return null;
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

  // Fetch topic data and course TOC in parallel
  const [topic, course] = await Promise.all([
    fetchTopicDetail(courseId, topicIdx),
    fetchCourseDetail(courseId),
  ]);

  if (!topic) notFound();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex">
      {/* Sidebar — only rendered when we have course TOC data */}
      {course && (
        <TopicSidebar
          courseId={courseId}
          courseSlug={slug}
          courseTitle={course.title}
          toc={course.toc}
          currentTopicIndex={topicIdx}
        />
      )}

      {/* Main content */}
      <main className="flex-1 min-w-0">
        {/* Header */}
        <div className="sticky top-0 z-20 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="px-6 py-4 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100 truncate">{topic.topic_name}</h1>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                Lesson {topic.topic_index + 1}
              </p>
            </div>
            <DarkModeToggle />
          </div>
        </div>

        {/* Components */}
        <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
          {topic.components.map((comp, i) => {
            const renderer = getRenderer(comp.type);
            return (
              <div key={i}>
                {renderer
                  ? renderer(comp.content)
                  : <UnknownRenderer type={comp.type} />}
              </div>
            );
          })}
        </div>

        {/* Prev / Next navigation */}
        {course && (() => {
          const allTopics = course.toc.flatMap(cat => cat.topics);
          const currentPos = allTopics.findIndex(t => t.index === topicIdx);
          const prev = currentPos > 0 ? allTopics[currentPos - 1] : null;
          const next = currentPos < allTopics.length - 1 ? allTopics[currentPos + 1] : null;
          return (
            <div className="max-w-6xl mx-auto px-6 pb-10 flex items-center justify-between gap-4">
              {prev ? (
                <Link
                  href={`/edu-viewer/courses/${courseId}/${slug}/topics/${prev.index}/${prev.slug}`}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-700 dark:text-gray-300 hover:border-indigo-400 dark:hover:border-indigo-600 hover:text-indigo-700 dark:hover:text-indigo-400 transition-colors max-w-xs"
                >
                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                  <span className="truncate">{prev.title}</span>
                </Link>
              ) : <div />}
              {next ? (
                <Link
                  href={`/edu-viewer/courses/${courseId}/${slug}/topics/${next.index}/${next.slug}`}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-700 dark:text-gray-300 hover:border-indigo-400 dark:hover:border-indigo-600 hover:text-indigo-700 dark:hover:text-indigo-400 transition-colors max-w-xs"
                >
                  <span className="truncate">{next.title}</span>
                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              ) : <div />}
            </div>
          );
        })()}
      </main>
    </div>
  );
}
