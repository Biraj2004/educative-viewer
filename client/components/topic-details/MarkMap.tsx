"use client";

import { useMemo } from "react";

export interface MarkMapData {
  caption?: string;
  comp_id: string;
  height?: number;
  text?: string;
  version?: string;
  width?: number;
}

interface TreeNode {
  label: string;
  href?: string;
  children: TreeNode[];
}

interface PositionedNode extends TreeNode {
  id: string;
  x: number;
  y: number;
  depth: number;
  branchColor: string;
  children: PositionedNode[];
}

interface PositionedLink {
  from: PositionedNode;
  to: PositionedNode;
  color: string;
}

interface MarkMapLayout {
  nodes: PositionedNode[];
  links: PositionedLink[];
  width: number;
  height: number;
}

const BRANCH_COLORS = [
  "#f97316",
  "#8b5cf6",
  "#22c55e",
  "#0ea5e9",
  "#eab308",
  "#ec4899",
  "#14b8a6",
  "#ef4444",
];

const ROOT_COLOR = "#3b82f6";
const H_GAP = 240;
const V_GAP = 56;
const PAD_X = 56;
const PAD_Y = 36;

function getFontSize(depth: number): number {
  if (depth === 0) return 18;
  if (depth === 1) return 16;
  return 15;
}

function estimateLabelWidth(label: string, depth: number): number {
  const fontSize = getFontSize(depth);
  return Math.max(24, Math.round(label.length * fontSize * 0.62));
}

function parseLink(raw: string): { label: string; href?: string } {
  const m = raw.match(/^\[(.+?)\]\((https?:\/\/[^\s)]+)\)$/);
  if (!m) return { label: raw.trim() };
  return { label: m[1].trim(), href: m[2].trim() };
}

function parseMarkdownTree(markdown: string): TreeNode[] {
  const root: TreeNode = { label: "root", children: [] };
  const headingStack: TreeNode[] = [root];
  let currentHeading: TreeNode = root;
  let bulletStack: TreeNode[] = [root];

  const lines = markdown.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const heading = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      const level = heading[1].length;
      const node: TreeNode = {
        label: heading[2].trim(),
        children: [],
      };
      while (headingStack.length > level) headingStack.pop();
      const parent = headingStack[headingStack.length - 1] ?? root;
      parent.children.push(node);
      headingStack.push(node);
      currentHeading = node;
      bulletStack = [currentHeading];
      continue;
    }

    const bullet = line.match(/^(\s*)[-*+]\s+(.+)$/);
    if (bullet) {
      const indent = bullet[1].length;
      const level = Math.floor(indent / 2);
      while (bulletStack.length > level + 1) bulletStack.pop();
      const parent = bulletStack[level] ?? currentHeading;
      const parsed = parseLink(bullet[2].trim());
      const node: TreeNode = {
        label: parsed.label,
        href: parsed.href,
        children: [],
      };
      parent.children.push(node);
      bulletStack[level + 1] = node;
      continue;
    }

    const parsed = parseLink(trimmed);
    currentHeading.children.push({
      label: parsed.label,
      href: parsed.href,
      children: [],
    });
  }

  return root.children;
}

function normalizeRoot(tree: TreeNode[], caption?: string): TreeNode | null {
  if (tree.length === 0) return null;
  if (tree.length === 1) return tree[0];
  return {
    label: caption?.trim() || "Course Structure",
    children: tree,
  };
}

function buildLayout(root: TreeNode, minWidth = 900, minHeight = 420): MarkMapLayout {
  let nextLeafIndex = 0;
  let idSeq = 0;

  function placeNode(
    node: TreeNode,
    depth: number,
    branchColor: string
  ): PositionedNode {
    const childColorSeed = depth === 0 ? BRANCH_COLORS : [branchColor];
    const positionedChildren = node.children.map((child, index) =>
      placeNode(
        child,
        depth + 1,
        childColorSeed[index % childColorSeed.length]
      )
    );

    let y: number;
    if (positionedChildren.length === 0) {
      y = nextLeafIndex * V_GAP;
      nextLeafIndex += 1;
    } else {
      const totalY = positionedChildren.reduce((sum, child) => sum + child.y, 0);
      y = totalY / positionedChildren.length;
    }

    return {
      ...node,
      id: `markmap-node-${idSeq++}`,
      x: depth * H_GAP,
      y,
      depth,
      branchColor: depth === 0 ? ROOT_COLOR : branchColor,
      children: positionedChildren,
    };
  }

  const positionedRoot = placeNode(root, 0, ROOT_COLOR);
  const nodes: PositionedNode[] = [];
  const links: PositionedLink[] = [];

  function collect(node: PositionedNode): void {
    nodes.push(node);
    for (const child of node.children) {
      links.push({ from: node, to: child, color: child.branchColor });
      collect(child);
    }
  }
  collect(positionedRoot);

  const minY = nodes.reduce(
    (acc, node) => Math.min(acc, node.y),
    Number.POSITIVE_INFINITY
  );
  const maxY = nodes.reduce((acc, node) => Math.max(acc, node.y), 0);

  const minTextX = nodes.reduce((acc, node) => {
    if (node.depth === 0) {
      return Math.min(acc, node.x - 12 - estimateLabelWidth(node.label, node.depth));
    }
    return Math.min(acc, node.x - 8);
  }, Number.POSITIVE_INFINITY);

  const maxTextX = nodes.reduce((acc, node) => {
    if (node.depth === 0) return Math.max(acc, node.x + 8);
    return Math.max(acc, node.x + 12 + estimateLabelWidth(node.label, node.depth));
  }, 0);

  const width = Math.max(minWidth, maxTextX - minTextX + PAD_X * 2);
  const rawHeight = maxY - minY + PAD_Y * 2 + 24;
  const height = Math.max(minHeight, rawHeight);

  const xOffset = PAD_X - minTextX;
  const yOffset = PAD_Y - minY + (height - rawHeight) / 2;
  const normalizedNodes = nodes.map((node) => ({
    ...node,
    y: node.y + yOffset,
    x: node.x + xOffset,
  }));

  const nodeMap = new Map(normalizedNodes.map((node) => [node.id, node]));
  const normalizedLinks = links
    .map((link) => {
      const from = nodeMap.get(link.from.id);
      const to = nodeMap.get(link.to.id);
      if (!from || !to) return null;
      return { from, to, color: link.color };
    })
    .filter((link): link is PositionedLink => Boolean(link));

  return {
    nodes: normalizedNodes,
    links: normalizedLinks,
    width,
    height,
  };
}

