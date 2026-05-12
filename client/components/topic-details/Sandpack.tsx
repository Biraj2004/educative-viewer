"use client";

import { useEffect, useMemo, useState } from "react";
import {
  SandpackProvider,
  SandpackLayout,
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

/**
 * Map Educative template names → Sandpack predefined template names.
 * Falls back to "static" for anything unknown so the component never breaks.
 *
 * Supported Sandpack templates (v2):
 *   static | react | react-ts | vanilla | vanilla-ts | vue | vue3 |
 *   angular | svelte | solid | node | nextjs | test-ts |
 *   vite | vite-react | vite-react-ts | vite-vue | vite-vue3 | vite-svelte
 */
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

// ─── Sandpack CSS injection ───────────────────────────────────────────────────

function SandpackStyles() {
  const css = getSandpackCssText();
  return <style suppressHydrationWarning dangerouslySetInnerHTML={{ __html: css }} />;
}

// ─── Unified sandpack view (all templates, fully in-browser) ─────────────────

function SandpackView({ data }: { data: SandpackData }) {
  const [resetKey, setResetKey] = useState(0);
  const isDark = useDarkMode();
  const template = resolveSandpackTemplate(data.template);

  // Build the files map in the shape Sandpack expects.
  const files = useMemo(() => {
    const result: Record<
      string,
      { code: string; hidden?: boolean; active?: boolean; readOnly?: boolean }
    > = {};
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

  const showEditor  = !data.hideEditor;
  const showConsole = !data.hideConsole && template !== "static";
  const editorHeight  = data.codeHeight  ?? 350;
  const previewHeight = data.outputHeight ?? (showEditor ? 350 : 500);

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
        <SandpackLayout>
          {showEditor && (
            <SandpackCodeEditor
              showLineNumbers
              showInlineErrors
              wrapContent={false}
              style={{ height: editorHeight }}
            />
          )}
          {!data.hideOutput && (
            <SandpackPreview
              style={{ height: previewHeight }}
              showOpenInCodeSandbox={false}
              showRefreshButton
              showSandpackErrorOverlay
            />
          )}
          {showConsole && (
            <SandpackConsole
              style={{ height: 150 }}
              showHeader
              showSyntaxError
            />
          )}
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

// ─── Main export ──────────────────────────────────────────────────────────────

export default function Sandpack({ data }: { data: SandpackData }) {
  const mounted = useMounted();
  if (data.hideOutput) return null;

  const editorHeight  = data.codeHeight  ?? 350;
  const previewHeight = data.outputHeight ?? (data.hideEditor ? 500 : 350);
  const skeletonHeight = editorHeight + previewHeight + 42;

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
