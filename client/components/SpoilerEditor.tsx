"use client";

import { useState } from "react";
import "katex/dist/katex.min.css";
import { resolveEduUrl } from "@/utils/constants";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SpoilerEditorData {
  comp_id: string;
  hideHintText: string;
  isCopied: boolean;
  mdHtml: string;
  showHintText: string;
  showIcon: boolean;
  text: string;
  version: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fixImageSrcs(html: string): string {
  return html.replace(/src="([^"]+)"/g, (_, p) => `src="${resolveEduUrl(p)}"`);
}

// ─── Lightbulb Icon ───────────────────────────────────────────────────────────

function LightbulbIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M9 21h6v-1H9v1zm3-20C8.686 1 6 3.686 6 7c0 2.296 1.278 4.296 3.164 5.373L9 14h6l-.164-1.627C16.722 11.296 18 9.296 18 7c0-3.314-2.686-6-6-6zm2.5 12h-5l.164-1.627A5.001 5.001 0 0 1 7 7c0-2.757 2.243-5 5-5s5 2.243 5 5a5.001 5.001 0 0 1-2.664 4.373L14.5 13z" />
    </svg>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SpoilerEditor({ data }: { data: SpoilerEditorData }) {
  const [open, setOpen] = useState(false);

  const processedHtml = fixImageSrcs(data.mdHtml);

  if (!open) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-2 flex justify-center">
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded border border-gray-200 bg-white text-gray-700 text-sm font-medium shadow-sm hover:bg-gray-50 transition-colors"
        >
          {data.showIcon && (
            <LightbulbIcon className="w-4 h-4 text-amber-400" />
          )}
          {data.showHintText}
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-2">
      <div className="relative rounded border border-amber-100 bg-amber-50 p-6">
        {/* Header row */}
        <div className="flex items-start justify-between mb-4">
          {data.showIcon && (
            <LightbulbIcon className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
          )}
          <button
            onClick={() => setOpen(false)}
            aria-label={data.hideHintText}
            className="ml-auto text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div
          className="spoiler-content text-gray-800 text-[15px] leading-relaxed"
          dangerouslySetInnerHTML={{ __html: processedHtml }}
        />
      </div>

      {/* Style scoped to spoiler content */}
      <style>{`
        .spoiler-content p { margin-bottom: 0.75rem; }
        .spoiler-content p:last-child { margin-bottom: 0; }
        .spoiler-content img { max-width: 100%; height: auto; margin: 1rem auto; display: block; border: 1px solid #e5e7eb; border-radius: 4px; }
        .spoiler-content em { font-style: italic; }
        .spoiler-content p[style*="text-align:center"] { text-align: center; }
      `}</style>
    </div>
  );
}
