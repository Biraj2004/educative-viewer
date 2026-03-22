import React from "react";

export interface TableHTMLData {
  html?: string;
  content?: {
    html?: string;
  };
}

function getHtml(data: TableHTMLData): string {
  if (typeof data?.html === "string") return data.html;
  if (typeof data?.content?.html === "string") return data.content.html;
  return "";
}

export default function TableHTML({ data }: { data: TableHTMLData }) {
  const html = getHtml(data);

  if (!html) {
    return (
      <div className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
        No table data available.
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-2">
      <div
        className="table-html-wrapper overflow-x-auto"
        // Source content comes from trusted backend payloads.
        dangerouslySetInnerHTML={{ __html: html }}
      />

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
        .table-html-wrapper code {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 0.85em;
          color: #e11d48;
          background: #fff1f2;
          padding: 0.1em 0.35em;
          border-radius: 3px;
        }
        .table-html-wrapper p {
          margin: 0;
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
