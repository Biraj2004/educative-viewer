import Link from "next/link";
import { notFound } from "next/navigation";

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
    const base = process.env.NEXT_PUBLIC_API_BASE ?? "";
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
  params: Promise<{ id: string; slug: string }>;
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
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <Link
            href="/edu-viewer/courses"
            className="text-sm text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-1 mb-4"
          >
            ← All Courses
          </Link>
          <div className="mt-2">
            <span className="inline-block text-xs font-semibold bg-indigo-100 text-indigo-700 px-2.5 py-0.5 rounded-full mb-3">
              {course.type}
            </span>
            <h1 className="text-2xl font-bold text-gray-900">{course.title}</h1>
            <p className="text-sm text-gray-400 mt-2">
              {totalTopics} lesson{totalTopics !== 1 ? "s" : ""} &middot;{" "}
              {course.toc.length} chapter{course.toc.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
      </div>

      {/* Table of Contents */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        <h2 className="text-lg font-semibold text-gray-800 mb-5">
          Table of Contents
        </h2>
        <div className="space-y-4">
          {course.toc.map((section, i) => (
            <div
              key={i}
              className="bg-white rounded-xl border border-gray-200 overflow-hidden"
            >
              {/* Category header */}
              <div className="px-5 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                <h3 className="font-semibold text-gray-700 text-sm">
                  {section.category}
                </h3>
                <span className="text-xs text-gray-400 shrink-0">
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
                        ? "border-b border-gray-100"
                        : ""
                    }
                  >
                    <Link
                      href={`/edu-viewer/courses/${courseId}/${course.slug}/topics/${topic.index}/${topic.slug}`}
                      className="flex items-center gap-4 px-5 py-3 hover:bg-indigo-50 transition-colors group"
                    >
                      <span className="text-xs text-gray-300 w-7 text-right shrink-0 font-mono">
                        {topic.index + 1}
                      </span>
                      <span className="text-sm text-gray-700 group-hover:text-indigo-700 transition-colors">
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
