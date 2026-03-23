"use client";

import { useState, useCallback, useEffect } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface InstaCalcCell {
  className?: string;
  color?: string;
  expr: string;
  hidden: boolean;
  key: string;
  readOnly: boolean;
  textColor?: string;
  val: string | number;
}

export interface InstaCalcData {
  cols: number;
  comp_id: string;
  data: InstaCalcCell[][];
  rows: number;
  showHeaders: boolean;
  title?: string;
  version: number;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asBool(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function columnLabel(index: number): string {
  return String.fromCharCode(65 + (index % 26));
}

function normalizeCell(raw: unknown, rowIndex: number, colIndex: number): InstaCalcCell {
  const rec = asRecord(raw);
  const key = asString(rec.key) || `${columnLabel(colIndex)}${rowIndex + 1}`;
  const expr = asString(rec.expr);
  const rawVal = rec.val;
  const val = typeof rawVal === "string" || typeof rawVal === "number" ? rawVal : "";

  return {
    className: asString(rec.className) || undefined,
    color: asString(rec.color) || undefined,
    expr,
    hidden: asBool(rec.hidden),
    key,
    readOnly: asBool(rec.readOnly),
    textColor: asString(rec.textColor) || undefined,
    val,
  };
}

function normalizeGrid(value: unknown): InstaCalcCell[][] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((row) => Array.isArray(row))
    .map((row, rowIndex) =>
      (row as unknown[]).map((cell, colIndex) => normalizeCell(cell, rowIndex, colIndex))
    );
}

// ─── Formula Evaluator ───────────────────────────────────────────────────────

function evaluateFormula(
  expr: string,
  values: Record<string, string | number>
): string | number {
  if (!expr.startsWith("=")) return expr;

  // Replace cell references (e.g. B2, A1) with their numeric values
  const formula = expr.slice(1).replace(/([A-Z]+)(\d+)/g, (_, col, row) => {
    const val = values[`${col}${row}`];
    const num = parseFloat(String(val));
    return isNaN(num) ? "0" : String(num);
  });

  // Only allow safe arithmetic characters after substitution
  if (!/^[\d\s+\-*/.()]+$/.test(formula)) return 0;

  try {
    const result = new Function(`"use strict"; return (${formula})`)() as number;
    return typeof result === "number" && isFinite(result)
      ? parseFloat(result.toFixed(10))
      : 0;
  } catch {
    return 0;
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isFormula(expr: string) {
  return expr.startsWith("=");
}

function initValues(data: InstaCalcCell[][]): Record<string, string | number> {
  const vals: Record<string, string | number> = {};
  data.flat().forEach((cell) => {
    vals[cell.key] = cell.val;
  });
  return vals;
}

// Maps a raw hex color to Tailwind class names (with dark mode variants).
function getCellClasses(color?: string): string {
  if (!color || color === "transparent") return "dark:bg-gray-800/50 dark:text-gray-200";
  const hex = color.replace("#", "");
  if (hex.length !== 6) return "dark:bg-gray-800/50 dark:text-gray-200";
  const r = parseInt(hex.slice(0, 2), 16) / 255;
  const g = parseInt(hex.slice(2, 4), 16) / 255;
  const b = parseInt(hex.slice(4, 6), 16) / 255;
  const lin = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  const lum = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);

  // Dark (e.g. #0000ff) → muted indigo header
  if (lum < 0.15) return "bg-[#3d4e8a] text-[#e8ecf8] dark:bg-[#1e2d5a] dark:text-[#c0d4f0]";
  // Warm / yellow (e.g. #ffff00) → soft amber tint
  if (lum < 0.75) return "bg-[#fefce8] text-[#78600a] dark:bg-[#2c1f00] dark:text-[#fde68a]";
  // Light (e.g. #c9daf8) → very subtle slate
  return "bg-[#f1f4f9] text-[#6b7280] dark:bg-[#1e293b] dark:text-[#94a3b8]";
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function InstaCalc({ data }: { data: InstaCalcData }) {
  const grid = normalizeGrid((data as unknown as Record<string, unknown>)?.data);
  const safeCols = Math.max(
    1,
    asNumber((data as unknown as Record<string, unknown>)?.cols, 0) ||
      grid.reduce((max, row) => Math.max(max, row.length), 0)
  );
  const safeTitle = asString((data as unknown as Record<string, unknown>)?.title);

  const [values, setValues] = useState<Record<string, string | number>>(() =>
    initValues(grid)
  );

  useEffect(() => {
    setValues(initValues(grid));
  }, [grid]);

  // Recompute all formula cells whenever values change
  const recompute = useCallback(
    (current: Record<string, string | number>) => {
      const next = { ...current };
      let changed = true;
      // Iterate to resolve chained formulas
      while (changed) {
        changed = false;
        grid.flat().forEach((cell) => {
          if (isFormula(cell.expr)) {
            const result = evaluateFormula(cell.expr, next);
            if (next[cell.key] !== result) {
              next[cell.key] = result;
              changed = true;
            }
          }
        });
      }
      return next;
    },
    [grid]
  );

  // Run once on mount to resolve initial formulas
  useEffect(() => {
    setValues((prev) => recompute(prev));
  }, [recompute]);

  function handleChange(key: string, raw: string) {
    setValues((prev) => {
      const updated = { ...prev, [key]: raw };
      return recompute(updated);
    });
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-2">
      {/* Title */}
      {safeTitle && (
        <h3 className="text-center text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">
          {safeTitle}
        </h3>
      )}

      {/* Grid */}
      <div
        className="border border-gray-200 dark:border-gray-700 rounded overflow-hidden"
        style={{ display: "grid", gridTemplateColumns: `repeat(${safeCols}, 1fr)` }}
      >
        {grid.map((row) =>
          row.map((cell) => {
            if (cell.hidden) return null;

            const displayValue = values[cell.key] ?? "";
            const formula = isFormula(cell.expr);
            const cellClasses = getCellClasses(cell.color);

            // Header / read-only display cell
            if (cell.readOnly) {
              return (
                <div
                  key={cell.key}
                  className={`px-3 py-2 text-sm border border-gray-100 dark:border-gray-700 flex items-center font-medium ${cellClasses}`}
                >
                  {String(displayValue)}
                </div>
              );
            }

            // Formula cell (computed, not editable)
            if (formula) {
              return (
                <div
                  key={cell.key}
                  className="px-3 py-2 text-sm border border-gray-100 dark:border-gray-700 flex items-center justify-between bg-white dark:bg-gray-900"
                >
                  <span className="text-indigo-300 font-mono text-xs select-none italic mr-1">
                    f
                  </span>
                  <span className="font-mono text-gray-700 dark:text-gray-300">{String(displayValue)}</span>
                </div>
              );
            }

            // Editable input cell
            return (
              <div
                key={cell.key}
                className="border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-gray-800 focus-within:border-indigo-400 transition-colors"
              >
                <input
                  type="text"
                  value={String(displayValue)}
                  onChange={(e) => handleChange(cell.key, e.target.value)}
                  className="w-full h-full px-3 py-2 text-sm outline-none bg-transparent text-gray-800 dark:text-gray-200 placeholder:text-gray-300 dark:placeholder:text-gray-600"
                  placeholder={cell.expr !== "" ? cell.expr : undefined}
                />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
