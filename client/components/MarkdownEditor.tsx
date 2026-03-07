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
          prose max-w-none text-gray-900
          [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:text-gray-900 [&_h1]:mt-6 [&_h1]:mb-3
          [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-gray-900 [&_h2]:mt-5 [&_h2]:mb-2
          [&_h3]:text-lg [&_h3]:font-bold [&_h3]:text-gray-900 [&_h3]:mt-4 [&_h3]:mb-2
          [&_h4]:text-base [&_h4]:font-semibold [&_h4]:text-gray-900 [&_h4]:mt-3 [&_h4]:mb-1
          [&_p]:text-[15px] [&_p]:text-gray-900 [&_p]:leading-[1.8] [&_p]:mb-4
          [&_p>em]:italic [&_p>em]:text-gray-800
          [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-4 [&_ul>li]:text-gray-900 [&_ul>li]:mb-1
          [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:mb-4 [&_ol>li]:text-gray-900 [&_ol>li]:mb-1
          [&_blockquote]:border-l-4 [&_blockquote]:border-gray-300 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-gray-700 [&_blockquote]:my-4
          [&_hr]:border-t [&_hr]:border-gray-300 [&_hr]:my-6
          [&_table]:border-collapse [&_table]:w-auto [&_table]:my-6 [&_table]:text-[14px] [&_table]:text-gray-900
          [&_thead]:bg-gray-50
          [&_th]:border [&_th]:border-gray-300 [&_th]:px-4 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold [&_th]:text-gray-900
          [&_td]:border [&_td]:border-gray-300 [&_td]:px-4 [&_td]:py-2 [&_td]:text-gray-900
          [&_code]:bg-gray-100 [&_code]:text-gray-900 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[13px] [&_code]:font-mono
          [&_pre]:bg-gray-900 [&_pre]:text-gray-100 [&_pre]:rounded [&_pre]:p-4 [&_pre]:overflow-x-auto [&_pre]:my-4
          [&_a]:text-blue-600 [&_a]:underline [&_a:hover]:text-blue-800
        "
        dangerouslySetInnerHTML={{ __html: processedHtml }}
      />
    </div>
  );
}
