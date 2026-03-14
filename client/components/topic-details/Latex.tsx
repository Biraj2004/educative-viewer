"use client";

import "katex/dist/katex.min.css";

export interface LatexComponentData {
  comp_id: string;
  isEquationValid: boolean;
  mdhtml: string;
  text: string;
  version: string;
}

export default function Latex({ data }: { data: LatexComponentData }) {
  if (!data.isEquationValid) {
    return (
      <div className="text-red-500 text-sm px-6 py-2">
        Invalid equation: <code>{data.text}</code>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-2">
      <div
        className="flex justify-center text-gray-700 dark:text-gray-200"
        dangerouslySetInnerHTML={{ __html: data.mdhtml }}
      />
    </div>
  );
}
