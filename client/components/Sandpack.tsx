"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  SandpackProvider,
  SandpackLayout,
  SandpackCodeEditor,
  SandpackPreview,
  getSandpackCssText,
  defaultDark,
  defaultLight,
} from "@codesandbox/sandpack-react";

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

// ─── Dark mode hook ───────────────────────────────────────────────────────────

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

// ─── Client-only guard ────────────────────────────────────────────────────────

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
    <svg
      className="w-4 h-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  );
}

function ExternalLinkIcon() {
  return (
    <svg
      className="w-3.5 h-3.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

// ─── Sandpack CSS injection ───────────────────────────────────────────────────

function SandpackStyles() {
  const css = getSandpackCssText();
  return <style suppressHydrationWarning dangerouslySetInnerHTML={{ __html: css }} />;
}

// ─── Static view — sandpack-react (fast, fully client-side) ──────────────────

function StaticView({ data }: { data: SandpackData }) {
  const [resetKey, setResetKey] = useState(0);
  const isDark = useDarkMode();

  const files = useMemo(() => {
    const result: Record<string, { code: string; hidden?: boolean; active?: boolean; readOnly?: boolean }> = {};
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

  const activeFile =
    data.primaryFile ??
    Object.entries(data.files).find(([, f]) => f.active)?.[0] ??
    undefined;

  const showEditor = !data.hideEditor;
  const editorHeight = data.codeHeight ?? 350;
  const previewHeight = data.outputHeight ?? (showEditor ? 350 : 500);

  return (
    <>
      <SandpackStyles />
      <SandpackProvider
        key={resetKey}
        template="static"
        files={files}
        theme={isDark ? defaultDark : defaultLight}
        options={{
          autorun: data.autoRun ?? true,
          ...(activeFile ? { activeFile } : {}),
          externalResources: [],
        }}
      >
        <SandpackLayout>
          {showEditor && (
            <SandpackCodeEditor
              showLineNumbers
              showInlineErrors
              wrapContent={false}
              style={{ height: editorHeight }}
            />
          )}
          <SandpackPreview
            style={{ height: previewHeight }}
            showOpenInCodeSandbox={false}
            showRefreshButton
            showSandpackErrorOverlay
          />
        </SandpackLayout>
      </SandpackProvider>

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

// ─── Remote view — codesandbox.io embed (all other templates) ────────────────

async function createSandbox(
  files: Record<string, SandpackFile>,
  template: string
): Promise<string> {
  const csFiles: Record<string, { content: string }> = {};
  for (const [path, file] of Object.entries(files)) {
    csFiles[path.replace(/^\//, "")] = { content: file.code };
  }
  const res = await fetch("https://codesandbox.io/api/v1/sandboxes/define?json=1", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ files: csFiles, template }),
  });
  if (!res.ok) throw new Error(`CodeSandbox API ${res.status}`);
  const json = await res.json();
  if (!json.sandbox_id) throw new Error("No sandbox_id");
  return json.sandbox_id as string;
}

function RemoteView({ data }: { data: SandpackData }) {
  const [sandboxId, setSandboxId] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [iframeKey, setIframeKey] = useState(0);
  const isDark = useDarkMode();
  const height = data.outputHeight ?? 500;
  const template = data.template ?? "react";

  const doCreate = useCallback(() => {
    setStatus("loading");
    setSandboxId(null);
    createSandbox(data.files, template)
      .then((id) => { setSandboxId(id); setStatus("ready"); })
      .catch(() => setStatus("error"));
  }, [data.files, template]);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    setSandboxId(null);
    createSandbox(data.files, template)
      .then((id) => { if (!cancelled) { setSandboxId(id); setStatus("ready"); } })
      .catch(() => { if (!cancelled) setStatus("error"); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.comp_id]);

  const view = data.hideEditor ? "preview" : "split";
  const embedUrl = sandboxId
    ? `https://codesandbox.io/embed/${sandboxId}?fontsize=14&hidenavigation=1&theme=${isDark ? "dark" : "light"}&view=${view}&hidedevtools=1`
    : null;
  const openUrl = sandboxId ? `https://codesandbox.io/s/${sandboxId}` : null;

  return (
    <>
      <div style={{ width: "100%", height: `${height}px`, position: "relative" }}>
        {status === "loading" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gray-50 dark:bg-gray-800">
            <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-gray-500 dark:text-gray-400">Creating sandbox…</span>
          </div>
        )}
        {status === "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gray-50 dark:bg-gray-800">
            <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <circle cx="12" cy="12" r="10" />
              <path strokeLinecap="round" d="M12 8v4m0 4h.01" />
            </svg>
            <span className="text-sm text-red-500 dark:text-red-400">Failed to load sandbox</span>
            <button
              onClick={doCreate}
              className="mt-1 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded hover:bg-indigo-700 transition-colors cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}
        {status === "ready" && embedUrl && (
          <iframe
            key={iframeKey}
            src={embedUrl}
            allow="accelerometer; camera; encrypted-media; geolocation; gyroscope; microphone; midi; payment; usb; xr-spatial-tracking"
            sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts"
            style={{ width: "100%", height: "100%", border: "none", display: "block" }}
            title="CodeSandbox"
          />
        )}
      </div>

      <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-2 flex items-center gap-2 bg-gray-50 dark:bg-gray-800">
        <button
          onClick={() => setIframeKey((k) => k + 1)}
          disabled={status !== "ready"}
          title="Reload sandbox"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ResetIcon />
          Reset
        </button>
        {openUrl && (
          <a
            href={openUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-indigo-600 dark:text-indigo-400 bg-white dark:bg-gray-700 border border-indigo-300 dark:border-indigo-600 rounded hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors cursor-pointer"
          >
            <ExternalLinkIcon />
            Open in CodeSandbox
          </a>
        )}
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
  if (data.hideOutput) return null;

  const isStatic = !data.template || data.template === "static";

  if (!mounted) {
    const height = isStatic
      ? (data.codeHeight ?? 350)
      : (data.outputHeight ?? 500);
    return (
      <div className="max-w-6xl mx-auto px-4 py-4">
        <div
          className="rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden bg-white dark:bg-gray-900"
          style={{ height: height + 42 }}
        />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-4">
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden bg-white dark:bg-gray-900">
        {isStatic ? <StaticView data={data} /> : <RemoteView data={data} />}
      </div>
    </div>
  );
}
