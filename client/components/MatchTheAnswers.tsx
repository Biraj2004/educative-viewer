"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MatchItem {
  id: string;
  text: string;
}

export interface MatchTheAnswersData {
  comp_id: string;
  title?: string;
  leftHeader?: string;
  rightHeader?: string;
  statements: MatchItem[];
  options: MatchItem[];
  solution: Record<string, string>; // statementId → optionId
}

interface LineCoord {
  leftId: string;
  rightId: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  correct: boolean | null; // null = not submitted
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function MatchTheAnswers({ data }: { data: MatchTheAnswersData }) {
  const [connections, setConnections] = useState<Record<string, string>>({});
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  const [showSolution, setShowSolution] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [lines, setLines] = useState<LineCoord[]>([]);

  const containerRef = useRef<HTMLDivElement>(null);
  const leftRefs = useRef<(HTMLDivElement | null)[]>([]);
  const rightRefs = useRef<(HTMLDivElement | null)[]>([]);

  const activeConnections = showSolution ? data.solution : connections;

  const computeLines = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const newLines: LineCoord[] = [];

    Object.entries(activeConnections).forEach(([leftId, rightId]) => {
      const leftIdx = data.statements.findIndex((s) => s.id === leftId);
      const rightIdx = data.options.findIndex((o) => o.id === rightId);
      const leftEl = leftRefs.current[leftIdx];
      const rightEl = rightRefs.current[rightIdx];
      if (!leftEl || !rightEl) return;

      const lr = leftEl.getBoundingClientRect();
      const rr = rightEl.getBoundingClientRect();

      newLines.push({
        leftId,
        rightId,
        x1: lr.right - rect.left,
        y1: lr.top + lr.height / 2 - rect.top,
        x2: rr.left - rect.left,
        y2: rr.top + rr.height / 2 - rect.top,
        correct: submitted ? data.solution[leftId] === rightId : null,
      });
    });

    setLines(newLines);
  }, [activeConnections, data.statements, data.options, submitted, data.solution]);

  useEffect(() => {
    // Use RAF to avoid calling setState synchronously in effect body
    const id = requestAnimationFrame(() => computeLines());
    const obs = new ResizeObserver(computeLines);
    if (containerRef.current) obs.observe(containerRef.current);
    return () => { cancelAnimationFrame(id); obs.disconnect(); };
  }, [computeLines]);

  function handleLeftClick(id: string) {
    if (submitted || showSolution) return;
    setSelectedLeft((prev) => (prev === id ? null : id));
  }

  function handleRightClick(optionId: string) {
    if (submitted || showSolution || !selectedLeft) return;
    setConnections((prev) => {
      const next = { ...prev };
      // Remove any left item already connected to this right option
      Object.keys(next).forEach((k) => { if (next[k] === optionId) delete next[k]; });
      // Toggle: disconnect if already connected, else connect
      if (next[selectedLeft] === optionId) delete next[selectedLeft];
      else next[selectedLeft] = optionId;
      return next;
    });
    setSelectedLeft(null);
  }

  function handleReset() {
    setConnections({});
    setSelectedLeft(null);
    setSubmitted(false);
    setShowSolution(false);
  }

  function handleShowSolution() {
    setShowSolution((v) => !v);
    setSubmitted(false);
    setSelectedLeft(null);
  }

  function handleSubmit() {
    setSubmitted(true);
    setSelectedLeft(null);
    setShowSolution(false);
  }

  const score = submitted
    ? Object.entries(connections).filter(([l, r]) => data.solution[l] === r).length
    : null;

  const uid = data.comp_id.replace(/[^a-zA-Z0-9]/g, "");

  return (
    <div className="max-w-4xl mx-auto px-6 py-2">
      <div className="border border-gray-200 rounded-xl bg-white shadow-sm">

        {/* Title */}
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-900">
            {data.title ?? "Match The Answer"}
          </h3>
        </div>

        {/* Grid */}
        <div ref={containerRef} className="relative px-6 pt-4 pb-6">

          {/* Column headers */}
          <div className="grid gap-4 mb-3" style={{ gridTemplateColumns: "5fr 3fr 5fr" }}>
            <div className="text-center text-xs font-semibold text-gray-500 uppercase tracking-wide bg-gray-50 rounded py-1.5">
              {data.leftHeader ?? "Statement"}
            </div>
            <div />
            <div className="text-center text-xs font-semibold text-gray-500 uppercase tracking-wide bg-gray-50 rounded py-1.5">
              {data.rightHeader ?? "Match With"}
            </div>
          </div>

          {/* Items */}
          <div className="grid gap-3" style={{ gridTemplateColumns: "5fr 3fr 5fr" }}>
            {data.statements.map((stmt, i) => {
              const option = data.options[i];
              const isSelectedLeft = selectedLeft === stmt.id;
              const isConnected = !!activeConnections[stmt.id];
              const isCorrect = submitted && data.solution[stmt.id] === connections[stmt.id];
              const isWrong = submitted && !!connections[stmt.id] && !isCorrect;
              const rightConnected = option
                ? Object.values(activeConnections).includes(option.id)
                : false;

              return (
                <React.Fragment key={stmt.id}>
                  {/* Left statement */}
                  <div
                    ref={(el) => { leftRefs.current[i] = el; }}
                    onClick={() => handleLeftClick(stmt.id)}
                    className={[
                      "rounded-lg border-2 px-4 py-3 min-h-16 flex flex-col justify-center transition-all duration-150",
                      !submitted && !showSolution ? "cursor-pointer" : "cursor-default",
                      isSelectedLeft
                        ? "border-indigo-400 bg-indigo-50 shadow-sm"
                        : submitted
                          ? isCorrect
                            ? "border-emerald-300 bg-emerald-50"
                            : isWrong
                              ? "border-red-300 bg-red-50"
                              : "border-gray-200 bg-gray-50"
                          : isConnected
                            ? "border-indigo-200 bg-indigo-50/40"
                            : "border-gray-200 bg-gray-50 hover:border-indigo-200",
                    ].join(" ")}
                  >
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                      {stmt.id}
                    </span>
                    <span className="text-sm font-mono text-rose-500 wrap-break-word leading-snug">
                      {stmt.text}
                    </span>
                  </div>

                  {/* Middle spacer — SVG lines drawn here via absolute overlay */}
                  <div />

                  {/* Right option */}
                  {option ? (
                    <div
                      ref={(el) => { rightRefs.current[i] = el; }}
                      onClick={() => handleRightClick(option.id)}
                      className={[
                        "rounded-lg border px-4 py-3 min-h-16 flex items-center transition-all duration-150",
                        !submitted && !showSolution && selectedLeft
                          ? "cursor-pointer border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/40"
                          : "cursor-default border-transparent",
                        rightConnected && !submitted && !showSolution ? "bg-indigo-50/20" : "",
                      ].join(" ")}
                    >
                      <span className="text-sm text-gray-700 leading-snug">{option.text}</span>
                    </div>
                  ) : (
                    <div ref={(el) => { rightRefs.current[i] = el; }} className="min-h-16" />
                  )}
                </React.Fragment>
              );
            })}
          </div>

          {/* SVG lines overlay */}
          <svg
            className="absolute inset-0 pointer-events-none"
            style={{ width: "100%", height: "100%", overflow: "visible" }}
          >
            <defs>
              {[
                { id: `${uid}-neutral`, color: "#818cf8" },
                { id: `${uid}-solution`, color: "#6366f1" },
                { id: `${uid}-correct`,  color: "#10b981" },
                { id: `${uid}-wrong`,    color: "#ef4444" },
              ].map(({ id, color }) => (
                <marker key={id} id={id} markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
                  <path d="M0,0 L0,7 L7,3.5 z" fill={color} fillOpacity="0.9" />
                </marker>
              ))}
            </defs>

            {lines.map((line) => {
              const isCorrect = line.correct === true;
              const isWrong = line.correct === false;
              const stroke =
                isCorrect ? "#10b981"
                  : isWrong ? "#ef4444"
                    : showSolution ? "#6366f1"
                      : "#818cf8";
              const markerId =
                isCorrect ? `${uid}-correct`
                  : isWrong ? `${uid}-wrong`
                    : showSolution ? `${uid}-solution`
                      : `${uid}-neutral`;
              const mx = (line.x1 + line.x2) / 2;

              return (
                <path
                  key={`${line.leftId}-${line.rightId}`}
                  d={`M ${line.x1} ${line.y1} C ${mx} ${line.y1}, ${mx} ${line.y2}, ${line.x2 - 7} ${line.y2}`}
                  fill="none"
                  stroke={stroke}
                  strokeWidth="1.75"
                  strokeOpacity="0.75"
                  markerEnd={`url(#${markerId})`}
                />
              );
            })}
          </svg>
        </div>

        {/* Score banner */}
        {submitted && score !== null && (
          <div className="px-6 py-2 border-t border-gray-100 text-sm text-center bg-gray-50 text-gray-600">
            You scored{" "}
            <span className="font-semibold text-indigo-600">{score}</span>
            {" "}/ {data.statements.length} correct.
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
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

          <div className="flex gap-2">
            <button
              onClick={handleShowSolution}
              className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              {showSolution ? "Hide Solution" : "Show Solution"}
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitted || Object.keys(connections).length === 0}
              className="px-4 py-2 rounded-lg bg-indigo-600 text-sm text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Submit
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
