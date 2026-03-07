import Link from "next/link";
import { notFound } from "next/navigation";
import { COMPONENT_REGISTRY, UnknownRenderer } from "@/utils/component-registry";

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

async function fetchTopicDetail(
  courseId: number,
  topicIndex: number
): Promise<TopicDetail | null> {
  try {
    const base = process.env.NEXT_PUBLIC_API_BASE ?? "";
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

export default async function TopicDetailPage({
  params,
}: {
  params: Promise<{ id: string; slug: string; topicIndex: string; topicSlug: string }>;
}) {
  const { id, slug, topicIndex } = await params;
  const courseId = Number(id);
  const topicIdx = Number(topicIndex);

  if (isNaN(courseId) || isNaN(topicIdx)) notFound();

  const topic = await fetchTopicDetail(courseId, topicIdx);
  if (!topic) notFound();

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <Link
            href={`/edu-viewer/courses/${id}/${slug}`}
            className="text-sm text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-1 mb-3"
          >
            ← Back to Course
          </Link>
          <h1 className="text-xl font-bold text-gray-900">{topic.topic_name}</h1>
          <p className="text-xs text-gray-400 mt-1">
            Lesson {topic.topic_index + 1}
          </p>
        </div>
      </div>

      {/* Components */}
      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {topic.components.map((comp, i) => {
          const renderer = COMPONENT_REGISTRY[comp.type];
          return (
            <div key={i}>
              {renderer
                ? renderer(comp.content)
                : <UnknownRenderer type={comp.type} />}
            </div>
          );
        })}
      </div>
    </main>
  );
}
