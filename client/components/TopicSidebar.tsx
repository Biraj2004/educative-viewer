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
}

export default function TopicSidebar({
    courseId,
    courseSlug,
    courseTitle,
    toc,
    currentTopicIndex,
}: TopicSidebarProps) {
    const activeRef = useRef<HTMLAnchorElement>(null);

    useEffect(() => {
        if (activeRef.current) {
            activeRef.current.scrollIntoView({ block: "center", behavior: "smooth" });
        }
    }, [currentTopicIndex]);

    return (
        <aside className="w-72 shrink-0 hidden lg:flex flex-col">
            <div className="sticky top-0 h-screen flex flex-col overflow-hidden">
                {/* Sidebar header */}
                <div className="px-4 py-4 border-b border-gray-200 bg-white shrink-0">
                    <Link
                        href={`/edu-viewer/courses/${courseId}/${courseSlug}`}
                        className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1 mb-2 font-medium"
                    >
                        ← Back to Course
                    </Link>
                    <p className="text-sm font-semibold text-gray-800 leading-snug line-clamp-2">
                        {courseTitle}
                    </p>
                </div>

                {/* Scrollable TOC */}
                <div className="flex-1 overflow-y-auto bg-white border-r border-gray-200">
                    <nav aria-label="Course table of contents">
                        {toc.map((section, i) => (
                            <div key={i}>
                                {/* Chapter heading */}
                                <div className="px-4 py-2 bg-gray-50 border-b border-t border-gray-100 sticky top-0 z-10">
                                    <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
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
                                                    className={[
                                                        "flex items-start gap-3 px-4 py-2.5 text-sm transition-colors border-b border-gray-50",
                                                        isActive
                                                            ? "bg-indigo-50 text-indigo-700 font-semibold border-l-2 border-l-indigo-500"
                                                            : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 border-l-2 border-l-transparent",
                                                    ].join(" ")}
                                                >
                                                    <span
                                                        className={[
                                                            "text-[11px] font-mono mt-0.5 w-5 shrink-0 text-right",
                                                            isActive ? "text-indigo-400" : "text-gray-300",
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
