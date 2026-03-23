import React from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TableComponentData {
  comp_id: string;
  title: string;
  titleAlignment: string;
  columnWidths: number[];
  numberOfRows: number;
  numberOfColumns: number;
  data: string[][];
  customStyles: Record<string, string>[][];
  mergeInfo: Record<string, unknown>;
  template: number;
  version: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function titleAlignClass(alignment: string) {
  if (alignment === "align-center") return "text-center";
  if (alignment === "align-right") return "text-right";
  return "text-left";
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function normalizeRows(value: unknown): string[][] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((row) => Array.isArray(row))
    .map((row) => (row as unknown[]).map((cell) => asString(cell)));
}

function normalizeColumnWidths(value: unknown, colCount: number): number[] {
  if (!Array.isArray(value)) return [];
  const widths = value
    .map((w) => (typeof w === "number" && Number.isFinite(w) && w > 0 ? w : 0))
    .filter((w) => w > 0);
  if (widths.length !== colCount) return [];
  return widths;
}

function normalizeStyles(value: unknown): Record<string, string>[][] {
  if (!Array.isArray(value)) return [];
  return value.map((row) => {
    if (!Array.isArray(row)) return [];
    return row.map((cell) => {
      if (!cell || typeof cell !== "object") return {};
      return cell as Record<string, string>;
    });
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Table({ data }: { data: TableComponentData }) {
  const rows = normalizeRows((data as unknown as Record<string, unknown>)?.data);
  const colCount = rows.reduce((max, row) => Math.max(max, row.length), 0);
  const columnWidths = normalizeColumnWidths((data as unknown as Record<string, unknown>)?.columnWidths, colCount);
  const normalizedWidths = columnWidths.length > 0
    ? columnWidths
    : Array.from({ length: colCount }, () => 1);
  const customStyles = normalizeStyles((data as unknown as Record<string, unknown>)?.customStyles);

  if (rows.length === 0 || colCount === 0) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-2">
        <div className="rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
          No table data available.
        </div>
      </div>
    );
  }

  const isHeader = (rowIdx: number) => rowIdx === 0;
  const totalWidth = normalizedWidths.reduce((a, b) => a + b, 0);

  return (
    <div className="max-w-4xl mx-auto px-6 py-2">
      {/* Title */}
      {data.title && (
        <h2 className={`text-2xl font-bold text-gray-900 dark:text-gray-100 mb-5 ${titleAlignClass(asString(data.titleAlignment))}`}>
          {asString(data.title)}
        </h2>
      )}

      {/* Table wrapper — percentage widths, no scroll */}
      <div className="rounded border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <table className="w-full border-collapse">
          <colgroup>
            {normalizedWidths.map((w, i) => (
              <col key={i} style={{ width: `${(w / totalWidth) * 100}%` }} />
            ))}
          </colgroup>
          <tbody>
            {rows.map((row, rowIdx) => (
              <tr key={rowIdx} className={isHeader(rowIdx) ? "bg-white dark:bg-gray-800" : "bg-white dark:bg-gray-900"}>
                {row.map((cellHtml, colIdx) => {
                  // Strip inline background-color from customStyles in dark mode via CSS;
                  // still apply other style properties (width, text-align, etc.)
                  const cellStyle = customStyles?.[rowIdx]?.[colIdx] ?? {};
                  const Tag = isHeader(rowIdx) ? "th" : "td";
                  return (
                    <Tag
                      key={colIdx}
                      style={cellStyle}
                      className={`border border-gray-200 dark:border-gray-700 px-4 py-3 align-middle table-cell-content ${
                        isHeader(rowIdx)
                          ? "font-semibold text-gray-700 dark:text-gray-100"
                          : "text-gray-800 dark:text-gray-300"
                      }`}
                      dangerouslySetInnerHTML={{ __html: cellHtml }}
                    />
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Scoped styles for Quill-generated HTML */}
      <style>{`
        .table-cell-content p { margin: 0; line-height: 1.5; }
        .table-cell-content p + p { margin-top: 0.15rem; }
        .table-cell-content .ql-align-center { text-align: center; }
        .table-cell-content .ql-align-right  { text-align: right; }
        .table-cell-content code {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 0.85em;
          color: #e11d48;
          background: #fff1f2;
          padding: 0.1em 0.35em;
          border-radius: 3px;
        }
        .dark .table-cell-content code {
          color: #fb7185;
          background: #4c0519;
        }
        /* Override inline background-color set by customStyles in dark mode */
        .dark .table-cell-content,
        .dark th.table-cell-content,
        .dark td.table-cell-content {
          background-color: transparent !important;
        }
        .table-cell-content sup { font-size: 0.65em; vertical-align: super; line-height: 0; }
        .table-cell-content br  { display: block; content: ""; margin-top: 0.25rem; }
      `}</style>
    </div>
  );
}
