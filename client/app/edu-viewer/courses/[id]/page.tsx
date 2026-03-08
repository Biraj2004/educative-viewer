import Link from "next/link";
import { notFound } from "next/navigation";
import DarkModeToggle from "@/components/DarkModeToggle";

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

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const courseId = Number(id);
  if (isNaN(courseId)) notFound();

  const course = await fetchCourseDetail(courseId);
  if (!course) notFound();

  const totalTopics = course.toc.reduce(
    (acc, cat) => acc + cat.topics.length,
    0
  );

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-start justify-between gap-4">
          <div>
            <Link
              href="/edu-viewer/courses"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 hover:text-indigo-800 dark:hover:text-indigo-200 px-3 py-1 rounded-full border border-indigo-200 dark:border-indigo-800 transition-all mb-2"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              All Courses
            </Link>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-block text-xs font-semibold bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 px-2.5 py-0.5 rounded-full">
                {course.type}
              </span>
              <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">{course.title}</h1>
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              {totalTopics} lesson{totalTopics !== 1 ? "s" : ""} &middot;{" "}
              {course.toc.length} chapter{course.toc.length !== 1 ? "s" : ""}
            </p>
          </div>
          <DarkModeToggle />
        </div>
      </div>

      {/* Table of Contents */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-5">
          Table of Contents
        </h2>
        <div className="space-y-4">
          {course.toc.map((section, i) => (
            <div
              key={i}
              className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
            >
              {/* Category header */}
              <div className="px-5 py-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <h3 className="font-semibold text-gray-700 dark:text-gray-200 text-sm">
                  {section.category}
                </h3>
                <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">
                  {section.topics.length} lesson
                  {section.topics.length !== 1 ? "s" : ""}
                </span>
              </div>

              {/* Topics list */}
              <ul>
                {section.topics.map((topic, j) => (
                  <li
                    key={j}
                    className={
                      j < section.topics.length - 1
                        ? "border-b border-gray-100 dark:border-gray-800"
                        : ""
                    }
                  >
                    <Link
                      href={`/edu-viewer/courses/${courseId}/${topic.slug}`}
                      className="flex items-center gap-4 px-5 py-3 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors group"
                    >
                      <span className="text-xs text-gray-300 dark:text-gray-600 w-7 text-right shrink-0 font-mono">
                        {topic.index + 1}
                      </span>
                      <span className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-indigo-700 dark:group-hover:text-indigo-400 transition-colors">
                        {topic.title}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
