"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

interface Topic {
    api_url: string;
    course_id: number;
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
    courseHref?: string;
    toc: TocEntry[];
    currentTopicIndex: number;
    fromPath?: string | null;
    /** Set of topic_index values the user has completed */
    completedTopicIndices?: Set<number>;
    bookmarkedTopicIndices?: Set<number>;
    asideClassName?: string;
    /** Controlled collapsed state (desktop only usage). */
    isCollapsed?: boolean;
    /** Controlled collapse toggle handler. */
    onToggleCollapsed?: () => void;
    onClose?: () => void;
    /** When provided, clicks on topic links are intercepted for in-page navigation */
    onTopicClick?: (href: string, topicIndex: number) => void;
}

export default function TopicSidebar({
    courseId,
    courseSlug,
    courseTitle,
    courseHref,
    toc,
    currentTopicIndex,
    fromPath,
    completedTopicIndices,
    bookmarkedTopicIndices,
    asideClassName,
    isCollapsed: controlledCollapsed,
    onToggleCollapsed,
    onClose,
    onTopicClick,
}: TopicSidebarProps) {
    const activeRef = useRef<HTMLAnchorElement>(null);
    const validFromPath = fromPath && fromPath.startsWith("/") && !fromPath.startsWith("//") ? fromPath : null;
    const tocEntries = Array.isArray(toc) ? toc : [];

    const buildTopicHref = (topicIndex: number, topicSlug: string): string => {
        const base = `/dashboard/courses/${courseId}/${courseSlug}/topics/${topicIndex}/${topicSlug}`;
        return validFromPath ? `${base}?from=${encodeURIComponent(validFromPath)}` : base;
    };

    const [localCollapsed, setLocalCollapsed] = useState(false);
    const isCollapsed = typeof controlledCollapsed === "boolean" ? controlledCollapsed : localCollapsed;
    const [q, setQ] = useState("");
    const normalizedQ = q.trim().toLowerCase();

    const filteredEntries: TocEntry[] = normalizedQ
        ? tocEntries.flatMap((entry): TocEntry[] => {
            if ("topics" in entry) {
                const matchedTopics = (Array.isArray(entry.topics) ? entry.topics : []).filter((topic) =>
                    topic.title.toLowerCase().includes(normalizedQ)
                );
                return matchedTopics.length > 0 ? [{ ...entry, topics: matchedTopics }] : [];
            }
            return entry.title.toLowerCase().includes(normalizedQ) ? [entry] : [];
        })
        : tocEntries;

    const totalTopics = tocEntries.reduce(
        (acc, entry) => acc + ("topics" in entry ? (Array.isArray(entry.topics) ? entry.topics.length : 0) : 1),
        0
    );
    const shownTopics = filteredEntries.reduce(
        (acc, entry) => acc + ("topics" in entry ? (Array.isArray(entry.topics) ? entry.topics.length : 0) : 1),
        0
    );

    useEffect(() => {
        if (activeRef.current) {
            activeRef.current.scrollIntoView({ block: "center", behavior: "smooth" });
        }
    }, [currentTopicIndex]);

    return (
        <aside
            className={asideClassName ?? `shrink-0 hidden lg:flex flex-col sticky transition-[width] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] relative ${isCollapsed ? 'w-0' : 'w-72'}`}
            style={
                asideClassName
                    ? undefined
                    : {
                        top: "var(--ev-navbar-offset, 56px)",
                        height: "calc(100vh - var(--ev-navbar-offset, 56px))",
                    }
            }
        >
            
            {/* Toggle Button on the border line */}
            <button 
                onClick={() => {
                    if (onToggleCollapsed) {
                        onToggleCollapsed();
                        return;
                    }
                    setLocalCollapsed(!isCollapsed);
                }}
                className="absolute top-1/2 -right-3.5 w-7 h-7 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full flex items-center justify-center shadow-sm z-50 text-gray-500 hover:text-indigo-600 cursor-pointer transform -translate-y-1/2 hidden lg:flex"
            >
                {isCollapsed ? (
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
                ) : (
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
                )}
            </button>

            <div className={`h-full flex flex-col overflow-hidden border-r border-gray-200 dark:border-gray-700 w-72 transition-opacity duration-300 ${isCollapsed ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                {/* Sidebar header */}
                <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shrink-0">
                    {courseHref ? (
                        <Link
                            href={courseHref}
                            prefetch={false}
                            className="block text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors truncate"
                            title={courseTitle}
                        >
                            {courseTitle}
                        </Link>
                    ) : (
                        <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider truncate" title={courseTitle}>
                            {courseTitle}
                        </p>
                    )}
                    <div className="mt-2 relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 pointer-events-none">
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="11" cy="11" r="8" />
                                <path d="m21 21-4.35-4.35" />
                            </svg>
                        </span>
                        <input
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            placeholder={`Search in ${courseTitle}`}
                            className="w-full pl-9 pr-8 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 dark:focus:border-indigo-600 shadow-sm transition-all"
                        />
                        {normalizedQ && (
                            <button
                                onClick={() => setQ("")}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                                aria-label="Clear search"
                            >
                                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M18 6 6 18M6 6l12 12" />
                                </svg>
                            </button>
                        )}
                    </div>
                    {normalizedQ && (
                        <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                            {shownTopics} / {totalTopics} topics
                        </p>
                    )}
                </div>

                {/* Scrollable TOC */}
                <div className="flex-1 overflow-y-auto bg-white dark:bg-gray-900">
                    <nav aria-label="Course table of contents">
                        {filteredEntries.length === 0 ? (
                            <div className="px-4 py-8 text-sm text-gray-500 dark:text-gray-400">No matching topics.</div>
                        ) : filteredEntries.map((entry, i) => {
                            if ('topics' in entry) {
                                const entryTopics = Array.isArray(entry.topics) ? entry.topics : [];
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
                                            {entryTopics.map((topic) => {
                                                const isActive = topic.topic_index === currentTopicIndex;
                                                const isDone = !isActive && completedTopicIndices?.has(topic.topic_index);
                                                const isBookmarked = Boolean(bookmarkedTopicIndices?.has(topic.topic_index));
                                                const topicHref = buildTopicHref(topic.topic_index, topic.slug);
                                                return (
                                                    <li key={topic.topic_index}>
                                                        <Link
                                                            ref={isActive ? activeRef : null}
                                                            href={topicHref}
                                                            prefetch={false}
                                                            onClick={(e) => {
                                                                if (onTopicClick) {
                                                                    e.preventDefault();
                                                                    onTopicClick(topicHref, topic.topic_index);
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
                                                                    {topic.topic_index + 1}
                                                                </span>
                                                            )}
                                                            <span className="leading-snug">{topic.title}</span>
                                                            {isBookmarked && (
                                                                <svg className="w-3.5 h-3.5 mt-0.5 ml-auto shrink-0 text-amber-500" fill="currentColor" viewBox="0 0 20 20" aria-label="Bookmarked topic">
                                                                    <path d="M5 2a2 2 0 0 0-2 2v14l7-3 7 3V4a2 2 0 0 0-2-2H5Z" />
                                                                </svg>
                                                            )}
                                                        </Link>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    </div>
                                );
                            } else {
                                const isActive = entry.topic_index === currentTopicIndex;
                                const isDone = !isActive && completedTopicIndices?.has(entry.topic_index);
                                const isBookmarked = Boolean(bookmarkedTopicIndices?.has(entry.topic_index));
                                const topicHref = buildTopicHref(entry.topic_index, entry.slug);
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
                                                        onTopicClick(topicHref, entry.topic_index);
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
                                                        {entry.topic_index + 1}
                                                    </span>
                                                )}
                                                <span className="leading-snug">{entry.title}</span>
                                                {isBookmarked && (
                                                    <svg className="w-3.5 h-3.5 mt-0.5 ml-auto shrink-0 text-amber-500" fill="currentColor" viewBox="0 0 20 20" aria-label="Bookmarked topic">
                                                        <path d="M5 2a2 2 0 0 0-2 2v14l7-3 7 3V4a2 2 0 0 0-2-2H5Z" />
                                                    </svg>
                                                )}
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