function curvePath(from: PositionedNode, to: PositionedNode): string {
  const c1 = from.x + 84;
  const c2 = to.x - 84;
  return `M ${from.x} ${from.y} C ${c1} ${from.y}, ${c2} ${to.y}, ${to.x} ${to.y}`;
}

export default function MarkMap({ data }: { data: MarkMapData }) {
  const markdown = data.text?.trim() ?? "";

  const layout = useMemo(() => {
    if (!markdown) return null;
    let tree: TreeNode[];
    try {
      // Try parsing as JSON first
      const parsed = JSON.parse(markdown);
      tree = Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      // Fallback to markdown parsing
      tree = parseMarkdownTree(markdown);
    }
    const root = normalizeRoot(tree, data.caption);
    if (!root) return null;
    return buildLayout(root, data.width ?? 900, data.height ?? 420);
  }, [markdown, data.caption, data.width, data.height]);

  if (!markdown) {
    return (
      <div className="flex items-center justify-center h-20 text-sm text-gray-400 italic bg-gray-50 dark:bg-gray-900/50 rounded-lg">
        No markmap data.
      </div>
    );
  }

  if (!layout) {
    return (
      <div className="px-6 py-4 text-sm text-amber-600 dark:text-amber-400">
        MarkMap fallback: unable to parse markdown tree.
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-4">
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden flex justify-center">
        <svg
          style={{ maxWidth: `${layout.width}px` }}
          width="100%"
          height="auto"
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          preserveAspectRatio="xMidYMid meet"
          className="block"
          role="img"
          aria-label="MarkMap diagram"
        >
            {layout.links.map((link, index) => (
              <path
                key={`${link.from.id}-${link.to.id}-${index}`}
                d={curvePath(link.from, link.to)}
                fill="none"
                stroke={link.color}
                strokeWidth={2.2}
                strokeLinecap="round"
                opacity={0.95}
              />
            ))}

            {layout.nodes.map((node) => {
              const isRoot = node.depth === 0;
              const textX = isRoot ? node.x - 12 : node.x + 12;
              const textAnchor: "start" | "end" = isRoot ? "end" : "start";
              const textStyle = {
                fill: "currentColor",
                fontSize: getFontSize(node.depth),
                fontWeight: node.depth <= 1 ? 500 : 400,
                fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif",
                dominantBaseline: "middle" as const,
              };

              return (
                <g key={node.id} className="text-gray-800 dark:text-gray-100">
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={6}
                    fill="white"
                    stroke={node.branchColor}
                    strokeWidth={3}
                  />

                  {node.href ? (
                    <a href={node.href} target="_blank" rel="noopener noreferrer">
                      <text
                        x={textX}
                        y={node.y}
                        textAnchor={textAnchor}
                        style={{ ...textStyle, textDecoration: "underline", fill: "#0ea5e9" }}
                      >
                        {node.label}
                      </text>
                    </a>
                  ) : (
                    <text x={textX} y={node.y} textAnchor={textAnchor} style={textStyle}>
                      {node.label}
                    </text>
                  )}
                </g>
              );
            })}
        </svg>
      </div>

      {data.caption && (
        <div className="flex justify-center w-full mt-3">
          <span className="text-sm font-medium text-gray-700 bg-gray-50 px-3 py-1 rounded-md shadow-sm border border-gray-100 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300">
            {data.caption}
          </span>
        </div>
      )}
    </div>
  );
}
