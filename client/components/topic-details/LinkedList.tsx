import { prepareSvg } from "@/utils/svg-helpers";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LinkedListNode {
  id: string;
  content?: string;
  fillcolor?: string;
  strokecolor?: string;
  textcolor?: string;
  x?: string;
  y?: string;
}

export interface LinkedListData {
  comp_id: string;
  caption?: string;
  nodes?: LinkedListNode[];
  svg_string?: string;
  version?: string;
}

// ─── Fallback: horizontal linked list renderer ───────────────────────────────

function LinkedListFallback({ nodes = [] }: { nodes: LinkedListNode[] }) {
  if (nodes.length === 0) {
    return <div className="text-gray-400 italic text-sm py-4">Empty list</div>;
  }

  return (
    <div className="flex items-center gap-4 py-4 overflow-x-auto">
      {nodes.map((node, i) => (
        <div key={node.id} className="flex items-center gap-4">
          <div
            className="px-4 py-2 rounded-md border-2 font-mono text-center min-w-12"
            style={{
              backgroundColor: node.fillcolor ?? "#bfefff",
              borderColor: node.strokecolor ?? "#FF0000",
              color: node.textcolor ?? "white",
            }}
          >
            {node.content}
          </div>
          {i < nodes.length - 1 && (
            <div className="flex items-center text-gray-400 dark:text-gray-500">
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <line x1="0" y1="12" x2="20" y2="12" />
                <polyline points="14 6 20 12 14 18" />
              </svg>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function LinkedList({ data }: { data: LinkedListData }) {
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
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center italic">{data.caption}</p>
          )}
        </div>
      </div>
    );
  }

  // Fallback: list of nodes
  if (!data.nodes || data.nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-20 text-sm text-gray-400 italic">
        No linked list data.
      </div>
    );
  }

  return (
    <div className="max-w-full mx-auto px-6 py-4 overflow-x-auto">
      <div className="flex justify-center">
        <LinkedListFallback nodes={data.nodes} />
      </div>
      {data.caption && (
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center mt-4 italic">{data.caption}</p>
      )}
    </div>
  );
}
