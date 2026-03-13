"use client";

import { useState, useRef, useCallback } from "react";
import Editor from "@monaco-editor/react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface JottedFile {
  content: string;
  type: "html" | "css" | "js" | "exercise" | "hiddenjs";
}

interface JottedConfig {
  autoRun?: boolean;
  caption?: string;
  files?: JottedFile[];
  height?: string | number;
  hideCss?: boolean;
  hideHtml?: boolean;
  hideJs?: boolean;
  hideNav?: boolean;
  hideResult?: boolean;
  pane?: "code" | "result";
  runOnLoad?: boolean;
  showLineNumbers?: boolean;
  theme?: string;
  readOnlyState?: Record<string, boolean>;
  toggleState?: Record<string, boolean>;
}

export interface RunJSData {
  comp_id: string;
  active?: string;
  filename?: string;
  jotted?: JottedConfig;
  version?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const LANG_MAP: Record<string, string> = { html: "html", css: "css", js: "javascript" };
const LABEL_MAP: Record<string, string> = { html: "HTML", css: "CSS", js: "JS" };

function getFile(files: JottedFile[], type: string): string {
  return files.find((f) => f.type === type)?.content ?? "";
}

function buildPage(html: string, css: string, js: string): string {
  // Insert CSS and JS into the HTML doc for sandbox rendering
  const style = css ? `<style>${css}</style>` : "";
  const script = js ? `<script>${js}<\/script>` : "";
  if (html.includes("</head>")) {
    return html.replace("</head>", `${style}</head>`).replace("</body>", `${script}</body>`);
  }
  return `<!DOCTYPE html><html><head>${style}</head><body>${html}${script}</body></html>`;
}

// ─── Tab button ───────────────────────────────────────────────────────────────

function TabBtn({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-xs font-semibold tracking-wide transition-colors cursor-pointer border-b-2 ${
        active
          ? "border-indigo-500 text-indigo-400 bg-[#1e1e1e]"
          : "border-transparent text-gray-400 hover:text-gray-200 bg-[#2d2d2d]"
      }`}
    >
      {label}
    </button>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function RunJS({ data }: { data: RunJSData }) {
  const jotted = data.jotted;
  const files = jotted?.files ?? [];

  const initHtml = getFile(files, "html");
  const initCss = getFile(files, "css");
  const initJs = getFile(files, "js");

  const [html, setHtml] = useState(initHtml);
  const [css, setCss] = useState(initCss);
  const [js, setJs] = useState(initJs);

  const showHtml = !jotted?.hideHtml;
  const showCss = !jotted?.hideCss;
  const showJs = !jotted?.hideJs;
  const showResult = !jotted?.hideResult;

  // Determine initial visible code tab
  const firstCodeTab =
    showHtml ? "html" : showCss ? "css" : showJs ? "js" : null;
  const [activeCode, setActiveCode] = useState<string>(firstCodeTab ?? "html");
  const [activePane, setActivePane] = useState<"code" | "result">(
    jotted?.pane === "result" ? "result" : "code"
  );

  const iframeHeight = parseInt(String(jotted?.height ?? "300"), 10);
  const srcDoc = buildPage(html, css, js);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const [iframeKey, setIframeKey] = useState(0);
  const run = useCallback(() => setIframeKey((k) => k + 1), []);

  const hasCode = showHtml || showCss || showJs;
  const hasBothPanes = hasCode && showResult;

  const currentContent =
    activeCode === "html" ? html : activeCode === "css" ? css : js;
  const currentReadOnly =
    jotted?.readOnlyState?.[activeCode] ?? false;

  function handleChange(value: string | undefined) {
    if (value === undefined) return;
    if (activeCode === "html") setHtml(value);
    else if (activeCode === "css") setCss(value);
    else setJs(value);
  }

  const lineCount = currentContent.split("\n").length;
  const editorHeight = Math.min(Math.max(lineCount, 5), 24) * 20 + 16;

  return (
    <div className="flex flex-col overflow-hidden">
      {/* ── Top navigation: only when both panes exist ── */}
      {hasBothPanes && (
        <div className="flex items-center bg-[#252526] border-b border-gray-700">
          <TabBtn
            label="Code"
            active={activePane === "code"}
            onClick={() => setActivePane("code")}
          />
          <TabBtn
            label="Result"
            active={activePane === "result"}
            onClick={() => setActivePane("result")}
          />
          {/* Run button */}
          <button
            onClick={run}
            title="Run"
            className="ml-auto mr-3 flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded bg-indigo-600 hover:bg-indigo-500 text-white transition-colors cursor-pointer"
          >
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
            Run
          </button>
        </div>
      )}

      {/* ── Code Panel ── */}
      {hasCode && (!hasBothPanes || activePane === "code") && (
        <div className="flex flex-col bg-[#1e1e1e]">
          {/* Sub-tabs for each language */}
          {(showHtml || showCss || showJs) && (
            <div className="flex bg-[#252526] border-b border-gray-700">
              {showHtml && (
                <TabBtn label={LABEL_MAP.html} active={activeCode === "html"} onClick={() => setActiveCode("html")} />
              )}
              {showCss && (
                <TabBtn label={LABEL_MAP.css} active={activeCode === "css"} onClick={() => setActiveCode("css")} />
              )}
              {showJs && (
                <TabBtn label={LABEL_MAP.js} active={activeCode === "js"} onClick={() => setActiveCode("js")} />
              )}
              {!hasBothPanes && showResult && (
                <button
                  onClick={run}
                  title="Run"
                  className="ml-auto mr-3 my-1 flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded bg-indigo-600 hover:bg-indigo-500 text-white transition-colors cursor-pointer"
                >
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  Run
                </button>
              )}
            </div>
          )}

          <Editor
            height={`${editorHeight}px`}
            language={LANG_MAP[activeCode] ?? "html"}
            value={currentContent}
            onChange={handleChange}
            options={{
              readOnly: currentReadOnly,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              fontSize: 13,
              lineNumbers: jotted?.showLineNumbers !== false ? "on" : "off",
              wordWrap: "off",
              theme: "vs-dark",
              renderLineHighlight: "none",
              padding: { top: 8, bottom: 8 },
            }}
            theme="vs-dark"
          />
        </div>
      )}

      {/* ── Result iframe ── */}
      {showResult && (!hasBothPanes || activePane === "result") && (
        <div className="border-t border-gray-700 bg-white">
          <iframe
            key={iframeKey}
            ref={iframeRef}
            srcDoc={srcDoc}
            title="Result"
            sandbox="allow-scripts allow-same-origin"
            style={{ width: "100%", height: `${iframeHeight}px`, border: "none", display: "block" }}
          />
        </div>
      )}

      {/* Caption */}
      {jotted?.caption && (
        <p className="text-xs text-gray-400 text-center py-2 bg-[#1e1e1e]">{jotted.caption}</p>
      )}
    </div>
  );
}
