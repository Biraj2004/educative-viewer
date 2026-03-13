import { prepareSvg } from "@/utils/svg-helpers";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NaryTreeNode {
  id: string;
  content?: string;
  fillcolor?: string;
  strokecolor?: string;
  textcolor?: string;
  shape?: string;
  children?: NaryTreeNode[];
}

export interface NaryTreeData {
  comp_id: string;
  caption?: string;
  root?: NaryTreeNode;
  svg_string?: string;
  version?: string;
}

// ─── Fallback: recursive tree renderer ───────────────────────────────────────

function TreeNode({ node, depth = 0 }: { node: NaryTreeNode; depth?: number }) {
  const children = node.children ?? [];
  const label = node.content?.trim() || node.id;

  return (
    <div className="flex flex-col items-center">
      {/* Node box */}
      <div
        className="px-3 py-1.5 rounded border text-sm font-mono text-center min-w-10"
        style={{
          backgroundColor: node.fillcolor ?? "#bfefff",
          borderColor: node.strokecolor ?? "#999",
          color: node.textcolor ?? "#000",
        }}
      >
        {label}
      </div>

      {children.length > 0 && (
        <>
          {/* Vertical connector down from parent */}
          <div className="w-px h-4 bg-gray-400 dark:bg-gray-500" />
          {/* Horizontal bar spanning children */}
          {children.length > 1 && (
            <div className="relative flex items-start">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-px bg-gray-400 dark:bg-gray-500" style={{ width: `calc(100% - 1.5rem)`, left: "0.75rem" }} />
            </div>
          )}
          {/* Children row */}
          <div className="flex items-start gap-3 mt-0">
            {children.map((child) => (
              <div key={child.id} className="flex flex-col items-center">
                {/* Vertical connector up to horizontal bar */}
                <div className="w-px h-4 bg-gray-400 dark:bg-gray-500" />
                <TreeNode node={child} depth={depth + 1} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function NaryTree({ data }: { data: NaryTreeData }) {
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

  // Fallback: recursive tree render
  if (!data.root) {
    return (
      <div className="flex items-center justify-center h-20 text-sm text-gray-400 italic">
        No tree data.
      </div>
    );
  }

  return (
    <div className="max-w-full mx-auto px-6 py-6 overflow-x-auto">
      <div className="flex justify-center">
        <TreeNode node={data.root} />
      </div>
      {data.caption && (
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center mt-4 italic">{data.caption}</p>
      )}
    </div>
  );
}
