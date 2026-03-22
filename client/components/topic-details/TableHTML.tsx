import React from "react";

type StyleMap = Record<string, string>;

export interface TableHTMLData {
  type?: string;
  html?: string;
  data?: unknown;
  columnWidths?: number[];
  title?: string;
  titleAlignment?: string;
  customStyles?: StyleMap[][];
  children?: unknown[];
  mergeInfo?: Record<string, unknown>;
  content?: {
    html?: string;
    data?: unknown;
    columnWidths?: number[];
    title?: string;
    titleAlignment?: string;
    customStyles?: StyleMap[][];
    children?: unknown[];
    mergeInfo?: Record<string, unknown>;
  };
}

interface NormalizedTableData {
  title: string;
  titleAlignment: string;
  columnWidths: number[];
  rows: string[][];
  customStyles: StyleMap[][];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeCellHtml(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  return `<p>${escapeHtml(String(value))}</p>`;
}

function normalizeRows(value: unknown): string[][] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((row) => Array.isArray(row))
    .map((row) => (row as unknown[]).map((cell) => normalizeCellHtml(cell)));
}

function normalizeWidths(value: unknown, colCount: number): number[] {
  if (!Array.isArray(value)) return [];
  const widths = value
    .map((w) => (typeof w === "number" && Number.isFinite(w) && w > 0 ? w : 0))
    .filter((w) => w > 0);
  if (widths.length !== colCount) return [];
  return widths;
}

function titleAlignClass(alignment: string): string {
  if (alignment === "align-center") return "text-center";
  if (alignment === "align-right") return "text-right";
  return "text-left";
}

function extractInlineHtml(node: unknown): string {
  if (!isRecord(node)) return "";
  const text = typeof node.text === "string" ? escapeHtml(node.text) : "";
  if (text) {
    if (node.code === true) return `<code>${text}</code>`;
    if (node.bold === true) return `<strong>${text}</strong>`;
    return text;
  }

  const children = Array.isArray(node.children) ? node.children : [];
  const type = typeof node.type === "string" ? node.type : "";
  const childHtml = children.map((child) => extractInlineHtml(child)).join("");

  if (type === "paragraph") return `<p>${childHtml}</p>`;
  return childHtml;
}

function extractRowsFromChildren(value: unknown): string[][] {
  if (!Array.isArray(value)) return [];
  const rows: string[][] = [];

  function visit(node: unknown): void {
    if (!isRecord(node)) return;
    const type = typeof node.type === "string" ? node.type : "";

    if (type === "table-row") {
      const rowChildren = Array.isArray(node.children) ? node.children : [];
      const row: string[] = rowChildren
        .filter((cell) => isRecord(cell) && cell.type === "table-cell")
        .map((cell) => {
          const cellChildren = Array.isArray((cell as Record<string, unknown>).children)
            ? ((cell as Record<string, unknown>).children as unknown[])
            : [];
          const html = cellChildren.map((child) => extractInlineHtml(child)).join("");
          return html || "<p></p>";
        });

      if (row.length > 0) rows.push(row);
    }

    const children = Array.isArray(node.children) ? node.children : [];
    children.forEach(visit);
  }

  value.forEach(visit);
  return rows;
}

function getHtml(data: TableHTMLData): string {
  if (typeof data?.html === "string") {
    const rootHtml = data.html.trim();
    if (rootHtml) return rootHtml;
  }
  if (typeof data?.content?.html === "string") {
    const contentHtml = data.content.html.trim();
    if (contentHtml) return contentHtml;
  }
  return "";
}

