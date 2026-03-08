"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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

// ─── Dark mode hook ─────────────────────────────────────────────────────────

function useDarkMode(): boolean {
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    const el = document.documentElement;
    setIsDark(el.classList.contains("dark"));
    const obs = new MutationObserver(() =>
      setIsDark(el.classList.contains("dark"))
    );
    obs.observe(el, { attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return isDark;
}

// ─── Static template helpers (srcdoc + postMessage) ──────────────────────────

function buildLookup(files: Record<string, SandpackFile>): Record<string, string> {
  const map: Record<string, string> = {};
  for (const [path, file] of Object.entries(files)) {
    const stripped = path.replace(/^\//, "");
    map[stripped] = file.code;
    map[stripped.split("/").pop() ?? stripped] = file.code;
  }
  return map;
}

function buildSrcDoc(files: Record<string, SandpackFile>): string {
  // Prefer a root-level html file over /public/index.html
  const htmlEntry =
    Object.entries(files).find(([p]) => /^\/[^/]+\.html$/.test(p)) ??
    Object.entries(files).find(([p]) => p.endsWith(".html"));
  if (!htmlEntry) return "<html><body><p>No HTML entry found.</p></body></html>";

  let html = htmlEntry[1].code;
  const lookup = buildLookup(files);

  // Inline local CSS
  html = html.replace(
    /<link([^>]*?)href=["']([^"']+)["']([^>]*?)>/gi,
    (match, _a, href) => {
      if (/^https?:|^\/\//.test(href)) return match;
      const key = href.replace(/^\//, "");
      const css = lookup[key] ?? lookup[key.split("/").pop() ?? ""];
      return css != null ? `<style>${css}</style>` : match;
    }
  );

  // Inline local JS (keep CDN scripts as external)
  html = html.replace(
    /<script([^>]*?)src=["']([^"']+)["']([^>]*?)><\/script>/gi,
    (match, before, src, after) => {
      if (/^https?:|^\/\//.test(src)) return match;
      const key = src.replace(/^\//, "");
      const js = lookup[key] ?? lookup[key.split("/").pop() ?? ""];
      return js != null ? `<script${before}${after}>${js}</script>` : match;
    }
  );

  // Inject postMessage listener for Play / Reset
  const listener = `<script>
window.addEventListener('message', function(e) {
  if (!e.data || !e.data.type) return;
  try {
    if (e.data.type === 'play'  && typeof play  === 'function') play();
    if (e.data.type === 'reset' && typeof reset === 'function') reset();
  } catch (_) {}
});
</script>`;

  return html.includes("</html>")
    ? html.replace("</html>", listener + "\n</html>")
    : html + listener;
}

// ─── Remote template helpers (CodeSandbox define API) ────────────────────────

async function createRemoteSandbox(
  files: Record<string, SandpackFile>,
  template: string
): Promise<string> {
  const csFiles: Record<string, { content: string }> = {};
  for (const [path, file] of Object.entries(files)) {
    csFiles[path.replace(/^\//, "")] = { content: file.code };
  }

  const res = await fetch(
    "https://codesandbox.io/api/v1/sandboxes/define?json=1",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ files: csFiles, template }),
    }
  );
  if (!res.ok) throw new Error(`CodeSandbox API error: ${res.status}`);
  const json = await res.json();
  if (!json.sandbox_id) throw new Error("No sandbox_id in response");
  return json.sandbox_id as string;
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function PlayIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M5 3l14 9-14 9V3z" />
    </svg>
  );
}

function ResetIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  );
}

// ─── Toolbar ──────────────────────────────────────────────────────────────────

function Toolbar({
  onPlay,
  onReset,
  caption,
}: {
  onPlay?: () => void;
  onReset: () => void;
  caption?: string;
}) {
  return (
    <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-2 flex items-center gap-2 bg-gray-50 dark:bg-gray-800">
      {onPlay && (
        <button
          onClick={onPlay}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 rounded hover:bg-indigo-700 transition-colors"
        >
          <PlayIcon />
          Play
        </button>
      )}
      <button
        onClick={onReset}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
      >
        <ResetIcon />
        Reset
      </button>
      {caption && (
        <span className="ml-auto text-xs text-gray-400 dark:text-gray-500 italic">{caption}</span>
      )}
    </div>
  );
}

// ─── Static view ──────────────────────────────────────────────────────────────

function StaticView({ data }: { data: SandpackData }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [resetKey, setResetKey] = useState(0);
  const srcDoc = useMemo(() => buildSrcDoc(data.files), [data.files]);
  const height = data.outputHeight ?? 600;

  const sendPlay = useCallback(() => {
    iframeRef.current?.contentWindow?.postMessage({ type: "play" }, "*");
  }, []);

  const handleReset = useCallback(() => setResetKey((k) => k + 1), []);

  const handleLoad = useCallback(() => {
    if (data.autoRun) sendPlay();
  }, [data.autoRun, sendPlay]);

  return (
    <>
      <iframe
        key={resetKey}
        ref={iframeRef}
        srcDoc={srcDoc}
        onLoad={handleLoad}
        sandbox="allow-scripts allow-same-origin"
        style={{ width: "100%", height: `${height}px`, border: "none", display: "block" }}
        title="Sandpack output"
      />
      <Toolbar onPlay={sendPlay} onReset={handleReset} caption={data.caption} />
    </>
  );
}

// ─── Remote view (react, node, vue, …) ───────────────────────────────────────

function RemoteView({ data }: { data: SandpackData }) {
  const [sandboxId, setSandboxId] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [resetKey, setResetKey] = useState(0);
  const height = data.outputHeight ?? 600;
  const isDark = useDarkMode();

  // Only re-create the sandbox when comp_id changes (not on every render)
  useEffect(() => {
    setStatus("loading");
    setSandboxId(null);
    createRemoteSandbox(data.files, data.template ?? "react")
      .then((id) => { setSandboxId(id); setStatus("ready"); })
      .catch(() => setStatus("error"));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.comp_id]);

  const handleReset = useCallback(() => setResetKey((k) => k + 1), []);

  const embedUrl = sandboxId
    ? `https://codesandbox.io/embed/${sandboxId}?fontsize=14&hidenavigation=1&theme=${isDark ? "dark" : "light"}&view=preview&hidedevtools=1`
    : null;

  return (
    <>
      <div style={{ width: "100%", height: `${height}px`, position: "relative" }}>
        {status === "loading" && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50 dark:bg-gray-800">
            <span className="text-sm text-gray-400 animate-pulse">Loading sandbox…</span>
          </div>
        )}
        {status === "error" && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50 dark:bg-gray-800">
            <span className="text-sm text-red-400">Failed to load sandbox.</span>
          </div>
        )}
        {status === "ready" && embedUrl && (
          <iframe
            key={resetKey}
            src={embedUrl}
            allow="accelerometer; camera; encrypted-media; geolocation; gyroscope; microphone; midi; payment; usb; xr-spatial-tracking"
            sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts"
            style={{ width: "100%", height: "100%", border: "none", display: "block" }}
            title="Sandpack output"
          />
        )}
      </div>
      <Toolbar onReset={handleReset} caption={data.caption} />
    </>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Sandpack({ data }: { data: SandpackData }) {
  if (data.hideOutput) return null;

  return (
    <div className="max-w-6xl mx-auto px-4 py-4">
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden bg-white dark:bg-gray-900">
        {data.template === "static" ? (
          <StaticView data={data} />
        ) : (
          <RemoteView data={data} />
        )}
      </div>
    </div>
  );
}

