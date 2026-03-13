import { prepareSvg } from "@/utils/svg-helpers";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GraphvizData {
  comp_id: string;
  caption?: string;
  svg_string?: string;
  text?: string;
  version?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Graphviz({ data }: { data: GraphvizData }) {
  // Primary: inline SVG
  if (data.svg_string) {
    return (
      <div className="max-w-full mx-auto px-6 py-4">
        <div className="flex flex-col items-center gap-3">
          <div
            className="overflow-x-auto max-w-full dark:brightness-90 dark:invert dark:hue-rotate-180"
            dangerouslySetInnerHTML={{ __html: prepareSvg(data.svg_string) }}
          />
          {data.caption && (
            <div className="flex justify-center w-full">
              <span className="text-sm font-medium text-gray-700 bg-gray-50 px-3 py-1 rounded-md mt-2 shadow-sm border border-gray-100 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300">
                {data.caption}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Fallback: raw DOT text
  if (data.text) {
    return (
      <div className="w-full mx-auto px-6 py-4 overflow-x-auto">
        <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-4 font-mono text-sm text-gray-700 dark:text-gray-300">
          <pre>{data.text}</pre>
        </div>
        {data.caption && (
          <div className="flex justify-center w-full mt-4">
            <span className="text-sm font-medium text-gray-700 bg-gray-50 px-3 py-1 rounded-md shadow-sm border border-gray-100 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300">
              {data.caption}
            </span>
          </div>
        )}
      </div>
    );
  }

  // No content
  return (
    <div className="flex items-center justify-center h-20 text-sm text-gray-400 italic bg-gray-50 dark:bg-gray-900/50 rounded-lg">
      No graphviz data.
    </div>
  );
}
