"use client";

import { useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SlateChild {
  text?: string;
  [key: string]: unknown;
}

interface SlateNode {
  type?: string;
  children?: SlateChild[];
  [key: string]: unknown;
}

export interface NotepadData {
  comp_id: string;
  title?: string;
  caption?: string;
  placeholderText?: string;
  characterLimit?: number;
  editorText?: SlateNode[];
  enableAI?: boolean;
  selectedAIModel?: string;
  systemPrompt?: string;
  turnLimit?: number;
  version?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function slateToText(nodes: SlateNode[]): string {
  return nodes
    .map((n) => (n.children ?? []).map((c) => c.text ?? "").join(""))
    .join("\n")
    .trim();
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function BotIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="10" rx="2" />
      <path d="M12 2v4M8 11V7a4 4 0 018 0v4" />
      <circle cx="9" cy="16" r="1" fill="currentColor" />
      <circle cx="15" cy="16" r="1" fill="currentColor" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 2L11 13" />
      <path d="M22 2L15 22l-4-9-9-4 20-7z" />
    </svg>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Notepad({ data }: { data: NotepadData }) {
  const initText = data.editorText?.length ? slateToText(data.editorText) : "";
  const [value, setValue] = useState(initText);
  const [submitted, setSubmitted] = useState(false);
  const charLimit = data.characterLimit ?? 0;

  const remaining = charLimit > 0 ? charLimit - value.length : null;
  const overLimit = remaining !== null && remaining < 0;

  function handleSubmit() {
    if (!value.trim() || overLimit) return;
    setSubmitted(true);
  }

  function handleReset() {
    setValue("");
    setSubmitted(false);
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-5 flex flex-col gap-4">
      {/* Question / title */}
      {data.title && (
        <div className="flex flex-col gap-1">
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 leading-relaxed">
            {data.title}
          </p>
        </div>
      )}

      {/* Editor area */}
      {!submitted ? (
        <div className="flex flex-col gap-2">
          <div
            className={`rounded-lg border transition-colors ${
              overLimit
                ? "border-red-400 dark:border-red-600"
                : "border-gray-300 dark:border-gray-600 focus-within:border-indigo-400 dark:focus-within:border-indigo-500"
            } bg-white dark:bg-gray-900`}
          >
            <textarea
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={data.placeholderText || "Write your answer here…"}
              rows={6}
              className="w-full px-4 py-3 bg-transparent text-sm text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 resize-y outline-none rounded-lg"
            />
            {/* Toolbar row */}
            <div className="flex items-center justify-between px-3 py-2 border-t border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-2">
                {data.enableAI && (
                  <span className="flex items-center gap-1 text-xs text-indigo-500 dark:text-indigo-400 font-medium">
                    <BotIcon />
                    AI Feedback
                    {data.selectedAIModel && (
                      <span className="text-gray-400 dark:text-gray-500 font-normal">
                        · {data.selectedAIModel}
                      </span>
                    )}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                {remaining !== null && (
                  <span
                    className={`text-xs tabular-nums ${
                      overLimit
                        ? "text-red-500"
                        : "text-gray-400 dark:text-gray-500"
                    }`}
                  >
                    {remaining} left
                  </span>
                )}
                <button
                  onClick={handleSubmit}
                  disabled={!value.trim() || overLimit}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors cursor-pointer"
                >
                  <SendIcon />
                  Submit
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Submitted state */
        <div className="flex flex-col gap-3">
          {/* User's answer */}
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 px-4 py-3">
            <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 mb-1 uppercase tracking-wide">Your answer</p>
            <p className="text-sm text-gray-700 dark:text-gray-200 whitespace-pre-wrap">{value}</p>
          </div>

          {/* AI feedback placeholder */}
          {data.enableAI && (
            <div className="rounded-lg border border-indigo-100 dark:border-indigo-900/50 bg-indigo-50 dark:bg-indigo-950/30 px-4 py-4">
              <div className="flex items-center gap-2 mb-2 text-indigo-600 dark:text-indigo-400">
                <BotIcon />
                <span className="text-xs font-semibold uppercase tracking-wide">AI Feedback</span>
                {data.selectedAIModel && (
                  <span className="text-xs text-gray-400 dark:text-gray-500 font-normal ml-auto">
                    {data.selectedAIModel}
                  </span>
                )}
              </div>
              <p className="text-xs text-indigo-500 dark:text-indigo-400 italic">
                AI feedback is not available in offline viewing mode.
              </p>
            </div>
          )}

          {/* Try again */}
          <div className="flex justify-end">
            <button
              onClick={handleReset}
              className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 underline transition-colors cursor-pointer"
            >
              Edit answer
            </button>
          </div>
        </div>
      )}

      {data.caption && (
        <p className="text-xs text-gray-400 dark:text-gray-500 text-center">{data.caption}</p>
      )}
    </div>
  );
}
