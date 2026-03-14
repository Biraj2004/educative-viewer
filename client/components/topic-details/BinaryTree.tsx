import { prepareSvg } from "@/utils/svg-helpers";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BinaryTreeNode {
  id: string;
  content?: string;
  fillcolor?: string;
  shape?: string;
  left_child?: BinaryTreeNode | null;
  right_child?: BinaryTreeNode | null;
}

export interface BinaryTreeData {
  comp_id: string;
  caption?: string;
  svg_string?: string;
  root?: BinaryTreeNode;
  draw_effect?: boolean;
}

// ─── Fallback: recursive binary tree renderer ────────────────────────────────

function TreeNode({ node, depth = 0 }: { node: BinaryTreeNode; depth?: number }) {
  if (!node) return null;

  const hasLeft = !!node.left_child;
  const hasRight = !!node.right_child;
  const hasChildren = hasLeft || hasRight;
  const label = node.content?.trim() || node.id;

  return (
    <div className="flex flex-col items-center">
      {/* Node box */}
      <div
        className="px-4 py-2 rounded-md border-2 font-mono text-center min-w-16 shadow-sm"
        style={{
          backgroundColor: node.fillcolor ?? "#e13a55",
          borderColor: "#222",
          color: "white",
        }}
      >
        {label}
      </div>

      {hasChildren && (
        <>
          {/* Vertical connector down from parent */}
          <div className="w-px h-6 bg-gray-400 dark:bg-gray-500" />

          {/* Horizontal bar spanning children */}
          {(hasLeft && hasRight) && (
            <div className="relative flex items-start w-full">
              <div
                className="absolute top-0 left-[25%] right-[25%] h-px bg-gray-400 dark:bg-gray-500"
              />
            </div>
          )}

          {/* Children row */}
          <div className="flex items-start gap-8 mt-0">
            {/* Left Child Container */}
            <div className="flex flex-col items-center flex-1 min-w-20">
              {hasLeft && (
                <>
                  {(!hasRight) && <div className="absolute top-0 h-px bg-gray-400 dark:bg-gray-500 w-1/2 right-0" />}
                  <div className="w-px h-6 bg-gray-400 dark:bg-gray-500" />
                  <TreeNode node={node.left_child!} depth={depth + 1} />
                </>
              )}
            </div>

            {/* Right Child Container */}
            <div className="flex flex-col items-center flex-1 min-w-20">
              {hasRight && (
                <>
                  {(!hasLeft) && <div className="absolute top-0 h-px bg-gray-400 dark:bg-gray-500 w-1/2 left-0" />}
                  <div className="w-px h-6 bg-gray-400 dark:bg-gray-500" />
                  <TreeNode node={node.right_child!} depth={depth + 1} />
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function BinaryTree({ data }: { data: BinaryTreeData }) {
  // Primary: inline SVG
  if (data.svg_string) {
    return (
      <div className="max-w-full mx-auto px-6 py-6">
        <div className="flex flex-col items-center gap-3">
          <div
            className="overflow-x-auto max-w-full dark:brightness-90 dark:invert dark:hue-rotate-180"
            dangerouslySetInnerHTML={{ __html: prepareSvg(data.svg_string) }}
          />
          {data.caption && (
            <div className="flex justify-center w-full mt-2">
              <span className="text-sm font-medium text-gray-700 bg-gray-50 px-3 py-1.5 rounded-md shadow-sm border border-gray-100 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300">
                {data.caption}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Fallback: recursive binary tree render
  if (!data.root) {
    return (
      <div className="flex items-center justify-center h-20 text-sm text-gray-400 italic bg-gray-50 dark:bg-gray-900/50 rounded-lg">
        No binary tree data.
      </div>
    );
  }

  return (
    <div className="max-w-full mx-auto px-6 py-8 overflow-x-auto">
      <div className="flex justify-center">
        <TreeNode node={data.root} />
      </div>
      {data.caption && (
        <div className="flex justify-center w-full mt-8">
          <span className="text-sm font-medium text-gray-700 bg-gray-50 px-3 py-1.5 rounded-md shadow-sm border border-gray-100 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300">
            {data.caption}
          </span>
        </div>
      )}
    </div>
  );
}
