"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import TopicSidebar from "@/components/edu-viewer/TopicSidebar";
import AppNavbar from "@/components/edu-viewer/AppNavbar";
import UserMenu from "@/components/edu-viewer/UserMenu";
import { getRenderer, UnknownRenderer } from "@/utils/component-registry";
import ComponentBadge from "@/components/edu-viewer/ComponentBadge";
import { recordTopicVisit, getAuthToken, clearAuthToken } from "@/utils/authClient";

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
  fromPath?: string | null;
  course: CourseDetail | null;
  topic: TopicDetail;
  /** topic_index values that the user has already completed */
  initialCompleted?: number[];
}

export default function TopicLayoutClient({ courseId, slug, fromPath, course, topic, initialCompleted = [] }: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [currentTopic, setCurrentTopic] = useState<TopicDetail>(topic);
  const [topicChanging, setTopicChanging] = useState(false);
  const [completed, setCompleted] = useState<Set<number>>(() => new Set(initialCompleted));
  const [isCompleted, setIsCompleted] = useState(() => new Set(initialCompleted).has(topic.topic_index));
  const navigatingRef = useRef(false);
  const completedRef = useRef<Set<number>>(new Set(initialCompleted));
  const validFromPath = fromPath && fromPath.startsWith("/") && !fromPath.startsWith("//") ? fromPath : null;
  const fromPathsPage = Boolean(validFromPath?.startsWith("/dashboard/paths"));
  const fromProjectsPage = Boolean(validFromPath?.startsWith("/dashboard/projects"));
  const sectionCrumb = fromPathsPage
    ? { label: "Paths", href: validFromPath ?? "/dashboard/paths" }
    : fromProjectsPage
      ? { label: "Projects", href: validFromPath ?? "/dashboard/projects" }
    : { label: "Courses", href: "/dashboard/courses" };
  const courseBaseHref = `/dashboard/courses/${courseId}/${slug}`;
  const courseHref = validFromPath
    ? `${courseBaseHref}?from=${encodeURIComponent(validFromPath)}`
    : courseBaseHref;

  // Keep completedRef current (also updated synchronously below when mutating state)
  useEffect(() => { completedRef.current = completed; }, [completed]);

  // Signal the global NavProgressBar for in-page topic fetches
  const topicChangingRef = useRef(false);
  useEffect(() => {
    if (topicChanging) {
      topicChangingRef.current = true;
      window.dispatchEvent(new Event("navprogress:start"));
    } else if (topicChangingRef.current) {
      topicChangingRef.current = false;
      window.dispatchEvent(new Event("navprogress:done"));
    }
  }, [topicChanging]);

  const allTopics = course ? course.toc.flatMap((entry) =>
    'topics' in entry ? entry.topics : [entry as Topic]
  ) : [];
  const currentPos = allTopics.findIndex((t) => t.index === currentTopic.topic_index);
  const prev = currentPos > 0 ? allTopics[currentPos - 1] : null;
  const next = currentPos < allTopics.length - 1 ? allTopics[currentPos + 1] : null;

  const buildTopicHref = useCallback((topicIndex: number, topicSlug: string) => {
    const base = `/dashboard/courses/${courseId}/${slug}/topics/${topicIndex}/${topicSlug}`;
    return validFromPath ? `${base}?from=${encodeURIComponent(validFromPath)}` : base;
  }, [courseId, slug, validFromPath]);

  // Mark this topic as visited on every topic change (best-effort, don't block UI)
  // (Removed per user request: only mark complete on explicit interaction)

  // Fetch fresh progress so sidebar stays in sync after navigation
  // (Removed: progress is now strictly maintained locally in the state below to prevent 
  // race conditions where the server returns stale data right after we optimistically mark complete)

  const handleToggleComplete = useCallback(async () => {
    const next = !isCompleted;
    setIsCompleted(next);
    setCompleted((prev) => {
      const s = new Set(prev);
      if (next) s.add(currentTopic.topic_index); else s.delete(currentTopic.topic_index);
      completedRef.current = s;
      return s;
    });
    recordTopicVisit(courseId, currentTopic.topic_index, next).catch(() => {});
  }, [isCompleted, courseId, currentTopic.topic_index]);

  // In-page topic navigation: fetch new topic, update state + URL (no page remount)
  const handleTopicNav = useCallback(async (href: string, destIdx: number) => {
    if (navigatingRef.current) return;
    navigatingRef.current = true;
    setTopicChanging(true);
    window.history.pushState({}, "", href);
    window.scrollTo(0, 0);
    try {
      const token = getAuthToken();
      const res = await fetch(`${BACKEND}/api/topic-details`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ course_id: courseId, topic_index: destIdx }),
      });
      if (res.status === 401) {
        clearAuthToken();
        window.location.replace("/auth?reason=session_expired");
        return;
      }
      if (!res.ok) throw new Error("Failed to load topic");
      const data: TopicDetail = await res.json();
      setCurrentTopic(data);
      setIsCompleted(completedRef.current.has(data.topic_index));
    } catch {
      // On unrecoverable error fall back to a hard navigation
      window.location.href = href;
    } finally {
      setTopicChanging(false);
      navigatingRef.current = false;
    }
  }, [courseId]);

  // Keep in sync when user presses browser back/forward
  useEffect(() => {
    const onPop = () => {
      const m = window.location.pathname.match(/\/topics\/(\d+)\//);
      if (m) {
        const idx = Number(m[1]);
        if (idx !== currentTopic.topic_index) {
          handleTopicNav(`${window.location.pathname}${window.location.search}`, idx);
        }
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [currentTopic.topic_index, handleTopicNav]);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-950">

      {/* Full-width AppNavbar — consistent with the rest of the app */}
      <AppNavbar
        crumbs={[
          { label: "Dashboard", href: "/dashboard" },
          sectionCrumb,
          ...(course
            ? [{ label: course.title, href: courseHref }]
            : []),
          { label: currentTopic.topic_name },
        ]}
        backHref={courseHref}
        backLabel="Topics"
        mobileMenuTrigger={
          course ? (
            <button
              onClick={() => setDrawerOpen((o) => !o)}
              className="p-1.5 rounded-md text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
              aria-label="Toggle navigation"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          ) : undefined
        }
        actions={<UserMenu />}
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
              currentTopicIndex={currentTopic.topic_index}
              completedTopicIndices={completed}
              fromPath={validFromPath}
              asideClassName="w-72 shrink-0 flex flex-col h-full"
              onClose={() => setDrawerOpen(false)}
              onTopicClick={(href, destIdx) => { setDrawerOpen(false); handleTopicNav(href, destIdx); }}
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
            currentTopicIndex={currentTopic.topic_index}
            completedTopicIndices={completed}
            fromPath={validFromPath}
            onTopicClick={(href, destIdx) => handleTopicNav(href, destIdx)}
          />
        )}

      {/* Main content — natural page scroll */}
      <main className="flex-1 min-w-0">

          {/* Components */}
        <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
          {currentTopic.components.map((comp, i) => {
            const renderer = getRenderer(comp.type);
            const subType =
              typeof comp.content?.type === "string" ? comp.content.type : undefined;
            const componentLabel = `<${comp.type}-${i}>`;
            return (
              <div key={i} className="relative">
                {renderer ? renderer(comp.content) : <UnknownRenderer type={comp.type} />}
                <ComponentBadge componentName={componentLabel} subType={subType} />
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
                onClick={() => {
                  if (!isCompleted) {
                    setIsCompleted(true);
                    setCompleted((s) => { 
                      const n = new Set(s); n.add(currentTopic.topic_index); 
                      completedRef.current = n;
                      return n; 
                    });
                    recordTopicVisit(courseId, currentTopic.topic_index, true).catch(() => {});
                  }
                  handleTopicNav(buildTopicHref(prev.index, prev.slug), prev.index);
                }}
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
                onClick={() => {
                  if (!isCompleted) {
                    setIsCompleted(true);
                    setCompleted((ps) => { 
                      const s = new Set(ps); s.add(currentTopic.topic_index); 
                      completedRef.current = s;
                      return s; 
                    });
                    recordTopicVisit(courseId, currentTopic.topic_index, true).catch(() => {});
                  }
                  handleTopicNav(buildTopicHref(next.index, next.slug), next.index);
                }}
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
