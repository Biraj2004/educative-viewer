"use client";

import { useState } from "react";
import Link from "next/link";
import TopicSidebar from "@/components/TopicSidebar";
import AppNavbar from "@/components/AppNavbar";
import { getRenderer, UnknownRenderer } from "@/utils/component-registry";

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

type TocEntry = Category | Topic;

interface CourseDetail {
  id: number;
  slug: string;
  title: string;
  toc: TocEntry[];
  type: string;
}

interface Props {
  courseId: number;
  slug: string;
  course: CourseDetail | null;
  topic: TopicDetail;
}

export default function TopicLayoutClient({ courseId, slug, course, topic }: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  const allTopics = course ? course.toc.flatMap((entry) =>
    'topics' in entry ? entry.topics : [entry as Topic]
  ) : [];
  const currentPos = allTopics.findIndex((t) => t.index === topic.topic_index);
  const prev = currentPos > 0 ? allTopics[currentPos - 1] : null;
  const next = currentPos < allTopics.length - 1 ? allTopics[currentPos + 1] : null;

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-950">

      {/* Full-width AppNavbar — consistent with the rest of the app */}
      <AppNavbar
        crumbs={[
          { label: "Courses", href: "/edu-viewer/courses" },
          ...(course
            ? [{ label: course.title, href: `/edu-viewer/courses/${courseId}/${slug}` }]
            : []),
          { label: topic.topic_name },
        ]}
        backHref={`/edu-viewer/courses/${courseId}/${slug}`}
        backLabel="Course"
        actions={
          course ? (
            <button
              onClick={() => setDrawerOpen((o) => !o)}
              className="lg:hidden p-1.5 rounded-md text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
              aria-label="Toggle navigation"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          ) : undefined
        }
      />

      {/* Tablet drawer overlay — only on < lg, offset below navbar */}
      {drawerOpen && course && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-30 lg:hidden"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="fixed left-0 top-14 h-[calc(100%-3.5rem)] z-40 lg:hidden shadow-2xl">
            <TopicSidebar
              courseId={courseId}
              courseSlug={slug}
              courseTitle={course.title}
              toc={course.toc}
              currentTopicIndex={topic.topic_index}
              asideClassName="w-72 shrink-0 flex flex-col h-full"
              onClose={() => setDrawerOpen(false)}
            />
          </div>
        </>
      )}

      {/* Sidebar + Main */}
      <div className="flex flex-1">

        {/* Desktop sidebar — sticky below navbar */}
        {course && (
          <TopicSidebar
            courseId={courseId}
            courseSlug={slug}
            courseTitle={course.title}
            toc={course.toc}
            currentTopicIndex={topic.topic_index}
          />
        )}

      {/* Main content — natural page scroll */}
      <main className="flex-1 min-w-0">

          {/* Components */}
        <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
          {topic.components.map((comp, i) => {
            const renderer = getRenderer(comp.type);
            return (
              <div key={i}>
                {renderer ? renderer(comp.content) : <UnknownRenderer type={comp.type} />}
              </div>
            );
          })}
        </div>

        {/* Prev / Next navigation */}
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

      </main>
      </div>
    </div>
  );
}
