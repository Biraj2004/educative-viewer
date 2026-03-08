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

interface TopicSidebarProps {
    courseId: number;
    courseSlug: string;
    courseTitle: string;
    toc: Category[];
    currentTopicIndex: number;
    asideClassName?: string;
    onClose?: () => void;
}

export default function TopicSidebar({
    courseId,
    courseSlug,
    toc,
    currentTopicIndex,
    asideClassName,
    onClose,
}: TopicSidebarProps) {
    const activeRef = useRef<HTMLAnchorElement>(null);

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
                        {toc.map((section, i) => (
                            <div key={i}>
                                {/* Chapter heading */}
                                <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800 border-b border-t border-gray-100 dark:border-gray-700 sticky top-0 z-10">
                                    <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        {section.category}
                                    </span>
                                </div>

                                {/* Topic list */}
                                <ul>
                                    {section.topics.map((topic) => {
                                        const isActive = topic.index === currentTopicIndex;
                                        return (
                                            <li key={topic.index}>
                                                <Link
                                                    ref={isActive ? activeRef : null}
                                                    href={`/edu-viewer/courses/${courseId}/${courseSlug}/topics/${topic.index}/${topic.slug}`}
                                                    onClick={onClose}
                                                    className={[
                                                        "flex items-start gap-3 px-4 py-2.5 text-sm transition-colors border-b border-gray-50 dark:border-gray-800",
                                                        isActive
                                                            ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-semibold border-l-2 border-l-indigo-500"
                                                            : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100 border-l-2 border-l-transparent",
                                                    ].join(" ")}
                                                >
                                                    <span
                                                        className={[
                                                            "text-[11px] font-mono mt-0.5 w-5 shrink-0 text-right",
                                                            isActive ? "text-indigo-400 dark:text-indigo-400" : "text-gray-300 dark:text-gray-600",
                                                        ].join(" ")}
                                                    >
                                                        {topic.index + 1}
                                                    </span>
                                                    <span className="leading-snug">{topic.title}</span>
                                                </Link>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>
                        ))}

                    </nav>
                </div>
            </div>
        </aside>
    );
}
