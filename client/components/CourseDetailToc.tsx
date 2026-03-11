"use client";

import { useState } from "react";
import Link from "next/link";

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

interface Props {
  toc: TocEntry[];
  courseId: number;
  slug: string;
  /** Set of topic_index values the user has completed */
  completedTopicIndices?: Set<number>;
}

function SearchIcon() {
  return (
    <svg
      className="w-4 h-4 text-gray-400 dark:text-gray-500 pointer-events-none"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  );
}

function ClearIcon() {
  return (
    <svg
      className="w-3.5 h-3.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

export default function CourseDetailToc({ toc, courseId, slug, completedTopicIndices }: Props) {
  const [q, setQ] = useState("");

  const normalised = q.toLowerCase().trim();

  const filtered: TocEntry[] = normalised
    ? toc.flatMap((entry): TocEntry[] => {
        if ('topics' in entry) {
          const matchedTopics = entry.topics.filter((t) =>
            t.title.toLowerCase().includes(normalised)
          );
          return matchedTopics.length > 0 ? [{ ...entry, topics: matchedTopics }] : [];
        } else {
          return entry.title.toLowerCase().includes(normalised) ? [entry] : [];
        }
      })
    : toc;

  const totalTopics = toc.reduce((a, entry) => a + ('topics' in entry ? entry.topics.length : 1), 0);
  const filteredTopics = filtered.reduce((a, entry) => a + ('topics' in entry ? entry.topics.length : 1), 0);
  const isFiltered = normalised.length > 0;

  return (
    <div>
      {/* Heading + search row */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 shrink-0">
          Table of Contents
        </h2>

        {/* Search */}
        <div className="flex-1 sm:max-w-sm relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2">
            <SearchIcon />
          </span>
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search lessons…"
            className="w-full pl-9 pr-8 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 dark:focus:border-indigo-600 shadow-sm transition-all"
          />
          {isFiltered && (
            <button
              onClick={() => setQ("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
              aria-label="Clear search"
            >
              <ClearIcon />
            </button>
          )}
        </div>

        {/* Count pill */}
        {isFiltered && (
          <span className="text-xs text-gray-400 dark:text-gray-600 shrink-0">
            {filteredTopics === 0 ? (
              <span className="text-gray-500 dark:text-gray-400">No results</span>
            ) : (
              <>
                <span className="font-medium text-indigo-600 dark:text-indigo-400">{filteredTopics}</span>
                {" / "}
                {totalTopics}
                {" lessons"}
              </>
            )}
          </span>
        )}
      </div>

      {/* TOC list */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400 dark:text-gray-600">
          <svg className="w-8 h-8 mx-auto mb-3 opacity-40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <p className="text-sm">No lessons matched &ldquo;{q}&rdquo;</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((entry, i) => {
            if ('topics' in entry) {
              return (
                <div
                  key={i}
                  className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
                >
                  {/* Category header */}
                  <div className="px-5 py-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                    <h3 className="font-semibold text-gray-700 dark:text-gray-200 text-sm">
                      {entry.category}
                    </h3>
                    <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">
                      {entry.topics.length} lesson{entry.topics.length !== 1 ? "s" : ""}
                    </span>
              </div>

                  {/* Topics list */}
                  <ul>
                    {entry.topics.map((topic, j) => {
                      const isDone = completedTopicIndices?.has(topic.index);
                      return (
                        <li
                          key={j}
                          className={
                            j < entry.topics.length - 1
                              ? "border-b border-gray-100 dark:border-gray-800"
                              : ""
                          }
                        >
                          <Link
                            href={`/edu-viewer/courses/${courseId}/${slug}/topics/${topic.index}/${topic.slug}`}
                            className={[
                              "flex items-center gap-3 px-4 py-2.5 text-sm transition-colors border-l-2",
                              isDone
                                ? "border-l-emerald-400 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                                : "border-l-transparent text-gray-700 dark:text-gray-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:text-indigo-700 dark:hover:text-indigo-400",
                            ].join(" ")}
                          >
                            {isDone ? (
                              <svg className="w-3.5 h-3.5 shrink-0 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            ) : (
                              <span className="text-[11px] font-mono text-gray-300 dark:text-gray-600 w-5 text-right shrink-0">
                                {topic.index + 1}
                              </span>
                            )}
                            <span className="leading-snug">
                              {isFiltered ? (
                                <HighlightMatch text={topic.title} query={normalised} />
                              ) : (
                                topic.title
                              )}
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            } else {
              const isDone = completedTopicIndices?.has(entry.index);
              return (
                <div
                  key={i}
                  className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
                >
                  <Link
                    href={`/edu-viewer/courses/${courseId}/${slug}/topics/${entry.index}/${entry.slug}`}
                    className={[
                      "flex items-center gap-3 px-4 py-2.5 text-sm transition-colors border-l-2",
                      isDone
                        ? "border-l-emerald-400 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                        : "border-l-transparent text-gray-700 dark:text-gray-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:text-indigo-700 dark:hover:text-indigo-400",
                    ].join(" ")}
                  >
                    {isDone ? (
                      <svg className="w-3.5 h-3.5 shrink-0 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    ) : (
                      <span className="text-[11px] font-mono text-gray-300 dark:text-gray-600 w-5 text-right shrink-0">
                        {entry.index + 1}
                      </span>
                    )}
                    <span className="leading-snug">
                      {isFiltered ? (
                        <HighlightMatch text={entry.title} query={normalised} />
                      ) : (
                        entry.title
                      )}
                    </span>
                  </Link>
                </div>
              );
            }
          })}
        </div>
      )}
    </div>
  );
}

/** Bolds the matched portion of a string */
function HighlightMatch({ text, query }: { text: string; query: string }) {
  const idx = text.toLowerCase().indexOf(query);
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 rounded px-0.5 font-medium not-italic">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}
