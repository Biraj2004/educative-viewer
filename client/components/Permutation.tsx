"use client";

import { useState, useMemo, useRef } from "react";

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

// drag source: hashid being dragged + where it came from (null = pool, number = slot index)
interface DragSource {
  hashid: string;
  fromSlot: number | null;
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
  const [dragOverTarget, setDragOverTarget] = useState<number | "pool" | null>(null);

  const dragSource = useRef<DragSource | null>(null);

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

  // ── Click interactions ────────────────────────────────────────────────────

  function handleOptionClick(hashid: string) {
    if (submitted || showSolution) return;
    setSelectedHashid((prev) => (prev === hashid ? null : hashid));
  }

  function handleSlotClick(slotIdx: number) {
    if (submitted || showSolution) return;
    if (selectedHashid) {
      const newSlots = [...slots];
      const prevIdx = newSlots.findIndex((h) => h === selectedHashid);
      if (prevIdx !== -1) newSlots[prevIdx] = null;
      newSlots[slotIdx] = selectedHashid;
      setSlots(newSlots);
      setSelectedHashid(null);
    } else if (slots[slotIdx]) {
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

  // ── Drag interactions ─────────────────────────────────────────────────────

  function onDragStartOption(e: React.DragEvent, hashid: string) {
    dragSource.current = { hashid, fromSlot: null };
    e.dataTransfer.effectAllowed = "move";
    setSelectedHashid(null);
  }

  function onDragStartSlot(e: React.DragEvent, slotIdx: number, hashid: string) {
    e.stopPropagation();
    dragSource.current = { hashid, fromSlot: slotIdx };
    e.dataTransfer.effectAllowed = "move";
    setSelectedHashid(null);
  }

  function onDragEnd() {
    dragSource.current = null;
    setDragOverTarget(null);
  }

  function onDragOverSlot(e: React.DragEvent, slotIdx: number) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverTarget(slotIdx);
  }

  function onDropSlot(e: React.DragEvent, slotIdx: number) {
    e.preventDefault();
    setDragOverTarget(null);
    const src = dragSource.current;
    if (!src) return;

    const newSlots = [...slots];

    if (src.fromSlot === null) {
      // From pool → slot: just place it (existing occupant stays until replaced)
      const displaced = newSlots[slotIdx];
      newSlots[slotIdx] = src.hashid;
      // displaced goes back to pool automatically (not in placedHashids)
      void displaced;
    } else {
      // From slot → slot: swap
      const srcHashid = newSlots[src.fromSlot];
      newSlots[src.fromSlot] = newSlots[slotIdx];
      newSlots[slotIdx] = srcHashid;
    }

    setSlots(newSlots);
    dragSource.current = null;
  }

  function onDragOverPool(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverTarget("pool");
  }

  function onDropPool(e: React.DragEvent) {
    e.preventDefault();
    setDragOverTarget(null);
    const src = dragSource.current;
    if (!src || src.fromSlot === null) return;
    // Dragged from a slot back to pool: clear the slot
    const newSlots = [...slots];
    newSlots[src.fromSlot] = null;
    setSlots(newSlots);
    dragSource.current = null;
  }

  // ── Controls ──────────────────────────────────────────────────────────────

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
  const interactive = !submitted && !showSolution;

  return (
    <div className="max-w-4xl mx-auto px-6 py-2">
      <div className="border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 shadow-sm">

        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
          <p className="text-xs font-semibold text-indigo-500 uppercase tracking-wider mb-1">Arrange in order</p>
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">{data.question_statement}</h3>
        </div>

        <div className="px-6 pt-4 pb-2 space-y-5">

          {/* Answer slots */}
          <div className="space-y-2">
            {Array.from({ length: data.numberOfQuestionBlock }, (_, i) => {
              const hashid = activeSlots[i];
              const option = hashid ? optionMap[hashid] : null;
              const isCorrect = submitted && hashid === data.protected_content[i];
              const isWrong = submitted && !!hashid && hashid !== data.protected_content[i];
              const isDragOver = dragOverTarget === i;

              return (
                <div
                  key={i}
                  onClick={() => handleSlotClick(i)}
                  onDragOver={(e) => interactive && onDragOverSlot(e, i)}
                  onDragLeave={() => setDragOverTarget(null)}
                  onDrop={(e) => interactive && onDropSlot(e, i)}
                  className={[
                    "flex items-stretch rounded-lg border-2 min-h-11 transition-all duration-150 overflow-hidden",
                    interactive ? "cursor-pointer" : "cursor-default",
                  isCorrect   ? "border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/30"
                  : isWrong   ? "border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/30"
                  : isDragOver ? "border-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 scale-[1.01]"
                  : option    ? "border-indigo-200 dark:border-indigo-700 bg-indigo-50/40 dark:bg-indigo-900/20 hover:border-indigo-400"
                  : selectedHashid ? "border-indigo-200 dark:border-indigo-700 border-dashed bg-indigo-50/20 dark:bg-indigo-900/10 hover:border-indigo-400"
                  : "border-dashed border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 hover:border-indigo-200",
                  ].join(" ")}
                >
                  {/* Step number badge */}
                  <div className={[
                    "w-10 shrink-0 flex items-center justify-center text-sm font-bold select-none",
                    isCorrect  ? "bg-emerald-200 dark:bg-emerald-800 text-emerald-800 dark:text-emerald-200"
                    : isWrong  ? "bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200"
                    : option   ? "bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500",
                  ].join(" ")}>
                    {i + 1}
                  </div>

                  {/* Draggable content area */}
                  <div
                    draggable={!!(option && interactive)}
                    onDragStart={option && interactive ? (e) => onDragStartSlot(e, i, hashid!) : undefined}
                    onDragEnd={onDragEnd}
                    className={[
                      "flex-1 px-3 py-2.5 text-sm text-gray-800 dark:text-gray-200 perm-slot-content flex items-center",
                      option && interactive ? "cursor-grab active:cursor-grabbing" : "",
                    ].join(" ")}
                  >
                    {option ? (
                      <span dangerouslySetInnerHTML={{ __html: option.content.mdhtml }} />
                    ) : (
                      <span className="text-gray-300 italic text-xs select-none">
                        {selectedHashid ? "Click to place here" : "Drag or click an option here"}
                      </span>
                    )}
                  </div>

                  {/* Remove × */}
                  {option && interactive && (
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
            <div
              className="pt-1"
              onDragOver={interactive ? onDragOverPool : undefined}
              onDragLeave={() => setDragOverTarget(null)}
              onDrop={interactive ? onDropPool : undefined}
            >
              <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
                Options
              </p>
              <div className={[
                "flex flex-wrap gap-2 min-h-10 rounded-lg p-1 transition-colors",
                dragOverTarget === "pool" ? "bg-indigo-50/60 dark:bg-indigo-900/20 ring-1 ring-indigo-200 dark:ring-indigo-800" : "",
              ].join(" ")}>
                {poolOptions.map((opt) => (
                  <div
                    key={opt.hashid}
                    role="button"
                    tabIndex={0}
                    draggable={interactive && !submitted}
                    onDragStart={interactive ? (e) => onDragStartOption(e, opt.hashid) : undefined}
                    onDragEnd={onDragEnd}
                    onClick={() => handleOptionClick(opt.hashid)}
                    onKeyDown={(e) => e.key === "Enter" && handleOptionClick(opt.hashid)}
                    className={[
                      "rounded-lg border-2 px-3 py-2 text-sm text-left transition-all duration-150 perm-option-content select-none",
                      submitted
                        ? "cursor-default opacity-40 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
                        : selectedHashid === opt.hashid
                          ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-900 dark:text-indigo-200 shadow-sm cursor-grab"
                          : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:border-indigo-300 hover:bg-indigo-50/40 dark:hover:bg-indigo-900/20 cursor-grab active:cursor-grabbing",
                    ].join(" ")}
                    dangerouslySetInnerHTML={{ __html: inlineHtml(opt.content.mdhtml) }}
                  />
                ))}
                {poolOptions.length === 0 && !submitted && (
                  <p className="text-xs text-gray-300 dark:text-gray-600 italic self-center px-2">All options placed — drag one back here to return it</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Score banner */}
        {submitted && score !== null && (
          <div className="mx-6 mt-2 mb-1 rounded-lg py-2 text-sm text-center bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-gray-600 dark:text-gray-400">
            You got{" "}
            <span className="font-semibold text-indigo-600 dark:text-indigo-400">{score}</span>
            {" "}/ {data.numberOfQuestionBlock} in the correct position.
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between mt-2">
          {!data.disableReset ? (
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
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
                className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
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
        .dark .perm-slot-content code,
        .dark .perm-option-content code { color: #fb7185; background: #4c0519; }
      `}</style>
    </div>
  );
}
