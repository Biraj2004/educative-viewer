"use client";

import { useEffect, useMemo, useState } from "react";
import {
  SandpackProvider,
  SandpackLayout,
  SandpackCodeEditor,
  SandpackPreview,
  getSandpackCssText,
  defaultDark,
  defaultLight,
  SANDBOX_TEMPLATES,
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
    setIsDark(el.classList.contains("dark"));
    const obs = new MutationObserver(() =>
      setIsDark(el.classList.contains("dark"))
    );
    obs.observe(el, { attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return isDark;
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
  return <style dangerouslySetInnerHTML={{ __html: getSandpackCssText() }} />;
}

// ─── Inner component ─────────────────────────────────────────────────────────

type SandpackTemplate = keyof typeof SANDBOX_TEMPLATES;

function SandpackInner({ data }: { data: SandpackData }) {
  const [resetKey, setResetKey] = useState(0);
  const isDark = useDarkMode();

  const template: SandpackTemplate = (
    data.template && data.template in SANDBOX_TEMPLATES
      ? data.template
      : "static"
  ) as SandpackTemplate;

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

  const showEditor = !data.hideEditor;
  const editorHeight = data.codeHeight ?? 400;
  const previewHeight = data.outputHeight ?? (showEditor ? 400 : 500);

  return (
    <div className="max-w-6xl mx-auto px-4 py-4">
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
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
            <SandpackPreview
              style={{ height: previewHeight }}
              showOpenInCodeSandbox={false}
              showRefreshButton
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
      </div>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export default function Sandpack({ data }: { data: SandpackData }) {
  if (data.hideOutput) return null;
  return <SandpackInner data={data} />;
}
