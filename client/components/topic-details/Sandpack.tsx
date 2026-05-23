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
  static: "static",
  html: "static",
  javascript: "vanilla",
  js: "vanilla",
  typescript: "vanilla-ts",
  ts: "vanilla-ts",
  react: "react",
  "react-ts": "react-ts",
  reactts: "react-ts",
  vue: "vue",
  vue2: "vue",
  vue3: "vue",
  angular: "angular",
  svelte: "svelte",
  solid: "solid",
  node: "node",
  nodejs: "node",
  nextjs: "nextjs",
  next: "nextjs",
  vite: "vite",
  "vite-react": "vite-react",
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

type FileMap = Record<string, { code: string; hidden?: boolean; active?: boolean; readOnly?: boolean }>;

function isLocalhostOrPrivate(hostname: string): boolean {
  if (hostname === "localhost" || hostname === "127.0.0.1") return true;
  if (hostname.startsWith("192.168.")) return true;
  if (hostname.startsWith("10.")) return true;
  if (hostname.match(/^172\.(1[6-9]|2[0-9]|3[0-1])\./)) return true;
  // If it's anything else (e.g. a public domain), return false
  return false;
}

async function resolveLocalMediaToDataUris(files: FileMap): Promise<FileMap> {
  console.log("[Sandpack] resolveLocalMediaToDataUris — scanning", Object.keys(files).length, "files");

  // Match any domain for /api/... URLs (e.g. localhost, LAN IPs, or tunnels).
  // IMPORTANT: use [^"'<>] not [^\s"'<>] — filenames can contain spaces
  // (e.g. "Scene1 (.webm") and \s would truncate the URL before the space.
  const URL_RE = /https?:\/\/[^\/]+\/api\/[^"'<>]+/gi;
  const MIME: Record<string, string> = {
    webm: "video/webm", mp4: "video/mp4", ogv: "video/ogg",
    mp3: "audio/mpeg", wav: "audio/wav", ogg: "audio/ogg",
    png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
    gif: "image/gif", webp: "image/webp", svg: "image/svg+xml",
  };

  const urls = new Set<string>();
  for (const { code } of Object.values(files)) {
    for (const m of code.matchAll(new RegExp(URL_RE.source, "gi"))) urls.add(m[0]);
  }
  if (urls.size === 0) return files;

  const replacements = new Map<string, string>();
  await Promise.all(Array.from(urls).map(async (url) => {
    try {
      const fetchUrl = encodeURI(url.trim());
      
      // If the domain is correctly configured as a public domain, Sandpack iframe
      // will NOT be blocked by Chrome PNA rules. Thus, we should skip base64 
      // conversion entirely so that devices like iPads can stream the video normally.
      const parsedUrl = new URL(fetchUrl);
      if (!isLocalhostOrPrivate(parsedUrl.hostname)) return;

      const res = await fetch(fetchUrl);
      if (!res.ok) return;
      const buf = await res.arrayBuffer();
      if (buf.byteLength > 15 * 1024 * 1024) return; // skip files > 15 MB
      
      const ext = fetchUrl.split("?")[0].split(".").pop()?.toLowerCase() ?? "";
      const mime = res.headers.get("Content-Type")?.split(";")[0].trim() || MIME[ext] || "application/octet-stream";
      
      const bytes = new Uint8Array(buf);
      let b64 = "";
      for (let i = 0; i < bytes.length; i++) b64 += String.fromCharCode(bytes[i]);
      
      replacements.set(url.trim(), `data:${mime};base64,${btoa(b64)}`);
    } catch { /* silently keep original URL */ }
  }));

  if (replacements.size === 0) return files;

  const out: FileMap = {};
  for (const [p, f] of Object.entries(files)) {
    let code = f.code;
    for (const [orig, dataUri] of replacements) code = code.split(orig).join(dataUri);
    out[p] = { ...f, code };
  }
  return out;
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
const MIN_PCT = 10; // minimum panel width as % of container
const MAX_PCT = 90;

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
  const DEFAULT_PCT = 50;
  const needsSplitter = showEditor && showPreview;

  const [editorPct, setEditorPct] = useState(needsSplitter ? DEFAULT_PCT : showEditor ? 100 : 0);
  const [isDragging, setIsDragging] = useState(false);
  const [hovering, setHovering] = useState(false);

  // ── Stable refs: never recreated, so add/removeEventListener always match ──
  const draggingRef = useRef(false);
  const parentRef = useRef<HTMLElement | null>(null);

  // Keep onResize always pointing at the latest setter without recreating handlers
  const setEditorPctRef = useRef(setEditorPct);
  setEditorPctRef.current = setEditorPct;
  const setIsDraggingRef = useRef(setIsDragging);
  setIsDraggingRef.current = setIsDragging;

  const onMove = useRef((e: PointerEvent) => {
    if (!draggingRef.current || !parentRef.current) return;
    const rect = parentRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = Math.max(MIN_PCT, Math.min(MAX_PCT, (x / rect.width) * 100));
    setEditorPctRef.current(pct);
  });

  const onUp = useRef(() => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    setIsDraggingRef.current(false);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    document.removeEventListener("pointermove", onMove.current);
    document.removeEventListener("pointerup", onUp.current);
  });

  // Cleanup on unmount (stable refs → empty dep array is correct)
  useEffect(() => () => {
    document.removeEventListener("pointermove", onMove.current);
    document.removeEventListener("pointerup", onUp.current);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSplitterPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    // Store the row element so onMove can read its width during the drag
    parentRef.current = e.currentTarget.parentElement;
    draggingRef.current = true;
    setIsDragging(true);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("pointermove", onMove.current);
    document.addEventListener("pointerup", onUp.current);
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
  const [isFullscreen, setIsFullscreen] = useState(false);
  const isDark = useDarkMode();
  const template = resolveSandpackTemplate(data.template);

  useEffect(() => {
    if (!isFullscreen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setIsFullscreen(false); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isFullscreen]);

  // Build raw file map
  const rawFiles = useMemo<FileMap>(() => {
    const result: FileMap = {};
    for (const [path, file] of Object.entries(data.files)) {
      result[path] = {
        code: file.code,
        hidden: file.hidden || false,
        active: file.active || false,
        readOnly: file.readOnly || false,
      };
    }
    return result;
  }, [data.files]);

  // Replace local media URLs with data URIs so the Sandpack iframe never makes
  // cross-origin requests (which Chrome PNA would block).
  // Initialize as null — we MUST NOT mount SandpackProvider until resolution is
  // complete, because SandpackProvider ignores `files` prop changes after mount
  // (it stores files in internal state initialized once from props).
  const [files, setFiles] = useState<FileMap | null>(null);
  useEffect(() => {
    let cancelled = false;
    setFiles(null); // reset on rawFiles change
    resolveLocalMediaToDataUris(rawFiles).then((resolved) => {
      if (!cancelled) setFiles(resolved);
    });
    return () => { cancelled = true; };
  }, [rawFiles]);

  const activeFile =
    data.primaryFile ??
    Object.entries(data.files).find(([, f]) => f.active)?.[0] ??
    undefined;

  const showEditor = !data.hideEditor;
  const showPreview = !data.hideOutput;
  const showConsole = !data.hideConsole && template !== "static";
  const panelHeight = isFullscreen
    ? Math.max(window.innerHeight - 42 - (showConsole ? 150 + 1 : 0) - 42, 400) // 42px toolbar + 42px our header
    : Math.max(data.codeHeight ?? 0, data.outputHeight ?? 0, 350);
  const consoleHeight = 150;

  // Show skeleton while media is being fetched and encoded
  if (!files) {
    return (
      <div style={{
        height: panelHeight, display: "flex", alignItems: "center", justifyContent: "center",
        background: isDark ? "#1e1e2e" : "#f9fafb", color: isDark ? "#6b7280" : "#9ca3af", fontSize: 14
      }}>
        Loading…
      </div>
    );
  }

  return (
    <div className={isFullscreen
      ? "fixed inset-0 z-[200] flex flex-col bg-white dark:bg-gray-900"
      : "rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden bg-white dark:bg-gray-900"
    }>
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
        <div className={isFullscreen ? "flex-1 overflow-hidden" : ""}>
          <ResizableLayout
            showEditor={showEditor}
            showPreview={showPreview}
            showConsole={showConsole}
            panelHeight={panelHeight}
            consoleHeight={consoleHeight}
            isDark={isDark}
          />
        </div>
      </SandpackProvider>

      {/* ── Toolbar ── */}
      <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-2 flex items-center gap-2 bg-gray-50 dark:bg-gray-800 shrink-0">
        <button
          onClick={() => setResetKey((k) => k + 1)}
          title="Reset all files to original"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors cursor-pointer"
        >
          <ResetIcon />
          Reset
        </button>
        {/* Fullscreen toggle */}
        <button
          onClick={() => setIsFullscreen(f => !f)}
          title={isFullscreen ? "Exit fullscreen" : "Expand fullscreen"}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors cursor-pointer ml-1"
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
          {isFullscreen ? "Exit" : "Expand"}
        </button>
        {data.caption && (
          <span className="ml-auto text-xs text-gray-400 dark:text-gray-500 italic">
            {data.caption}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export default function Sandpack({ data }: { data: SandpackData }) {
  const mounted = useMounted();
  if (data.hideOutput && data.hideEditor) return null;

  const panelHeight = Math.max(data.codeHeight ?? 0, data.outputHeight ?? 0, 350);
  const showConsole = !data.hideConsole && data.template && data.template !== "static";
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
    // NOTE: SandpackView manages its own isFullscreen state internally.
    // When fullscreen, it applies fixed inset-0 to its OWN wrapper via the inner div,
    // which correctly escapes parent overflow containers without remounting.
    <div className="max-w-6xl mx-auto px-4 py-4">
      <SandpackView data={data} />
    </div>
  );
}
