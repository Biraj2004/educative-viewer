"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  SandpackProvider,
  SandpackCodeEditor,
  SandpackPreview,
  SandpackConsole,
  getSandpackCssText,
  defaultDark,
  defaultLight,
} from "@codesandbox/sandpack-react";
import type { SandpackPredefinedTemplate } from "@codesandbox/sandpack-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SandpackFile {
  active: boolean;
  code: string;
  hidden: boolean;
  readOnly: boolean;
  visible: boolean;
  highlightedLines?: string;
  useInAIMentor?: boolean;
}

export interface SandpackData {
  comp_id: string;
  autoRun?: boolean;
  caption?: string;
  codeHeight?: number;
  files: Record<string, SandpackFile>;
  hideConsole?: boolean;
  hideEditor?: boolean;
  hideOutput?: boolean;
  hideStopBtn?: boolean;
  hideTests?: boolean;
  outputHeight?: number;
  primaryFile?: string;
  template?: string;
  version?: number;
}

// ─── Sandpack template normalisation ─────────────────────────────────────────

const TEMPLATE_MAP: Record<string, SandpackPredefinedTemplate> = {
  static:        "static",
  html:          "static",
  javascript:    "vanilla",
  js:            "vanilla",
  typescript:    "vanilla-ts",
  ts:            "vanilla-ts",
  react:         "react",
  "react-ts":    "react-ts",
  reactts:       "react-ts",
  vue:           "vue",
  vue2:          "vue",
  vue3:          "vue",
  angular:       "angular",
  svelte:        "svelte",
  solid:         "solid",
  node:          "node",
  nodejs:        "node",
  nextjs:        "nextjs",
  next:          "nextjs",
  vite:          "vite",
  "vite-react":  "vite-react",
};

function resolveSandpackTemplate(raw?: string): SandpackPredefinedTemplate {
  if (!raw) return "static";
  return TEMPLATE_MAP[raw.toLowerCase()] ?? "static";
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

function useDarkMode(): boolean {
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    const el = document.documentElement;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsDark(el.classList.contains("dark"));
    const obs = new MutationObserver(() =>
      setIsDark(el.classList.contains("dark"))
    );
    obs.observe(el, { attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return isDark;
}

function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);
  return mounted;
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function ResetIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  );
}

// ─── Sandpack CSS injection ───────────────────────────────────────────────────

function SandpackStyles() {
  const css = getSandpackCssText();
  return <style suppressHydrationWarning dangerouslySetInnerHTML={{ __html: css }} />;
}

// ─── Drag-to-resize splitter ─────────────────────────────────────────────────

const SPLITTER_W = 6;  // px — visible bar width
const MIN_PCT    = 10; // minimum panel width as % of container
const MAX_PCT    = 90;

// ─── Resizable editor + preview layout ───────────────────────────────────────

interface ResizableLayoutProps {
  showEditor: boolean;
  showPreview: boolean;
  showConsole: boolean;
  panelHeight: number;
  consoleHeight: number;
  isDark: boolean;
}

