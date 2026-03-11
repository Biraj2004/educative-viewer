"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import TopicSidebar from "@/components/TopicSidebar";
import AppNavbar from "@/components/AppNavbar";
import UserMenu from "@/components/UserMenu";
import { getRenderer, UnknownRenderer } from "@/utils/component-registry";
import ComponentBadge from "@/components/ComponentBadge";
import { recordTopicVisit, getProgress } from "@/utils/authClient";

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
  /** topic_index values that the user has already completed */
  initialCompleted?: number[];
}

export default function TopicLayoutClient({ courseId, slug, course, topic, initialCompleted = [] }: Props) {
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [completed, setCompleted] = useState<Set<number>>(() => new Set(initialCompleted));
  const [isCompleted, setIsCompleted] = useState(() => new Set(initialCompleted).has(topic.topic_index));
  const navigatingRef = useRef(false);

  const allTopics = course ? course.toc.flatMap((entry) =>
    'topics' in entry ? entry.topics : [entry as Topic]
  ) : [];
  const currentPos = allTopics.findIndex((t) => t.index === topic.topic_index);
  const prev = currentPos > 0 ? allTopics[currentPos - 1] : null;
  const next = currentPos < allTopics.length - 1 ? allTopics[currentPos + 1] : null;

  // Mark this topic as visited on mount (best-effort, don't block UI)
  useEffect(() => {
    recordTopicVisit(courseId, topic.topic_index, isCompleted).catch(() => {});
  }, [courseId, topic.topic_index]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch fresh progress so sidebar stays in sync after navigation
  useEffect(() => {
    getProgress().then((data) => {
      const ids = new Set<number>(data.completed[String(courseId)] ?? []);
      setCompleted(ids);
      setIsCompleted(ids.has(topic.topic_index));
    }).catch(() => {});
  }, [courseId, topic.topic_index]);

  const handleToggleComplete = useCallback(async () => {
    const next = !isCompleted;
    setIsCompleted(next);
    setCompleted((prev) => {
      const s = new Set(prev);
      if (next) s.add(topic.topic_index); else s.delete(topic.topic_index);
      return s;
    });
    recordTopicVisit(courseId, topic.topic_index, next).catch(() => {});
  }, [isCompleted, courseId, topic.topic_index]);

  // On prev/next click: mark current topic completed, then navigate
  const handleNavClick = useCallback((href: string) => {
    if (navigatingRef.current) return;
    navigatingRef.current = true;
    // Mark current topic as completed when navigating away
    recordTopicVisit(courseId, topic.topic_index, true).catch(() => {});
    router.push(href);
  }, [courseId, topic.topic_index, router]);

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
        backLabel="Topics"
        actions={
          <div className="flex items-center gap-2">
            <UserMenu />
            {course && (
              <button
                onClick={() => setDrawerOpen((o) => !o)}
                className="lg:hidden p-1.5 rounded-md text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                aria-label="Toggle navigation"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            )}
          </div>
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
              completedTopicIndices={completed}
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
            completedTopicIndices={completed}
          />
        )}

      {/* Main content — natural page scroll */}
      <main className="flex-1 min-w-0">

          {/* Components */}
        <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
          {topic.components.map((comp, i) => {
            const renderer = getRenderer(comp.type);
            const subType =
              typeof comp.content?.type === "string" ? comp.content.type : undefined;
            return (
              <div key={i} className="relative">
                {renderer ? renderer(comp.content) : <UnknownRenderer type={comp.type} />}
                <ComponentBadge componentName={comp.type} subType={subType} />
              </div>
            );
          })}
        </div>

        {/* Mark complete + Prev / Next */}
        <div className="max-w-6xl mx-auto px-6 pb-10 space-y-4">
          {/* Mark complete checkbox */}
          <div className="flex justify-center">
            <button
              onClick={handleToggleComplete}
              className={[
                "inline-flex items-center gap-2 px-5 py-2 rounded-full border text-sm font-medium transition-colors cursor-pointer",
                isCompleted
                  ? "bg-emerald-50 dark:bg-emerald-900/30 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-400"
                  : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-emerald-400 hover:text-emerald-700 dark:hover:border-emerald-600 dark:hover:text-emerald-400",
              ].join(" ")}
            >
              {isCompleted ? (
                <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <circle cx="12" cy="12" r="9" />
                </svg>
              )}
              {isCompleted ? "Completed" : "Mark as complete"}
            </button>
          </div>

          {/* Prev / Next */}
          <div className="flex items-center justify-between gap-4">
            {prev ? (
              <button
                onClick={() => handleNavClick(`/edu-viewer/courses/${courseId}/${slug}/topics/${prev.index}/${prev.slug}`)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-700 dark:text-gray-300 hover:border-indigo-400 dark:hover:border-indigo-600 hover:text-indigo-700 dark:hover:text-indigo-400 transition-colors max-w-xs cursor-pointer"
              >
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
                <span className="truncate">{prev.title}</span>
              </button>
            ) : <div />}
            {next ? (
              <button
                onClick={() => handleNavClick(`/edu-viewer/courses/${courseId}/${slug}/topics/${next.index}/${next.slug}`)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-700 dark:text-gray-300 hover:border-indigo-400 dark:hover:border-indigo-600 hover:text-indigo-700 dark:hover:text-indigo-400 transition-colors max-w-xs cursor-pointer"
              >
                <span className="truncate">{next.title}</span>
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ) : <div />}
          </div>
        </div>

      </main>
      </div>
    </div>
  );
}
