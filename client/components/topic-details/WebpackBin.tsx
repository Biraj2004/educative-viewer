"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Editor, { Monaco } from "@monaco-editor/react";
import type { editor as MonacoEditor } from "monaco-editor";
import JSZip from "jszip";

// ─── Types ────────────────────────────────────────────────────────────────────

interface FileData {
  content: string;
  hidden: boolean;
  /** Comma-separated highlighted line ranges, e.g. "3-5,8,12-14" — can be null */
  highlightedLines: string | null;
  language: string;
  staticFile: boolean;
}

/**
 * A node in the file tree. Folder nodes have `leaf: false` and `children`,
 * but NO `data` field. File nodes have `leaf: true` and `data`, but no `children`.
 */
interface TreeNode {
  id: number;
  leaf: boolean;
  module: string;
  parentId: number;
  /** Present on folder nodes */
  children?: TreeNode[];
  collapsed?: boolean;
  /** Present on file (leaf) nodes */
  data?: FileData;
  readOnly?: boolean;
}

interface JudgeConfig {
  evaluationContent?: string;
  exerciseTabsVisible?: boolean;
  hintsContent?: string[];
  judgeActive?: boolean;
  judgeDisabled?: boolean;
  showSolution?: boolean;
  solutionContent?: string;
  version?: string;
}

interface CodeContents {
  canAddNpmPackages?: boolean;
  children: TreeNode[];
  foldersState?: Record<string, boolean>;
  id: number;
  judge?: JudgeConfig;
  maxId?: number;
  module: string;
  selectedId: number;
}

interface LoaderConfig {
  config: Record<string, boolean>;
  enabled: boolean;
  title: string;
}

interface DockerJob {
  android?: boolean;
  buildScript?: string;
  forceRelaunchOnCompChange?: boolean;
  forceRelaunchOnRun?: boolean;
  https?: boolean;
  inputFileName?: string;
  jobType?: string;
  key?: string;
  name?: string;
  ports?: string;
  runInLiveContainer?: boolean;
  runScript?: string;
  startScript?: string;
}