function getNormalizedTableData(data: TableHTMLData): NormalizedTableData | null {
  const content = isRecord(data.content) ? data.content : null;

  const rootRows = normalizeRows(data.data);
  const contentRows = normalizeRows(content?.data);
  const childrenRows = extractRowsFromChildren(data.children);
  const contentChildrenRows = extractRowsFromChildren(content?.children);
  const rows = rootRows.length > 0
    ? rootRows
    : contentRows.length > 0
      ? contentRows
      : childrenRows.length > 0
        ? childrenRows
        : contentChildrenRows;

  if (rows.length === 0) return null;

  const colCount = rows[0]?.length ?? 0;
  const rootWidths = normalizeWidths(data.columnWidths, colCount);
  const contentWidths = normalizeWidths(content?.columnWidths, colCount);
  const columnWidths = rootWidths.length > 0 ? rootWidths : contentWidths;

  const title = typeof data.title === "string"
    ? data.title
    : typeof content?.title === "string"
      ? content.title
      : "";
  const titleAlignment = typeof data.titleAlignment === "string"
    ? data.titleAlignment
    : typeof content?.titleAlignment === "string"
      ? content.titleAlignment
      : "align-left";

  const customStyles = Array.isArray(data.customStyles)
    ? data.customStyles
    : Array.isArray(content?.customStyles)
      ? content.customStyles
      : [];

  return {
    title,
    titleAlignment,
    columnWidths,
    rows,
    customStyles,
  };
}

export default function TableHTML({ data }: { data: TableHTMLData }) {
  const html = getHtml(data);
  const normalized = html ? null : getNormalizedTableData(data);

  if (!html && !normalized) {
    return (
      <div className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
        No table data available.
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-2">
      {normalized?.title ? (
        <h2 className={`text-2xl font-bold text-gray-900 dark:text-gray-100 mb-5 ${titleAlignClass(normalized.titleAlignment)}`}>
          {normalized.title}
        </h2>
      ) : null}

      <div className="table-html-wrapper overflow-x-auto">
        {html ? (
          <div
            // Source content comes from trusted backend payloads.
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : normalized ? (
          <table>
            {normalized.columnWidths.length > 0 ? (
              <colgroup>
                {normalized.columnWidths.map((w, i) => {
                  const total = normalized.columnWidths.reduce((acc, width) => acc + width, 0);
                  return <col key={i} style={{ width: `${(w / total) * 100}%` }} />;
                })}
              </colgroup>
            ) : null}

            <tbody>
              {normalized.rows.map((row, rowIdx) => (
                <tr key={rowIdx}>
                  {row.map((cellHtml, colIdx) => {
                    const cellStyle = normalized.customStyles?.[rowIdx]?.[colIdx] ?? {};
                    const Tag = rowIdx === 0 ? "th" : "td";
                    return (
                      <Tag
                        key={colIdx}
                        style={cellStyle}
                        className="table-cell-content"
                        dangerouslySetInnerHTML={{ __html: cellHtml }}
                      />
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </div>

      <style>{`
        .table-html-wrapper table {
          width: 100%;
          border-collapse: collapse;
          min-width: 640px;
        }
        .table-html-wrapper th,
        .table-html-wrapper td {
          border: 1px solid #d1d5db;
          padding: 0.625rem 0.75rem;
          vertical-align: top;
          text-align: left;
        }
        .table-html-wrapper th {
          background-color: #f3f4f6;
          font-weight: 700;
          color: #111827;
        }
        .table-html-wrapper td {
          color: #1f2937;
        }
        .table-html-wrapper .table-cell-content p,
        .table-html-wrapper p {
          margin: 0;
          line-height: 1.5;
        }
        .table-html-wrapper .table-cell-content p + p {
          margin-top: 0.15rem;
        }
        .table-html-wrapper code {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 0.85em;
          color: #e11d48;
          background: #fff1f2;
          padding: 0.1em 0.35em;
          border-radius: 3px;
        }
        .dark .table-html-wrapper th,
        .dark .table-html-wrapper td {
          border-color: #374151;
        }
        .dark .table-html-wrapper th {
          background-color: #1f2937 !important;
          color: #f9fafb !important;
        }
        .dark .table-html-wrapper td {
          color: #e5e7eb;
        }
        /* Some payloads use first-row td (not th) as header cells with inline light backgrounds. */
        .dark .table-html-wrapper tr:first-child > td {
          background-color: #1f2937 !important;
          color: #f9fafb !important;
          font-weight: 700;
        }
        .dark .table-html-wrapper tr:first-child > td strong {
          color: inherit !important;
        }
        .dark .table-html-wrapper code {
          color: #fb7185;
          background: #4c0519;
        }
      `}</style>
    </div>
  );
}
