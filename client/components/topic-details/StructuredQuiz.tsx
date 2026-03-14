"use client";

import React, { useState } from "react";
import "katex/dist/katex.min.css";

// ─── Types ────────────────────────────────────────────────────────────────────

interface StructuredQuestion {
  answerText: string;
  answerTextHtml: string;
  questionText: string;
  questionTextHtml: string;
}

export interface StructuredQuizData {
  comp_id: string;
  questions: StructuredQuestion[];
  renderMode: "slide" | "continuous" | string;
  title: string;
  titleMdHtml: string;
  version: string;
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function ChevronUp() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="m18 15-6-6-6 6" />
    </svg>
  );
}

function ChevronDown() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function ChevronLeft() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

// ─── Single question row (used in both modes) ─────────────────────────────────

function QuestionRow({
  question,
  index,
  showNumber,
}: {
  question: StructuredQuestion;
  index: number;
  showNumber: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="px-6 pt-5 pb-4">
      {/* Question text */}
      <div className="flex items-start gap-2 mb-4">
        {showNumber && (
          <span className="shrink-0 text-sm font-medium text-gray-500 dark:text-gray-400 mt-0.5 w-5 text-right">
            {index + 1}.
          </span>
        )}
        <div
          className="sq-question text-sm text-gray-800 dark:text-gray-200 leading-relaxed"
          dangerouslySetInnerHTML={{ __html: question.questionTextHtml }}
        />
      </div>

      {/* Toggle */}
      <div className="flex justify-center mb-3">
        <button
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors"
        >
          {open ? "Hide Answer" : "Show Answer"}
          {open ? <ChevronUp /> : <ChevronDown />}
        </button>
      </div>

      {/* Answer */}
      {open && (
        <div
          className="sq-answer text-sm text-gray-700 dark:text-gray-300 leading-relaxed"
          dangerouslySetInnerHTML={{ __html: question.answerTextHtml }}
        />
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function StructuredQuiz({ data }: { data: StructuredQuizData }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const total = data.questions.length;

  const canGoPrev = currentIndex > 0;
  const canGoNext = currentIndex < total - 1;

  const navBar = (
    <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-3 flex items-center justify-center gap-2 text-sm text-gray-600 dark:text-gray-400 select-none">
      <button
        onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
        disabled={!canGoPrev}
        aria-label="Previous question"
        className="p-1 rounded text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <ChevronLeft />
      </button>
      <span className="min-w-12 text-center font-medium">
        {currentIndex + 1} / {total}
      </span>
      <button
        onClick={() => setCurrentIndex((i) => Math.min(total - 1, i + 1))}
        disabled={!canGoNext}
        aria-label="Next question"
        className="p-1 rounded text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <ChevronRight />
      </button>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto px-4 py-4">
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden bg-white dark:bg-gray-900">
        {/* Title (only if non-empty) */}
        {data.titleMdHtml && (
          <div className="bg-indigo-50 dark:bg-indigo-950/50 border-b border-gray-200 dark:border-gray-700 px-6 py-3">
            <div
              className="sq-title font-semibold text-gray-800 dark:text-gray-200 text-sm [&_p]:m-0"
              dangerouslySetInnerHTML={{ __html: data.titleMdHtml }}
            />
          </div>
        )}

        <QuestionRow
          key={currentIndex}
          question={data.questions[currentIndex]}
          index={currentIndex}
          showNumber={total > 1}
        />
        {total > 1 && navBar}
      </div>

      {/* Scoped styles */}
      <style>{`
        .sq-question p { margin: 0; line-height: 1.6; }
        .sq-question code {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 0.85em;
          background: #f3f4f6;
          border-radius: 3px;
          padding: 0.1em 0.35em;
        }
        .sq-answer p { margin: 0 0 0.5rem; line-height: 1.6; }
        .sq-answer p:last-child { margin-bottom: 0; }
        .sq-answer code {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 0.85em;
          background: #f3f4f6;
          border-radius: 3px;
          padding: 0.1em 0.35em;
        }
        .sq-title p { margin: 0; }
        .dark .sq-question code,
        .dark .sq-answer code { background: #1e293b; color: #e2e8f0; }
      `}</style>
    </div>
  );
}
