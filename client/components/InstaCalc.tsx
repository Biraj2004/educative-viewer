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

// Maps a raw hex color to a tasteful muted equivalent based on perceived luminance.
function softCellStyle(color?: string): React.CSSProperties {
  if (!color || color === "transparent") return {};
  const hex = color.replace("#", "");
  if (hex.length !== 6) return {};
  const r = parseInt(hex.slice(0, 2), 16) / 255;
  const g = parseInt(hex.slice(2, 4), 16) / 255;
  const b = parseInt(hex.slice(4, 6), 16) / 255;
  const lin = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  const lum = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);

  // Dark (e.g. #0000ff) → muted indigo header
  if (lum < 0.15) return { backgroundColor: "#3d4e8a", color: "#e8ecf8" };
  // Warm / yellow (e.g. #ffff00) → soft amber tint
  if (lum < 0.75) return { backgroundColor: "#fefce8", color: "#78600a" };
  // Light (e.g. #c9daf8) → very subtle slate
  return { backgroundColor: "#f1f4f9", color: "#6b7280" };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function InstaCalc({ data }: { data: InstaCalcData }) {
  const [values, setValues] = useState<Record<string, string | number>>(() =>
    initValues(data.data)
  );

  // Recompute all formula cells whenever values change
  const recompute = useCallback(
    (current: Record<string, string | number>) => {
      const next = { ...current };
      let changed = true;
      // Iterate to resolve chained formulas
      while (changed) {
        changed = false;
        data.data.flat().forEach((cell) => {
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
    [data.data]
  );

  // Run once on mount to resolve initial formulas
  useEffect(() => {
    setValues((prev) => recompute(prev));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleChange(key: string, raw: string) {
    setValues((prev) => {
      const updated = { ...prev, [key]: raw };
      return recompute(updated);
    });
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-2">
      {/* Title */}
      {data.title && (
        <h3 className="text-center text-lg font-bold text-gray-900 mb-4">
          {data.title}
        </h3>
      )}

      {/* Grid */}
      <div
        className="border border-gray-200 rounded overflow-hidden"
        style={{ display: "grid", gridTemplateColumns: `repeat(${data.cols}, 1fr)` }}
      >
        {data.data.map((row) =>
          row.map((cell) => {
            if (cell.hidden) return null;

            const displayValue = values[cell.key] ?? "";
            const formula = isFormula(cell.expr);
            const style = softCellStyle(cell.color);

            // Header / read-only display cell
            if (cell.readOnly) {
              return (
                <div
                  key={cell.key}
                  style={style}
                  className="px-3 py-2 text-sm border border-gray-100 flex items-center font-medium"
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
                  className="px-3 py-2 text-sm border border-gray-100 flex items-center justify-between bg-white"
                >
                  <span className="text-indigo-300 font-mono text-xs select-none italic mr-1">
                    f
                  </span>
                  <span className="font-mono text-gray-700">{String(displayValue)}</span>
                </div>
              );
            }

            // Editable input cell
            return (
              <div
                key={cell.key}
                className="border border-indigo-200 bg-white focus-within:border-indigo-400 transition-colors"
              >
                <input
                  type="text"
                  value={String(displayValue)}
                  onChange={(e) => handleChange(cell.key, e.target.value)}
                  className="w-full h-full px-3 py-2 text-sm outline-none bg-transparent text-gray-800 placeholder:text-gray-300"
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