function ResizableLayout({
  showEditor, showPreview, showConsole, panelHeight, consoleHeight, isDark,
}: ResizableLayoutProps) {
  const DEFAULT_PCT   = 50;
  const needsSplitter = showEditor && showPreview;

  const [editorPct,  setEditorPct]  = useState(needsSplitter ? DEFAULT_PCT : showEditor ? 100 : 0);
  const [isDragging, setIsDragging] = useState(false);
  const [hovering,   setHovering]   = useState(false);

  // ── Stable refs: never recreated, so add/removeEventListener always match ──
  const draggingRef  = useRef(false);
  const parentRef    = useRef<HTMLElement | null>(null);

  // Keep onResize always pointing at the latest setter without recreating handlers
  const setEditorPctRef = useRef(setEditorPct);
  setEditorPctRef.current = setEditorPct;
  const setIsDraggingRef = useRef(setIsDragging);
  setIsDraggingRef.current = setIsDragging;

  const onMove = useRef((e: PointerEvent) => {
    if (!draggingRef.current || !parentRef.current) return;
    const rect = parentRef.current.getBoundingClientRect();
    const x    = e.clientX - rect.left;
    const pct  = Math.max(MIN_PCT, Math.min(MAX_PCT, (x / rect.width) * 100));
    setEditorPctRef.current(pct);
  });

  const onUp = useRef(() => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    setIsDraggingRef.current(false);
    document.body.style.cursor     = "";
    document.body.style.userSelect = "";
    document.removeEventListener("pointermove", onMove.current);
    document.removeEventListener("pointerup",   onUp.current);
  });

  // Cleanup on unmount (stable refs → empty dep array is correct)
  useEffect(() => () => {
    document.removeEventListener("pointermove", onMove.current);
    document.removeEventListener("pointerup",   onUp.current);
    document.body.style.cursor     = "";
    document.body.style.userSelect = "";
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSplitterPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    // Store the row element so onMove can read its width during the drag
    parentRef.current    = e.currentTarget.parentElement;
    draggingRef.current  = true;
    setIsDragging(true);
    document.body.style.cursor     = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("pointermove", onMove.current);
    document.addEventListener("pointerup",   onUp.current);
  };

  const splitterBg = isDark
    ? (isDragging || hovering) ? "#4f46e5" : "#374151"
    : (isDragging || hovering) ? "#6366f1" : "#e5e7eb";

  const previewPct = 100 - editorPct;

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {/* ── Editor + Preview row ── */}
      <div
        style={{ display: "flex", height: panelHeight, overflow: "hidden" }}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
      >
        {/* Editor panel */}
        {showEditor && (
          <div style={{ width: `${editorPct}%`, minWidth: 0, overflow: "hidden", flexShrink: 0 }}>
            <SandpackCodeEditor
              showLineNumbers
              showInlineErrors
              wrapContent={false}
              style={{ height: panelHeight }}
            />
          </div>
        )}

        {/* Splitter bar */}
        {needsSplitter && (
          <div
            onPointerDown={handleSplitterPointerDown}
            onDoubleClick={() => setEditorPct(DEFAULT_PCT)}
            title="Drag to resize · Double-click to reset 50/50"
            style={{
              width: SPLITTER_W,
              flexShrink: 0,
              cursor: "col-resize",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: splitterBg,
              transition: isDragging ? "none" : "background 0.15s",
              zIndex: 20,
            }}
          >
            {/* Grip dots */}
            <div style={{ display: "flex", flexDirection: "column", gap: 3, pointerEvents: "none" }}>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} style={{ width: 2, height: 2, borderRadius: "50%", background: isDark ? "#9ca3af" : "#6b7280" }} />
              ))}
            </div>
          </div>
        )}

        {/* Preview panel — overlay blocks iframe pointer capture during drag */}
        {showPreview && (
          <div
            style={{
              width: needsSplitter ? `${previewPct}%` : "100%",
              minWidth: 0,
              overflow: "hidden",
              position: "relative",
              flexShrink: 0,
            }}
          >
            <SandpackPreview
              showOpenInCodeSandbox={false}
              showRefreshButton
              showSandpackErrorOverlay
              style={{ height: panelHeight }}
            />
            {/* Transparent overlay: prevents the iframe from eating pointermove events */}
            {isDragging && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  zIndex: 50,
                  cursor: "col-resize",
                }}
              />
            )}
          </div>
        )}
      </div>

      {/* ── Console row (full width, below both panels) ── */}
      {showConsole && (
        <div style={{ borderTop: `1px solid ${isDark ? "#374151" : "#e5e7eb"}` }}>
          <SandpackConsole style={{ height: consoleHeight }} showHeader showSyntaxError />
        </div>
      )}
    </div>
  );
}

// ─── Unified sandpack view ────────────────────────────────────────────────────

function SandpackView({ data }: { data: SandpackData }) {
  const [resetKey, setResetKey] = useState(0);
  const isDark   = useDarkMode();
  const template = resolveSandpackTemplate(data.template);

  const files = useMemo(() => {
    const result: Record<string, { code: string; hidden?: boolean; active?: boolean; readOnly?: boolean }> = {};
    for (const [path, file] of Object.entries(data.files)) {
      result[path] = {
        code:     file.code,
        hidden:   file.hidden   || false,
        active:   file.active   || false,
        readOnly: file.readOnly || false,
      };
    }
    return result;
  }, [data.files]);

  const activeFile =
    data.primaryFile ??
    Object.entries(data.files).find(([, f]) => f.active)?.[0] ??
    undefined;

  const showEditor  = !data.hideEditor;
  const showPreview = !data.hideOutput;
  const showConsole = !data.hideConsole && template !== "static";
  const panelHeight   = Math.max(data.codeHeight ?? 0, data.outputHeight ?? 0, 350);
  const consoleHeight = 150;

  return (
    <>
      <SandpackStyles />
      <SandpackProvider
        key={resetKey}
        template={template}
        files={files}
        theme={isDark ? defaultDark : defaultLight}
        options={{
          autorun: data.autoRun ?? true,
          ...(activeFile ? { activeFile } : {}),
          externalResources: [],
        }}
      >
        <ResizableLayout
          showEditor={showEditor}
          showPreview={showPreview}
          showConsole={showConsole}
          panelHeight={panelHeight}
          consoleHeight={consoleHeight}
          isDark={isDark}
        />
      </SandpackProvider>

      {/* ── Toolbar ── */}
      <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-2 flex items-center gap-2 bg-gray-50 dark:bg-gray-800">
        <button
          onClick={() => setResetKey((k) => k + 1)}
          title="Reset all files to original"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors cursor-pointer"
        >
          <ResetIcon />
          Reset
        </button>
        {data.caption && (
          <span className="ml-auto text-xs text-gray-400 dark:text-gray-500 italic">
            {data.caption}
          </span>
        )}
      </div>
    </>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export default function Sandpack({ data }: { data: SandpackData }) {
  const mounted = useMounted();
  if (data.hideOutput && data.hideEditor) return null;

  const panelHeight    = Math.max(data.codeHeight ?? 0, data.outputHeight ?? 0, 350);
  const showConsole    = !data.hideConsole && data.template && data.template !== "static";
  const skeletonHeight = panelHeight + (showConsole ? 150 : 0) + 42;

  if (!mounted) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-4">
        <div
          className="rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden bg-white dark:bg-gray-900"
          style={{ height: skeletonHeight }}
        />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-4">
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden bg-white dark:bg-gray-900">
        <SandpackView data={data} />
      </div>
    </div>
  );
}
