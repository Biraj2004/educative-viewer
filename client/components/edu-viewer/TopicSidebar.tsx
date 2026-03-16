"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

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

interface TopicSidebarProps {
    courseId: number;
    courseSlug: string;
    courseTitle: string;
    toc: TocEntry[];
    currentTopicIndex: number;
    fromPath?: string | null;
    /** Set of topic_index values the user has completed */
    completedTopicIndices?: Set<number>;
    asideClassName?: string;
    onClose?: () => void;
    /** When provided, clicks on topic links are intercepted for in-page navigation */
    onTopicClick?: (href: string, topicIndex: number) => void;
}

export default function TopicSidebar({
    courseId,
    courseSlug,
    toc,
    currentTopicIndex,
    fromPath,
    completedTopicIndices,
    asideClassName,
    onClose,
    onTopicClick,
}: TopicSidebarProps) {
    const activeRef = useRef<HTMLAnchorElement>(null);
    const validFromPath = fromPath && fromPath.startsWith("/") && !fromPath.startsWith("//") ? fromPath : null;

    const buildTopicHref = (topicIndex: number, topicSlug: string): string => {
        const base = `/dashboard/courses/${courseId}/${courseSlug}/topics/${topicIndex}/${topicSlug}`;
        return validFromPath ? `${base}?from=${encodeURIComponent(validFromPath)}` : base;
    };

    useEffect(() => {
        if (activeRef.current) {
            activeRef.current.scrollIntoView({ block: "center", behavior: "smooth" });
        }
    }, [currentTopicIndex]);

    return (
        <aside className={asideClassName ?? "w-72 shrink-0 hidden lg:flex flex-col sticky top-14 h-[calc(100vh-3.5rem)]"}>
        <div className="h-full flex flex-col overflow-hidden">
                {/* Sidebar header */}
                <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shrink-0">
                    <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Contents</p>
                </div>

                {/* Scrollable TOC */}
                <div className="flex-1 overflow-y-auto bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700">
                    <nav aria-label="Course table of contents">
                        {toc.map((entry, i) => {
                            if ('topics' in entry) {
                                return (
                                    <div key={i}>
                                        {/* Chapter heading */}
                                        <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800 border-b border-t border-gray-100 dark:border-gray-700 sticky top-0 z-10">
                                            <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                {entry.category}
                                            </span>
                                        </div>
                                        {/* Topic list */}
                                        <ul>
                                            {entry.topics.map((topic) => {
                                                const isActive = topic.index === currentTopicIndex;
                                                const isDone = !isActive && completedTopicIndices?.has(topic.index);
                                                const topicHref = buildTopicHref(topic.index, topic.slug);
                                                return (
                                                    <li key={topic.index}>
                                                        <Link
                                                            ref={isActive ? activeRef : null}
                                                            href={topicHref}
                                                            prefetch={false}
                                                            onClick={(e) => {
                                                                if (onTopicClick) {
                                                                    e.preventDefault();
                                                                    onTopicClick(topicHref, topic.index);
                                                                }
                                                                onClose?.();
                                                            }}
                                                            className={[
                                                                "flex items-start gap-3 px-4 py-2.5 text-sm transition-colors border-b border-gray-50 dark:border-gray-800",
                                                                isActive
                                                                    ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-semibold border-l-2 border-l-indigo-500"
                                                                    : isDone
                                                                    ? "text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 border-l-2 border-l-emerald-400"
                                                                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100 border-l-2 border-l-transparent",
                                                            ].join(" ")}
                                                        >
                                                            {isDone ? (
                                                                <svg className="w-3.5 h-3.5 mt-0.5 shrink-0 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                                </svg>
                                                            ) : (
                                                                <span
                                                                    className={[
                                                                        "text-[11px] font-mono mt-0.5 w-3.5 shrink-0 text-right",
                                                                        isActive ? "text-indigo-400 dark:text-indigo-400" : "text-gray-300 dark:text-gray-600",
                                                                    ].join(" ")}
                                                                >
                                                                    {topic.index + 1}
                                                                </span>
                                                            )}
                                                            <span className="leading-snug">{topic.title}</span>
                                                        </Link>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    </div>
                                );
                            } else {
                                const isActive = entry.index === currentTopicIndex;
                                const isDone = !isActive && completedTopicIndices?.has(entry.index);
                                const topicHref = buildTopicHref(entry.index, entry.slug);
                                return (
                                    <ul key={i}>
                                        <li>
                                            <Link
                                                ref={isActive ? activeRef : null}
                                                href={topicHref}
                                                prefetch={false}
                                                onClick={(e) => {
                                                    if (onTopicClick) {
                                                        e.preventDefault();
                                                        onTopicClick(topicHref, entry.index);
                                                    }
                                                    onClose?.();
                                                }}
                                                className={[
                                                    "flex items-start gap-3 px-4 py-2.5 text-sm transition-colors border-b border-gray-50 dark:border-gray-800",
                                                    isActive
                                                        ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-semibold border-l-2 border-l-indigo-500"
                                                        : isDone
                                                        ? "text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 border-l-2 border-l-emerald-400"
                                                        : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100 border-l-2 border-l-transparent",
                                                ].join(" ")}
                                            >
                                                {isDone ? (
                                                    <svg className="w-3.5 h-3.5 mt-0.5 shrink-0 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                    </svg>
                                                ) : (
                                                    <span
                                                        className={[
                                                            "text-[11px] font-mono mt-0.5 w-3.5 shrink-0 text-right",
                                                            isActive ? "text-indigo-400 dark:text-indigo-400" : "text-gray-300 dark:text-gray-600",
                                                        ].join(" ")}
                                                    >
                                                        {entry.index + 1}
                                                    </span>
                                                )}
                                                <span className="leading-snug">{entry.title}</span>
                                            </Link>
                                        </li>
                                    </ul>
                                );
                            }
                        })}

                    </nav>
                </div>
            </div>
        </aside>
    );
}
