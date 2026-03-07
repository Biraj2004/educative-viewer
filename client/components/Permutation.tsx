"use client";

import { useState, useMemo } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PermutationOption {
  blockType: string;
  content: {
    data: string;
    mdhtml: string;
  };
  duplicateBlockCount: number;
  hashid: string;
  linkedTo: string | null;
  locked: boolean;
  maxRedemptionOfBlock: number;
  position: number | null;
}

export interface PermutationData {
  alignment: string;
  comp_id: string;
  disableReset: boolean;
  disableSolution: boolean;
  disableSubmit: boolean;
  numberOfQuestionBlock: number;
  options: PermutationOption[];
  protected_content: string[];
  question_statement: string;
  showOptions: boolean;
  version: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Strip outer <p> wrapper for inline display in option chips
function inlineHtml(mdhtml: string): string {
  return mdhtml.trim().replace(/^<p>([\s\S]*?)<\/p>\n?$/, "$1");
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Permutation({ data }: { data: PermutationData }) {
  const [slots, setSlots] = useState<(string | null)[]>(
    Array(data.numberOfQuestionBlock).fill(null)
  );
  const [selectedHashid, setSelectedHashid] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [showSolution, setShowSolution] = useState(false);

  // Stable shuffle on mount
  const shuffledOptions = useMemo(() => shuffle(data.options), [data.options]);

  const optionMap = useMemo(() => {
    const m: Record<string, PermutationOption> = {};
    data.options.forEach((o) => { m[o.hashid] = o; });
    return m;
  }, [data.options]);

  const activeSlots = showSolution
    ? data.protected_content.slice(0, data.numberOfQuestionBlock)
    : slots;

  const placedHashids = new Set(activeSlots.filter(Boolean) as string[]);
  const poolOptions = shuffledOptions.filter((o) => !placedHashids.has(o.hashid));

  // ── Interactions ──────────────────────────────────────────────────────────

  function handleOptionClick(hashid: string) {
    if (submitted || showSolution) return;
    setSelectedHashid((prev) => (prev === hashid ? null : hashid));
  }

  function handleSlotClick(slotIdx: number) {
    if (submitted || showSolution) return;

    if (selectedHashid) {
      const newSlots = [...slots];
      // If selected option is already in another slot, remove it from there
      const prevIdx = newSlots.findIndex((h) => h === selectedHashid);
      if (prevIdx !== -1) newSlots[prevIdx] = null;
      newSlots[slotIdx] = selectedHashid;
      setSlots(newSlots);
      setSelectedHashid(null);
    } else if (slots[slotIdx]) {
      // Remove from slot back to pool
      const newSlots = [...slots];
      newSlots[slotIdx] = null;
      setSlots(newSlots);
    }
  }

  function handleRemoveFromSlot(e: React.MouseEvent, slotIdx: number) {
    e.stopPropagation();
    const newSlots = [...slots];
    newSlots[slotIdx] = null;
    setSlots(newSlots);
  }

  function handleReset() {
    setSlots(Array(data.numberOfQuestionBlock).fill(null));
    setSelectedHashid(null);
    setSubmitted(false);
    setShowSolution(false);
  }

  function handleSubmit() {
    setSubmitted(true);
    setSelectedHashid(null);
    setShowSolution(false);
  }

  function handleShowSolution() {
    setShowSolution((v) => !v);
    setSubmitted(false);
    setSelectedHashid(null);
  }

  const score = submitted
    ? activeSlots.filter((h, i) => h === data.protected_content[i]).length
    : null;

  const allFilled = slots.every((s) => s !== null);

  return (
    <div className="max-w-4xl mx-auto px-6 py-2">
      <div className="border border-gray-200 rounded-xl bg-white shadow-sm">

        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100">
          <p className="text-xs font-semibold text-indigo-500 uppercase tracking-wider mb-1">Arrange in order</p>
          <h3 className="text-base font-semibold text-gray-900">{data.question_statement}</h3>
        </div>

        <div className="px-6 pt-4 pb-2 space-y-5">

          {/* Answer slots */}
          <div className="space-y-2">
            {Array.from({ length: data.numberOfQuestionBlock }, (_, i) => {
              const hashid = activeSlots[i];
              const option = hashid ? optionMap[hashid] : null;
              const isCorrect = submitted && hashid === data.protected_content[i];
              const isWrong = submitted && !!hashid && hashid !== data.protected_content[i];
              const isClickable = !submitted && !showSolution;

              return (
                <div
                  key={i}
                  onClick={() => handleSlotClick(i)}
                  className={[
                    "flex items-stretch rounded-lg border-2 min-h-11 transition-all duration-150 overflow-hidden",
                    isClickable ? "cursor-pointer" : "cursor-default",
                    isCorrect  ? "border-emerald-300 bg-emerald-50"
                    : isWrong  ? "border-red-300 bg-red-50"
                    : option   ? "border-indigo-200 bg-indigo-50/40 hover:border-indigo-400"
                    : selectedHashid ? "border-indigo-200 border-dashed bg-indigo-50/20 hover:border-indigo-400"
                    : "border-dashed border-gray-200 bg-gray-50 hover:border-indigo-200",
                  ].join(" ")}
                >
                  {/* Step number badge */}
                  <div className={[
                    "w-10 shrink-0 flex items-center justify-center text-sm font-bold",
                    isCorrect ? "bg-emerald-200 text-emerald-800"
                    : isWrong ? "bg-red-200 text-red-800"
                    : option  ? "bg-indigo-100 text-indigo-700"
                    : "bg-gray-100 text-gray-400",
                  ].join(" ")}>
                    {i + 1}
                  </div>

                  {/* Content */}
                  <div className="flex-1 px-3 py-2.5 text-sm text-gray-800 perm-slot-content flex items-center">
                    {option ? (
                      <span dangerouslySetInnerHTML={{ __html: option.content.mdhtml }} />
                    ) : (
                      <span className="text-gray-300 italic text-xs select-none">
                        {selectedHashid ? "Click to place selected option" : "Click to select an option, then click here"}
                      </span>
                    )}
                  </div>

                  {/* Remove ×  */}
                  {option && !submitted && !showSolution && (
                    <button
                      onClick={(e) => handleRemoveFromSlot(e, i)}
                      className="mr-2 shrink-0 self-center text-gray-300 hover:text-gray-600 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Options pool */}
          {data.showOptions && !showSolution && (
            <div className="pt-1">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Options
              </p>
              <div className="flex flex-wrap gap-2">
                {poolOptions.map((opt) => (
                  <button
                    key={opt.hashid}
                    onClick={() => handleOptionClick(opt.hashid)}
                    disabled={submitted}
                    className={[
                      "rounded-lg border-2 px-3 py-2 text-sm text-left transition-all duration-150 perm-option-content",
                      submitted
                        ? "cursor-default opacity-40 border-gray-200 bg-gray-50 text-gray-600"
                        : selectedHashid === opt.hashid
                          ? "border-indigo-500 bg-indigo-50 text-indigo-900 shadow-sm"
                          : "border-gray-200 bg-white text-gray-700 hover:border-indigo-300 hover:bg-indigo-50/40 cursor-pointer",
                    ].join(" ")}
                    dangerouslySetInnerHTML={{ __html: inlineHtml(opt.content.mdhtml) }}
                  />
                ))}
                {poolOptions.length === 0 && !submitted && (
                  <p className="text-xs text-gray-300 italic self-center">All options placed</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Score banner */}
        {submitted && score !== null && (
          <div className="mx-6 mt-2 mb-1 rounded-lg py-2 text-sm text-center bg-gray-50 border border-gray-100 text-gray-600">
            You got{" "}
            <span className="font-semibold text-indigo-600">{score}</span>
            {" "}/ {data.numberOfQuestionBlock} in the correct position.
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between mt-2">
          {!data.disableReset ? (
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Reset
            </button>
          ) : <div />}

          <div className="flex gap-2">
            {!data.disableSolution && (
              <button
                onClick={handleShowSolution}
                className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                {showSolution ? "Hide Solution" : "Show Solution"}
              </button>
            )}
            {!data.disableSubmit && (
              <button
                onClick={handleSubmit}
                disabled={submitted || !allFilled}
                className="px-4 py-2 rounded-lg bg-indigo-600 text-sm text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Submit
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Scoped styles for mdhtml content */}
      <style>{`
        .perm-slot-content p { margin: 0; line-height: 1.5; }
        .perm-slot-content code { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 0.85em; color: #e11d48; background: #fff1f2; padding: 0.1em 0.35em; border-radius: 3px; }
        .perm-option-content code { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 0.85em; color: #e11d48; background: #fff1f2; padding: 0.1em 0.35em; border-radius: 3px; }
      `}</style>
    </div>
  );
}
