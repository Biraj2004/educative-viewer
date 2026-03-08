"use client";
import { useMemo } from "react";

export interface MarkdownEditorData {
  comp_id?: string;
  mdHtml: string;
  text: string;
  version: string;
}

function processHtml(html: string): string {
  return html.replace(
    /<keyword><word>([\s\S]*?)<\/word><meaning>([\s\S]*?)<\/meaning><\/keyword>/g,
    (_match, word, meaning) =>
      `<span class="relative inline-block group cursor-help">` +
      `<span class="bg-yellow-100 text-yellow-900 font-medium px-0.5 rounded border-b border-yellow-400">${word}</span>` +
      `<span class="absolute bottom-full left-0 z-10 hidden group-hover:block bg-gray-900 text-white text-xs rounded p-2 w-52 shadow-lg leading-relaxed">${meaning}</span>` +
      `</span>`
  );
}

export default function MarkdownEditor({ data }: { data: MarkdownEditorData }) {
  const processedHtml = useMemo(() => processHtml(data.mdHtml), [data.mdHtml]);

  return (
    <div className="max-w-6xl mx-auto px-6 py-2">
      <div
        className="
          prose max-w-none text-gray-900 dark:text-gray-200
          [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:text-gray-900 [&_h1]:mt-6 [&_h1]:mb-3
          dark:[&_h1]:text-gray-100
          [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-gray-900 [&_h2]:mt-5 [&_h2]:mb-2
          dark:[&_h2]:text-gray-100
          [&_h3]:text-lg [&_h3]:font-bold [&_h3]:text-gray-900 [&_h3]:mt-4 [&_h3]:mb-2
          dark:[&_h3]:text-gray-100
          [&_h4]:text-base [&_h4]:font-semibold [&_h4]:text-gray-900 [&_h4]:mt-3 [&_h4]:mb-1
          dark:[&_h4]:text-gray-100
          [&_p]:text-[15px] [&_p]:text-gray-900 [&_p]:leading-[1.8] [&_p]:mb-4
          dark:[&_p]:text-gray-300
          [&_p>em]:italic [&_p>em]:text-gray-800
          dark:[&_p>em]:text-gray-400
          [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-4 [&_ul>li]:text-gray-900 [&_ul>li]:mb-1
          dark:[&_ul>li]:text-gray-300
          [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:mb-4 [&_ol>li]:text-gray-900 [&_ol>li]:mb-1
          dark:[&_ol>li]:text-gray-300
          [&_blockquote]:border-l-4 [&_blockquote]:border-gray-300 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-gray-700 [&_blockquote]:my-4
          dark:[&_blockquote]:border-gray-600 dark:[&_blockquote]:text-gray-400
          [&_hr]:border-t [&_hr]:border-gray-300 [&_hr]:my-6
          dark:[&_hr]:border-gray-700
          [&_table]:border-collapse [&_table]:w-auto [&_table]:my-6 [&_table]:text-[14px] [&_table]:text-gray-900
          dark:[&_table]:text-gray-200
          [&_thead]:bg-gray-50
          dark:[&_thead]:bg-gray-800
          [&_th]:border [&_th]:border-gray-300 [&_th]:px-4 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold [&_th]:text-gray-900
          dark:[&_th]:border-gray-700 dark:[&_th]:text-gray-100
          [&_td]:border [&_td]:border-gray-300 [&_td]:px-4 [&_td]:py-2 [&_td]:text-gray-900
          dark:[&_td]:border-gray-700 dark:[&_td]:text-gray-300
          [&_code]:bg-gray-100 [&_code]:text-gray-900 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[13px] [&_code]:font-mono
          dark:[&_code]:bg-gray-800 dark:[&_code]:text-gray-200
          [&_pre]:bg-[#0f172a] [&_pre]:text-gray-100 [&_pre]:rounded [&_pre]:p-4 [&_pre]:overflow-x-auto [&_pre]:my-4
          dark:[&_pre]:bg-[#0d1117]
          [&_pre_code]:bg-transparent [&_pre_code]:text-gray-100 [&_pre_code]:p-0 [&_pre_code]:rounded-none
          dark:[&_pre_code]:bg-transparent dark:[&_pre_code]:text-gray-100
          [&_a]:text-blue-600 [&_a]:underline [&_a:hover]:text-blue-800
          dark:[&_a]:text-blue-400 dark:[&_a:hover]:text-blue-300
        "
        dangerouslySetInnerHTML={{ __html: processedHtml }}
      />
    </div>
  );
}
