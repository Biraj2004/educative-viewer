"use client";

import React, { useState } from "react";
import "katex/dist/katex.min.css";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Explanation {
  mdHtml: string;
  mdText: string;
}

interface QuestionOption {
  correct: boolean;
  explanation: Explanation;
  id: string;
  mdHtml: string;
  text: string;
}

interface Question {
  id: string;
  multipleAnswers: boolean;
  questionOptions: QuestionOption[];
  questionText: string;
  questionTextHtml: string;
}

export interface QuizData {
  comp_id: string;
  dynamicQuestionsCount: number | null;
  questions: Question[];
  renderMode: string;
  title: string;
  titleMdHtml: string;
  version: string;
}

interface QuestionState {
  selected: string[];
  submitted: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const OPTION_LABELS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

// ─── Icons ────────────────────────────────────────────────────────────────────

function ResetIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18M6 6l12 12" />
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

function ThumbsUp({ active }: { active: boolean }) {
  return (
    <svg
      className={`w-5 h-5 transition-colors ${active ? "text-green-500 fill-green-500" : "text-gray-400 fill-none"}`}
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M7 10v12M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" />
    </svg>
  );
}

function ThumbsDown({ active }: { active: boolean }) {
  return (
    <svg
      className={`w-5 h-5 transition-colors ${active ? "text-red-400 fill-red-400" : "text-gray-400 fill-none"}`}
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M17 14V2M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z" />
    </svg>
  );
}

// ─── Option card ──────────────────────────────────────────────────────────────

function OptionCard({
  option,
  label,
  isSelected,
  submitted,
  onClick,
}: {
  option: QuestionOption;
  label: string;
  isSelected: boolean;
  submitted: boolean;
  onClick: () => void;
}) {
  let wrapperClass =
    "rounded border transition-colors select-none";

  let feedbackEl: React.ReactNode = null;

  if (submitted) {
    if (option.correct) {
      wrapperClass += " border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/30";
      feedbackEl = (
        <div className="mt-3 rounded border border-green-200 dark:border-green-800 bg-white dark:bg-gray-900 px-4 py-3">
          <p className="flex items-center gap-1.5 font-semibold text-green-600 text-sm mb-1">
            <CheckIcon />
            Correct
          </p>
          <div
            className="quiz-explanation text-sm text-gray-700 dark:text-gray-300 leading-relaxed"
            dangerouslySetInnerHTML={{ __html: option.explanation.mdHtml }}
          />
        </div>
      );
    } else if (isSelected) {
      wrapperClass += " border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/30";
      feedbackEl = (
        <div className="mt-3 rounded border border-red-200 dark:border-red-800 bg-white dark:bg-gray-900 px-4 py-3">
          <p className="flex items-center gap-1.5 font-semibold text-red-500 text-sm mb-1">
            <XIcon />
            Incorrect
          </p>
          <div
            className="quiz-explanation text-sm text-gray-700 dark:text-gray-300 leading-relaxed"
            dangerouslySetInnerHTML={{ __html: option.explanation.mdHtml }}
          />
        </div>
      );
    } else {
      wrapperClass += " border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 opacity-70";
    }
  } else {
    if (isSelected) {
      wrapperClass += " border-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 cursor-pointer";
    } else {
      wrapperClass += " border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 hover:border-indigo-300 hover:bg-indigo-50/40 dark:hover:bg-indigo-900/20 cursor-pointer";
    }
  }

  return (
    <div className={wrapperClass} onClick={submitted ? undefined : onClick}>
      <div className="flex items-start gap-2 px-4 py-3">
        <span className="shrink-0 text-sm font-semibold text-gray-500 dark:text-gray-400 mt-0.5">{label}.</span>
        <div
          className="quiz-option-text text-sm text-gray-800 dark:text-gray-200 leading-relaxed"
          dangerouslySetInnerHTML={{ __html: option.mdHtml }}
        />
      </div>
      {feedbackEl && <div className="px-4 pb-4">{feedbackEl}</div>}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Quiz({ data }: { data: QuizData }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [states, setStates] = useState<QuestionState[]>(
    data.questions.map(() => ({ selected: [], submitted: false }))
  );
  const [helpful, setHelpful] = useState<"up" | "down" | null>(null);

  const question = data.questions[currentIndex];
  const state = states[currentIndex];
  const isLastQuestion = currentIndex === data.questions.length - 1;
  const totalQuestions = data.questions.length;

  const updateState = (index: number, patch: Partial<QuestionState>) => {
    setStates((prev) =>
      prev.map((s, i) => (i === index ? { ...s, ...patch } : s))
    );
  };

  const handleOptionClick = (optionId: string) => {
    if (state.submitted) return;
    if (question.multipleAnswers) {
      const next = state.selected.includes(optionId)
        ? state.selected.filter((id) => id !== optionId)
        : [...state.selected, optionId];
      updateState(currentIndex, { selected: next });
    } else {
      updateState(currentIndex, { selected: [optionId] });
    }
  };

  const handleSubmit = () => {
    if (state.selected.length === 0) return;
    updateState(currentIndex, { submitted: true });
  };

  const handleReset = () => {
    setStates(data.questions.map(() => ({ selected: [], submitted: false })));
    setCurrentIndex(0);
    setHelpful(null);
  };

  const handlePrev = () => {
    if (currentIndex > 0) setCurrentIndex(currentIndex - 1);
  };

  const handleNext = () => {
    if (currentIndex < totalQuestions - 1) setCurrentIndex(currentIndex + 1);
  };

  const canGoNext = currentIndex < totalQuestions - 1;
  const canGoPrev = currentIndex > 0;
  const showHelpful = isLastQuestion && state.submitted;

  return (
    <div className="max-w-4xl mx-auto px-4 py-4">
      {/* Card */}
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden bg-white dark:bg-gray-900">
        {/* Title bar */}
        <div className="bg-indigo-50 dark:bg-indigo-950/50 border-b border-gray-200 dark:border-gray-700 px-6 py-3">
          <div
            className="quiz-title font-semibold text-gray-800 dark:text-gray-200 text-sm [&_p]:m-0"
            dangerouslySetInnerHTML={{ __html: data.titleMdHtml }}
          />
        </div>

        {/* Question body */}
        <div className="px-6 pt-5 pb-4">
          {/* Question text */}
          <div className="flex items-start gap-1.5 mb-4 text-sm font-medium text-gray-800 dark:text-gray-200">
            <span className="shrink-0 text-gray-500 dark:text-gray-400">{currentIndex + 1}.</span>
            <div
              className="quiz-question [&_p]:m-0 [&_p]:leading-relaxed [&_code]:font-mono [&_code]:rounded [&_code]:px-1 [&_code]:py-0.5"
              dangerouslySetInnerHTML={{ __html: question.questionTextHtml }}
            />
          </div>

          {/* Options */}
          <div className="space-y-3">
            {question.questionOptions.map((option, idx) => (
              <OptionCard
                key={option.id}
                option={option}
                label={OPTION_LABELS[idx]}
                isSelected={state.selected.includes(option.id)}
                submitted={state.submitted}
                onClick={() => handleOptionClick(option.id)}
              />
            ))}
          </div>
        </div>

        {/* Navigation bar */}
        <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-3 flex items-center justify-between bg-white dark:bg-gray-900">
          {/* Reset */}
          <button
            onClick={handleReset}
            aria-label="Reset"
            className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors p-1 rounded cursor-pointer"
          >
            <ResetIcon />
          </button>

          {/* Pagination */}
          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 text-sm select-none">
            <button
              onClick={handlePrev}
              disabled={!canGoPrev}
              aria-label="Previous question"
              className="p-1 rounded text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft />
            </button>
            <span className="min-w-12 text-center">
              {currentIndex + 1} / {totalQuestions}
            </span>
            <button
              onClick={handleNext}
              disabled={!canGoNext}
              aria-label="Next question"
              className="p-1 rounded text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight />
            </button>
          </div>

          {/* Submit / Next Question */}
          {!state.submitted ? (
            <button
              onClick={handleSubmit}
              disabled={state.selected.length === 0}
              className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded hover:bg-indigo-700 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Submit Answer
            </button>
          ) : canGoNext ? (
            <button
              onClick={handleNext}
              className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded hover:bg-indigo-700 transition-colors cursor-pointer"
            >
              Next Question
            </button>
          ) : (
            <div className="w-30" />
          )}
        </div>
      </div>

      {/* Helpful feedback */}
      {showHelpful && (
        <div className="mt-3 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 px-1">
          <span>Did you find this helpful?</span>
          <button
            onClick={() => setHelpful(helpful === "up" ? null : "up")}
            aria-label="Thumbs up"
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
          >
            <ThumbsUp active={helpful === "up"} />
          </button>
          <button
            onClick={() => setHelpful(helpful === "down" ? null : "down")}
            aria-label="Thumbs down"
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
          >
            <ThumbsDown active={helpful === "down"} />
          </button>
        </div>
      )}

      {/* Scoped styles for rendered HTML content */}
      <style>{`
        .quiz-question p { margin: 0; line-height: 1.6; }
        .quiz-question code {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 0.85em;
          background: #f3f4f6;
          border-radius: 3px;
          padding: 0.1em 0.35em;
        }
        .quiz-option-text p { margin: 0; line-height: 1.6; }
        .quiz-option-text code {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 0.85em;
          background: #f3f4f6;
          border-radius: 3px;
          padding: 0.1em 0.35em;
        }
        .quiz-explanation p { margin: 0 0 0.25rem; line-height: 1.6; }
        .quiz-explanation p:last-child { margin-bottom: 0; }
        .quiz-explanation code {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 0.85em;
          background: #f3f4f6;
          border-radius: 3px;
          padding: 0.1em 0.35em;
        }
        .quiz-title p { margin: 0; }
        .dark .quiz-question code,
        .dark .quiz-option-text code,
        .dark .quiz-explanation code { background: #1e293b; color: #e2e8f0; }
      `}</style>
    </div>
  );
}
