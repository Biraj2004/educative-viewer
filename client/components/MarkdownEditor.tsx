"use client";

export interface MarkdownEditorData {
  comp_id?: string;
  mdHtml: string;
  text: string;
  version: string;
}

export default function MarkdownEditor({ data }: { data: MarkdownEditorData }) {
  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div
        className="
          prose prose-gray max-w-none
          [&>hr]:border-t [&>hr]:border-gray-300 [&>hr]:my-6
          [&>p]:text-[15px] [&>p]:text-gray-600 [&>p]:leading-[1.8] [&>p]:mb-4
          [&>p>em]:italic [&>p>em]:text-gray-700
        "
        dangerouslySetInnerHTML={{ __html: data.mdHtml }}
      />
    </div>
  );
}