export interface WebpackBinData {
  androidBuildPath?: string;
  androidPackageName?: string;
  appUrl?: string;
  caption?: string;
  codeContents: CodeContents | string | Record<string, unknown>;
  codePanelHeight?: string | number;
  comp_id?: string;
  dockerJob?: DockerJob;
  hideCodeView?: boolean;
  hideOutputUrl?: boolean;
  hideResultOutput?: boolean;
  isCopied?: boolean;
  loaders?: Record<string, LoaderConfig>;
  npmPackages?: Record<string, string>;
  outputHeight?: string | number;
  outputLayout?: string;
  selectedApiKeys?: Record<string, string>;
  selectedEnvVars?: Record<string, string>;
  showConsole?: boolean;
  showLineNumbers?: boolean;
  theme?: string;
  version?: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeFileData(raw: unknown): FileData | undefined {
  if (!isRecord(raw)) return undefined;

  const content = typeof raw.content === "string" ? raw.content : "";
  const hidden = typeof raw.hidden === "boolean" ? raw.hidden : false;
  const highlightedLines =
    typeof raw.highlightedLines === "string" || raw.highlightedLines === null
      ? (raw.highlightedLines as string | null)
      : null;
  const language = typeof raw.language === "string" ? raw.language : "plaintext";
  const staticFile = typeof raw.staticFile === "boolean" ? raw.staticFile : false;

  return { content, hidden, highlightedLines, language, staticFile };
}

function normalizeTreeNode(raw: unknown, fallbackId: number): TreeNode | null {
  if (!isRecord(raw)) return null;

  const id = typeof raw.id === "number" ? raw.id : fallbackId;
  const moduleName =
    typeof raw.module === "string"
      ? raw.module
      : typeof raw.fileName === "string"
        ? raw.fileName
        : `file-${id}`;
  const parentId = typeof raw.parentId === "number" ? raw.parentId : 0;

  const explicitLeaf = raw.leaf === true;
  const rawChildren = Array.isArray(raw.children) ? raw.children : [];
  const normalizedChildren = rawChildren
    .map((child, idx) => normalizeTreeNode(child, id * 1000 + idx + 1))
    .filter((node): node is TreeNode => node !== null);

  // Support payloads where file fields are directly on node instead of node.data
  const dataCandidate = normalizeFileData(raw.data) ?? normalizeFileData(raw);
  const isLeaf = explicitLeaf || (!!dataCandidate && normalizedChildren.length === 0);

  const base: TreeNode = {
    id,
    leaf: isLeaf,
    module: moduleName,
    parentId,
  };

  if (normalizedChildren.length > 0) {
    base.children = normalizedChildren;
  }
  if (dataCandidate && isLeaf) {
    base.data = dataCandidate;
  }
  if (typeof raw.readOnly === "boolean") {
    base.readOnly = raw.readOnly;
  }

  return base;
}

function normalizeCodeContents(raw: unknown): CodeContents {
  const fallback: CodeContents = {
    children: [],
    id: 0,
    module: "/",
    selectedId: 0,
  };

  const parsed =
    typeof raw === "string"
      ? (() => {
          try {
            return JSON.parse(raw) as unknown;
          } catch {
            return null;
          }
        })()
      : raw;

  if (!isRecord(parsed)) return fallback;

  const rawChildren =
    Array.isArray(parsed.children)
      ? parsed.children
      : isRecord(parsed.children)
        ? Object.values(parsed.children)
        : [];

  const children = rawChildren
    .map((node, idx) => normalizeTreeNode(node, idx + 1))
    .filter((node): node is TreeNode => node !== null);

  const selectedId =
    typeof parsed.selectedId === "number"
      ? parsed.selectedId
      : children.find((n) => n.leaf)?.id ?? 0;

  return {
    canAddNpmPackages: typeof parsed.canAddNpmPackages === "boolean" ? parsed.canAddNpmPackages : undefined,
    children,
    foldersState: isRecord(parsed.foldersState) ? (parsed.foldersState as Record<string, boolean>) : undefined,
    id: typeof parsed.id === "number" ? parsed.id : 0,
    judge: isRecord(parsed.judge) ? (parsed.judge as JudgeConfig) : undefined,
    maxId: typeof parsed.maxId === "number" ? parsed.maxId : undefined,
    module: typeof parsed.module === "string" ? parsed.module : "/",
    selectedId,
  };
}

/** Parse "3-5,8,12-14" → array of 1-based line numbers for Monaco decorations. */
function parseHighlightedLines(raw: string | null | undefined): number[] {
  if (!raw?.trim()) return [];
  const lines: number[] = [];
  for (const part of raw.split(",")) {
    const trimmed = part.trim();
    const range = trimmed.split("-").map(Number);
    if (range.length === 2 && !isNaN(range[0]) && !isNaN(range[1])) {
      for (let l = range[0]; l <= range[1]; l++) lines.push(l);
    } else {
      const n = Number(trimmed);
      if (!isNaN(n) && n > 0) lines.push(n);
    }
  }
  return lines;
}

/** Resolve Monaco language id from file extension, falling back to stored language. */
function resolveMonacoLang(filename: string, storedLang?: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const EXT_MAP: Record<string, string> = {
    java: "java",
    jsp: "html",
    xml: "xml",
    json: "json",
    html: "html",
    htm: "html",
    css: "css",
    scss: "scss",
    js: "javascript",
    ts: "typescript",
    tsx: "typescript",
    jsx: "javascript",
    py: "python",
    go: "go",
    rs: "rust",
    cpp: "cpp",
    c: "c",
    cs: "csharp",
    rb: "ruby",
    kt: "kotlin",
    swift: "swift",
    sh: "shell",
    bash: "shell",
    sql: "sql",
    yaml: "yaml",
    yml: "yaml",
    properties: "ini",
    env: "ini",
    cfg: "ini",
    gradle: "groovy",
    md: "markdown",
    dart: "dart",
  };
  return EXT_MAP[ext] ?? (storedLang?.toLowerCase() || "plaintext");
}

/** Recursively collect all visible leaf (file) nodes from a tree. */
function collectLeaves(nodes: TreeNode[]): TreeNode[] {
  const result: TreeNode[] = [];
  for (const node of nodes) {
    if (node.leaf && node.data && !node.data.hidden) {
      result.push(node);
    } else if (!node.leaf && node.children?.length) {
      result.push(...collectLeaves(node.children));
    }
  }
  return result;
}

/** Build an id → node map for the entire tree. */
function buildNodeMap(nodes: TreeNode[], map = new Map<number, TreeNode>()): Map<number, TreeNode> {
  for (const n of nodes) {
    map.set(n.id, n);
    if (n.children) buildNodeMap(n.children, map);
  }
  return map;
}

/** Build the relative path for a leaf node by walking up via parentId. */
function nodePath(node: TreeNode, nodeMap: Map<number, TreeNode>): string {
  const parts: string[] = [node.module];
  let cur = node;
  while (cur.parentId !== 0) {
    const parent = nodeMap.get(cur.parentId);
    if (!parent) break;
    if (parent.module && parent.module !== "/") parts.unshift(parent.module);
    cur = parent;
  }
  return parts.join("/");
}

/** Collect initial expanded state: all folders start expanded. */
function initExpanded(nodes: TreeNode[]): Record<number, boolean> {
  const result: Record<number, boolean> = {};
  for (const n of nodes) {
    if (!n.leaf) {
      result[n.id] = true; // start expanded
      if (n.children) Object.assign(result, initExpanded(n.children));
    }
  }
  return result;
}

// ─── Sidebar file icons ───────────────────────────────────────────────────────

function SidebarFileIcon({ filename }: { filename: string }) {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";

  if (ext === "java") {
    return (
      <svg className="w-4 h-4 shrink-0" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
        <path d="M6.1 11.6s-.6.4.5.5c1.3.2 2 .2 3.5-.1 0 0 .4.2.1.4-1.4.6-3.6.1-2.7-.4 0 0-.7.4.4.4C9 12.4 11 12 11 12s.3.2.1.4c-1.8.9-6.1.5-4.9-0.8z" fill="#f89820" />
        <path d="M5.6 10.2s-.7.5.4.6c1.4.1 2.5.2 4.4-.2 0 0 .3.2.1.4-1.8.7-5.6.5-4.4-.4 0 0-.7.5.3.6 1 0 1.8.1 3.4-.1z" fill="#f89820" />
        <path d="M8 6.9c.8.9-.2 1.7-.2 1.7s2-1 1-2.2C7.9 5.3 7.1 4.7 9.4 3 9.4 3 6.8 3.5 8 6.9z" fill="#f89820" />
        <path d="M10.7 12.6s.5.4-.5.7c-1.9.5-7.9.7-9.6 0-1.3-.4.6-.9 1-.9.2 0 .3.1.3.1-.4-.2-2.5.5-1.1.8 4.1 1.1 10.4.5 9.9-.7z" fill="#f89820" />
        <path d="M6.3 8.4s-2.2.5-.8.7c.6.1 1.9.1 3-.1.9-.1 1.9-.4 1.9-.4s-.3.2-.5.2c-2.1.6-7.3.3-6.2-.5 1-.8 2.6-.3 2.6.1z" fill="#f89820" />
        <path d="M9.8 10.7c2.7-1.4 1.5-2.7.6-2.5-.2 0-.3.1-.3.1s.1-.1.2-.2c1.6-.7 2.8 1.7-.6 2.7 0 0 .1-.1.1-.1z" fill="#f89820" />
        <path d="M7.2 1s1.8 1.8-1.7 4.6C2.9 7.6 5.1 8.6 5 9.8c0 0-1.2-.6-.9-1.7.3-.9 1.5-1.4.9-2.8C4.4 3.9 3.6 3 7.2 1z" fill="#f89820" />
      </svg>
    );
  }

  if (ext === "sql") {
    return (
      <svg className="w-4 h-4 shrink-0" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
        <rect x="1" y="1" width="14" height="14" rx="2" fill="#c0392b" />
        <text x="2.5" y="11" fontSize="6.5" fontWeight="bold" fill="white" fontFamily="monospace">SQL</text>
      </svg>
    );
  }

  if (ext === "properties" || ext === "env" || ext === "cfg" || ext === "ini") {
    return (
      <svg className="w-4 h-4 shrink-0 text-gray-400" viewBox="0 0 16 16" fill="none">
        <path d="M3 4h10M3 8h10M3 12h6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    );
  }

  if (ext === "xml" || ext === "html" || ext === "htm" || ext === "jsp") {
    return (
      <svg className="w-4 h-4 shrink-0" viewBox="0 0 16 16" fill="none">
        <path d="M4.5 5L2 8l2.5 3" stroke="#e44d26" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M11.5 5L14 8l-2.5 3" stroke="#e44d26" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M9.5 4l-3 8" stroke="#f16529" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    );
  }

  if (ext === "json") {
    return (
      <svg className="w-4 h-4 shrink-0" viewBox="0 0 16 16" fill="none">
        <path d="M4.5 4C3.5 4 3 4.5 3 5.5v1c0 1-.5 1.5-1 1.5.5 0 1 .5 1 1.5v1C3 11.5 3.5 12 4.5 12" stroke="#cbcb41" strokeWidth="1.3" strokeLinecap="round" />
        <path d="M11.5 4c1 0 1.5.5 1.5 1.5v1c0 1 .5 1.5 1 1.5-.5 0-1 .5-1 1.5v1c0 1-.5 1.5-1.5 1.5" stroke="#cbcb41" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    );
  }

  if (ext === "css" || ext === "scss") {
    return (
      <svg className="w-4 h-4 shrink-0" viewBox="0 0 16 16" fill="none">
        <rect x="1.5" y="1.5" width="13" height="13" rx="2" fill="#264de4" />
        <path d="M4 6.5h8M4.5 9.5h6" stroke="white" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    );
  }

  if (ext === "js" || ext === "jsx") {
    return (
      <svg className="w-4 h-4 shrink-0" viewBox="0 0 16 16" fill="none">
        <rect x="1" y="1" width="14" height="14" rx="2" fill="#f7df1e" />
        <path d="M8.5 5.5v5c0 1-.5 1.5-1 1.5S7 11.5 7 11" stroke="#333" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M11 5.5v5c0 1-.3 1.5-.8 1.5" stroke="#333" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    );
  }

  if (ext === "ts" || ext === "tsx") {
    return (
      <svg className="w-4 h-4 shrink-0" viewBox="0 0 16 16" fill="none">
        <rect x="1" y="1" width="14" height="14" rx="2" fill="#3178c6" />
        <path d="M4 6h8M8 6v5.5" stroke="white" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    );
  }

  if (ext === "py") {
    return (
      <svg className="w-4 h-4 shrink-0" viewBox="0 0 16 16" fill="none">
        <path d="M7.5 1.5C5 1.5 3.5 2.5 3.5 4v1.5h4V6H3c-1.5 0-1.5 1-1.5 2.5S2 11 3.5 11h.5V9.5C4 8 5 7.5 6 7.5h4c1 0 2-.8 2-1.5V4c0-1.5-1.5-2.5-4.5-2.5z" fill="#3572a5" />
        <path d="M8.5 14.5c2.5 0 4-1 4-2.5V10.5H8.5V10H14c1.5 0 1.5-1 1.5-2.5S15 5 13.5 5H13v1.5C13 8 12 8.5 11 8.5H7c-1 0-2 .8-2 1.5V12c0 1.5 1.5 2.5 3.5 2.5z" fill="#ffd43b" />
      </svg>
    );
  }

  // Generic file
  return (
    <svg className="w-4 h-4 shrink-0 text-gray-500" viewBox="0 0 16 16" fill="none">
      <path d="M4 2h6l3 3v9a1 1 0 01-1 1H4a1 1 0 01-1-1V3a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.1" />
      <path d="M10 2v3h3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Sidebar tree item ────────────────────────────────────────────────────────

interface TreeItemProps {
  node: TreeNode;
  depth: number;
  allLeaves: TreeNode[];
  activeLeafId: number | undefined;
  onSelectLeaf: (idx: number) => void;
  onDownloadLeaf: (node: TreeNode) => void;
  expanded: Record<number, boolean>;
  onToggle: (id: number) => void;
}

function TreeItem({ node, depth, allLeaves, activeLeafId, onSelectLeaf, onDownloadLeaf, expanded, onToggle }: TreeItemProps) {
  const indent = 8 + depth * 12;

  if (!node.leaf) {
    const isOpen = expanded[node.id] ?? true;
    return (
      <div>
        <div
          role="button"
          tabIndex={0}
          onClick={() => onToggle(node.id)}
          onKeyDown={(e) => e.key === "Enter" && onToggle(node.id)}
          className="flex items-center gap-1.5 py-1.5 text-[12px] text-gray-400 hover:text-gray-200 cursor-pointer select-none transition-colors"
          style={{ paddingLeft: `${indent}px`, paddingRight: "8px" }}
        >
          <svg
            className={`w-3 h-3 shrink-0 transition-transform duration-150 ${isOpen ? "rotate-90" : ""}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          <svg className="w-3.5 h-3.5 shrink-0 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
            <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
          </svg>
          <span className="truncate">{node.module}</span>
        </div>
        {isOpen && node.children?.map((child) => (
          <TreeItem
            key={child.id}
            node={child}
            depth={depth + 1}
            allLeaves={allLeaves}
            activeLeafId={activeLeafId}
            onSelectLeaf={onSelectLeaf}
            onDownloadLeaf={onDownloadLeaf}
            expanded={expanded}
            onToggle={onToggle}
          />
        ))}
      </div>
    );
  }

  // Leaf (file)
  const leafIdx = allLeaves.findIndex((l) => l.id === node.id);
  const isActive = node.id === activeLeafId;
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => leafIdx >= 0 && onSelectLeaf(leafIdx)}
      onKeyDown={(e) => e.key === "Enter" && leafIdx >= 0 && onSelectLeaf(leafIdx)}
      className={`group flex items-center gap-2 py-2 text-[13px] cursor-pointer select-none transition-colors ${
        isActive ? "text-white font-semibold" : "text-gray-400 hover:text-gray-200"
      }`}
      style={{
        paddingLeft: `${indent}px`,
        paddingRight: "8px",
        background: isActive ? "#2a2a3d" : undefined,
      }}
    >
      <SidebarFileIcon filename={node.module} />
      <span className="flex-1 truncate leading-tight" title={node.module}>{node.module}</span>
      <button
        onClick={(e) => { e.stopPropagation(); onDownloadLeaf(node); }}
        title={`Download ${node.module}`}
        className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-500 hover:text-white shrink-0 cursor-pointer"
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
      </button>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function WebpackBin({ data }: { data: WebpackBinData }) {
  const codeContents = normalizeCodeContents(data.codeContents);

  // Flatten tree into a stable ordered array of visible leaf nodes
  const allLeaves = collectLeaves(codeContents.children);
  const nodeMap = buildNodeMap(codeContents.children);

  const defaultIdx = Math.max(
    0,
    allLeaves.findIndex((f) => f.id === codeContents.selectedId)
  );

  const [activeIdx, setActiveIdx] = useState(defaultIdx);
  const [copied, setCopied] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [wordWrap, setWordWrap] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Record<number, boolean>>(
    () => initExpanded(codeContents.children)
  );
  const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);

  const activeFile = allLeaves[activeIdx];
  const judge = codeContents.judge;
  const docker = data.dockerJob;
  const activeLoaders = Object.values(data.loaders ?? {}).filter((l) => l.enabled);

  const toggleFolder = useCallback((id: number) => {
    setExpandedFolders((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  // Re-apply highlighted-line decorations whenever the active file changes
  useEffect(() => {
    const ed = editorRef.current;
    const monaco = monacoRef.current;
    if (!ed || !monaco || !activeFile?.data) return;
    const lines = parseHighlightedLines(activeFile.data.highlightedLines);
    const decorations = lines.map((ln) => ({
      range: new monaco.Range(ln, 1, ln, 1),
      options: { isWholeLine: true, className: "highlightLine" },
    }));
    ed.createDecorationsCollection(decorations);
  }, [activeIdx, activeFile]);

  // Sync word wrap with editor
  useEffect(() => {
    editorRef.current?.updateOptions({ wordWrap: wordWrap ? "on" : "off" });
  }, [wordWrap]);

  // Escape to exit fullscreen
  useEffect(() => {
    if (!isFullscreen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setIsFullscreen(false); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isFullscreen]);

  const handleCopy = () => {
    navigator.clipboard.writeText(activeFile?.data?.content ?? "").then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleDownloadFile = (file: TreeNode) => {
    if (!file.data) return;
    const blob = new Blob([file.data.content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.module;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadAll = async () => {
    const zip = new JSZip();
    for (const file of allLeaves) {
      if (!file.data) continue;
      const path = nodePath(file, nodeMap);
      zip.file(path, file.data.content);
    }
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${data.caption || data.comp_id || "code"}.zip`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!activeFile) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-6 text-sm text-gray-400 italic">
        No files to display.
      </div>
    );
  }

  const BODY_HEIGHT = Number(data.codePanelHeight ?? data.outputHeight ?? 500);
  const isReadOnly = !!(activeFile.readOnly || activeFile.data?.staticFile);

  return (
    <div className="max-w-5xl mx-auto px-6 py-2">
      {data.caption && (
        <p className="text-[11px] text-gray-500 italic mb-2">{data.caption}</p>
      )}

      <div
        className={
          isFullscreen
            ? "fixed inset-0 z-50 flex flex-col"
            : "rounded-xl overflow-hidden shadow-xl border border-[#3a3a4a]"
        }
        style={{ background: "#1c1c28" }}
      >

        {/* ══════════════════════════════════════════
            TOP BAR — "Files" | filename | icons
            ══════════════════════════════════════════ */}
        <div
          className="flex items-stretch shrink-0 border-b border-[#3a3a4a]"
          style={{ background: "#1c1c28" }}
        >
          {/* "Files" section label */}
          <div className="w-48 shrink-0 flex items-center px-4 py-2.5 border-r border-[#3a3a4a]">
            <span className="text-xs font-semibold text-gray-300 tracking-wide">Files</span>
          </div>

          {/* Active filename + toolbar */}
          <div className="flex flex-1 items-center justify-between px-4 py-2">
            <div className="flex items-center gap-2 text-sm text-gray-200 font-medium min-w-0">
              <svg className="w-4 h-4 text-blue-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
              <span className="truncate">{activeFile.module}</span>
              {isReadOnly && (
                <span className="text-[10px] text-gray-500 border border-gray-600 rounded px-1 py-px leading-none shrink-0">
                  read-only
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 shrink-0 ml-3">
              {/* Word wrap toggle */}
              <button
                onClick={() => setWordWrap((w) => !w)}
                title={wordWrap ? "Disable word wrap" : "Enable word wrap"}
                className={`text-[11px] font-mono font-semibold px-1.5 py-0.5 rounded border transition-colors select-none cursor-pointer ${
                  wordWrap
                    ? "text-blue-300 border-blue-600 bg-blue-900/30"
                    : "text-gray-500 border-gray-700 hover:text-gray-200 hover:border-gray-500"
                }`}
              >
                Wrap
              </button>

              {/* Info panel toggle */}
              <button
                onClick={() => setShowInfo((p) => !p)}
                title="Component info"
                className={`transition-colors cursor-pointer ${showInfo ? "text-blue-400" : "text-gray-500 hover:text-gray-200"}`}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <circle cx="12" cy="12" r="10" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 16v-4m0-4h.01" />
                </svg>
              </button>

              {/* Reset content */}
              <button
                title="Reset to original"
                className="text-gray-500 hover:text-gray-200 transition-colors cursor-pointer"
                onClick={() => {
                  editorRef.current?.setValue(activeFile.data?.content ?? "");
                  editorRef.current?.revealLine(1);
                }}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>

              {/* Fullscreen */}
              <button
                onClick={() => setIsFullscreen((f) => !f)}
                title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
                className="text-gray-500 hover:text-gray-200 transition-colors cursor-pointer"
              >
                {isFullscreen ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 3v4a1 1 0 01-1 1H3m18 0h-4a1 1 0 01-1-1V3m0 18v-4a1 1 0 011-1h4M3 16h4a1 1 0 011 1v4" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4h4M16 4h4v4M4 16v4h4M20 16v4h-4" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════
            INFO PANEL (collapsible)
            ══════════════════════════════════ */}
        {showInfo && (
          <div
            className="flex flex-wrap gap-6 px-5 py-3 border-b border-[#3a3a4a] text-xs text-gray-400 shrink-0"
            style={{ background: "#16161f" }}
          >
            {docker && (
              <div className="space-y-0.5">
                <div className="text-gray-200 font-semibold mb-1">{docker.name}</div>
                <div>Job type: <span className="text-blue-300">{docker.jobType}</span></div>
                {docker.ports && <div>Port: <span className="text-gray-300">{docker.ports}</span></div>}
                {data.appUrl && !data.hideOutputUrl && (
                  <div>App URL: <span className="font-mono text-gray-300">{data.appUrl}</span></div>
                )}
                {docker.https && <div className="text-green-400">HTTPS enabled</div>}
                {docker.startScript && (
                  <details className="mt-1">
                    <summary className="cursor-pointer text-gray-500 hover:text-gray-300">Start script</summary>
                    <pre className="mt-1 text-green-400 font-mono whitespace-pre-wrap text-[10px]">
                      {docker.startScript}
                    </pre>
                  </details>
                )}
              </div>
            )}

            {activeLoaders.length > 0 && (
              <div>
                <div className="text-gray-200 font-semibold mb-1">Loaders</div>
                <div className="flex flex-wrap gap-1">
                  {activeLoaders.map((l) => (
                    <span key={l.title} className="px-1.5 py-0.5 rounded bg-blue-900/40 text-blue-300 border border-blue-800">
                      {l.title}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {data.npmPackages && Object.keys(data.npmPackages).length > 0 && (
              <div>
                <div className="text-gray-200 font-semibold mb-1">npm packages</div>
                {Object.entries(data.npmPackages).map(([pkg, ver]) => (
                  <div key={pkg} className="font-mono">
                    {pkg} <span className="text-gray-500">@{ver}</span>
                  </div>
                ))}
              </div>
            )}

            {data.selectedEnvVars && Object.keys(data.selectedEnvVars).length > 0 && (
              <div>
                <div className="text-gray-200 font-semibold mb-1">Env vars</div>
                {Object.keys(data.selectedEnvVars).map((k) => (
                  <div key={k} className="font-mono text-green-300">{k}</div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════
            BODY — sidebar tree + editor
            ══════════════════════════════════════════ */}
        <div
          className={`flex ${isFullscreen ? "flex-1 overflow-hidden" : ""}`}
          style={!isFullscreen ? { height: BODY_HEIGHT } : undefined}
        >

          {/* ── Left sidebar (file tree) ── */}
          {!data.hideCodeView && (
            <div
              className="w-48 shrink-0 border-r border-[#3a3a4a] overflow-y-auto"
              style={{ background: "#1c1c28", height: "100%" }}
            >
              {codeContents.children.map((node) => (
                <TreeItem
                  key={node.id}
                  node={node}
                  depth={0}
                  allLeaves={allLeaves}
                  activeLeafId={activeFile.id}
                  onSelectLeaf={setActiveIdx}
                  onDownloadLeaf={handleDownloadFile}
                  expanded={expandedFolders}
                  onToggle={toggleFolder}
                />
              ))}
            </div>
          )}

          {/* ── Monaco Editor ── */}
          <div
            className={`flex-1 ${isFullscreen ? "overflow-hidden" : ""}`}
            style={{ minWidth: 0, height: "100%" }}
          >
            <Editor
              height="100%"
              language={resolveMonacoLang(activeFile.module, activeFile.data?.language)}
              value={activeFile.data?.content ?? ""}
              theme="vs-dark"
              onMount={(editor, monaco) => {
                editorRef.current = editor;
                monacoRef.current = monaco;
                if (activeFile.data) {
                  const lines = parseHighlightedLines(activeFile.data.highlightedLines);
                  if (lines.length > 0) {
                    editor.createDecorationsCollection(
                      lines.map((ln) => ({
                        range: new monaco.Range(ln, 1, ln, 1),
                        options: { isWholeLine: true, className: "highlightLine" },
                      }))
                    );
                  }
                }
              }}
              options={{
                readOnly: isReadOnly,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                fontSize: 13,
                lineNumbers: data.showLineNumbers !== false ? "on" : "off",
                wordWrap: wordWrap ? "on" : "off",
                folding: true,
                renderLineHighlight: "line",
                scrollbar: { verticalScrollbarSize: 6, horizontalScrollbarSize: 6 },
                glyphMargin: false,
                overviewRulerLanes: 0,
              }}
            />
          </div>
        </div>

        {/* ══════════════════════════════════════════
            JUDGE / EXERCISE panel
            ══════════════════════════════════════════ */}
        {judge?.judgeActive && !judge.judgeDisabled && (
          <div
            className="border-t border-[#3a3a4a] px-4 py-3 text-xs text-gray-300 space-y-2 shrink-0"
            style={{ background: "#16161f" }}
          >
            <div className="flex items-center gap-2 font-semibold text-yellow-400">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              Exercise
            </div>
            {judge.hintsContent && judge.hintsContent.length > 0 && (
              <div>
                <button
                  onClick={() => setShowHint((p) => !p)}
                  className="text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {showHint ? "Hide hints" : "Show hints"}
                </button>
                {showHint && (
                  <ul className="mt-2 list-disc list-inside space-y-1 text-gray-400 pl-1">
                    {judge.hintsContent.map((h, i) => (
                      <li key={i}>{h}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════
            BOTTOM BAR — copy | download-all zip | "Saved"
            ══════════════════════════════════════════════════ */}
        <div
          className="flex items-center justify-between px-4 py-2.5 border-t border-[#3a3a4a] shrink-0"
          style={{ background: "#1c1c28" }}
        >
          <div className="flex items-center gap-3">
            {/* Copy active file */}
            <button
              onClick={handleCopy}
              title="Copy active file"
              className="text-gray-500 hover:text-gray-200 transition-colors cursor-pointer"
            >
              {copied ? (
                <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-4 10h6a2 2 0 002-2v-8a2 2 0 00-2-2h-6a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              )}
            </button>

            {/* Download all files as zip */}
            <button
              onClick={handleDownloadAll}
              title="Download all files as ZIP"
              className="text-gray-500 hover:text-gray-200 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </button>

            {/* "Saved" cloud status */}
            <div className="flex items-center gap-1 text-xs text-gray-500 select-none">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
              </svg>
              Saved
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}

