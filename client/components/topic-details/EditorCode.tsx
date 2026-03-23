"use client";

import { useState, useEffect, useRef } from "react";
import Editor from "@monaco-editor/react";
import { resolveMonacoLanguage } from "@/utils/monaco-language";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EditorCodeComponentData {
  comp_id: string;
  content: string;
  language: string;
  caption?: string;
  entryFileName?: string;
  version: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const LANG_DISPLAY: Record<string, string> = {
  "c++": "C++", cpp: "C++", c: "C", python: "Python", java: "Java",
  javascript: "JavaScript", typescript: "TypeScript", go: "Go",
  rust: "Rust", ruby: "Ruby", kotlin: "Kotlin", swift: "Swift",
  sql: "SQL", bash: "Bash", shell: "Shell",
  js: "JavaScript", node: "JavaScript", "javascript-es2024": "JavaScript",
  ts: "TypeScript", "typescript-esnext": "TypeScript", sh: "Shell",
};

const LANG_EXT: Record<string, string> = {
  "c++": ".cpp", cpp: ".cpp", c: ".c", python: ".py", java: ".java",
  javascript: ".js", typescript: ".ts", go: ".go", rust: ".rs",
  ruby: ".rb", kotlin: ".kt", swift: ".swift", sql: ".sql", bash: ".sh",
};

function langLabel(lang: string) {
  return LANG_DISPLAY[lang.toLowerCase()] ?? lang.toUpperCase();
}

function defaultFileName(lang: string, provided?: string): string {
  if (provided) return provided;
  const ext = LANG_EXT[lang.toLowerCase()] ?? ".txt";
  return `main${ext}`;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function EditorCode({ data }: { data: EditorCodeComponentData }) {
  const [copied, setCopied] = useState(false);
  const [wordWrap, setWordWrap] = useState<"off" | "on">("off");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const editorRef = useRef<any>(null);

  const safeLanguage = asString((data as unknown as Record<string, unknown>)?.language) || "text";
  const safeContent = asString((data as unknown as Record<string, unknown>)?.content);
  const safeEntryFileName = asString((data as unknown as Record<string, unknown>)?.entryFileName) || undefined;
  const safeCaption = asString((data as unknown as Record<string, unknown>)?.caption);

  const fileName = defaultFileName(safeLanguage, safeEntryFileName);
  const lineCount = safeContent.split("\n").length;
  const editorHeight = Math.min(Math.max(lineCount, 5), 30) * 20 + 16;

  useEffect(() => {
    if (!isFullscreen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setIsFullscreen(false); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isFullscreen]);

  const handleCopy = () => {
    navigator.clipboard.writeText(safeContent).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-2">
      <div className={isFullscreen ? "fixed inset-0 z-50 flex flex-col" : "rounded-lg overflow-hidden border border-gray-700 shadow-lg"}>
        {/* Header */}
        <div className="flex items-center justify-between bg-[#1a1a2e] px-4 py-2.5 border-b border-gray-700 shrink-0">
          <div className="flex items-center gap-2 text-gray-300 text-sm font-medium">
            <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
            <span>{fileName}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-blue-300 bg-blue-900/40 px-2 py-0.5 rounded">
              {langLabel(safeLanguage)}
            </span>
            <button
              onClick={() => { editorRef.current?.setValue(safeContent); editorRef.current?.revealLine(1); }}
              title="Reset to original"
              className="text-gray-400 hover:text-white transition-colors cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            <button onClick={handleCopy} title="Copy code" className="text-gray-400 hover:text-white transition-colors cursor-pointer">
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
            <button
              onClick={() => setWordWrap(w => w === "off" ? "on" : "off")}
              title={wordWrap === "off" ? "Enable word wrap" : "Disable word wrap"}
              className={`text-xs px-1.5 py-0.5 rounded border transition-colors cursor-pointer ${
                wordWrap === "on"
                  ? "border-blue-500 text-blue-300 bg-blue-900/40"
                  : "border-gray-600 text-gray-400 hover:text-gray-200 hover:border-gray-400"
              }`}
            >
              Wrap
            </button>
            <button onClick={() => setIsFullscreen(f => !f)} title={isFullscreen ? "Exit fullscreen" : "Fullscreen"} className="text-gray-400 hover:text-white transition-colors cursor-pointer">
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

        {/* Monaco Editor */}
        <div className={isFullscreen ? "flex-1 overflow-hidden" : ""}>
          <Editor
            height={isFullscreen ? "100%" : editorHeight}
            language={resolveMonacoLanguage(safeLanguage, safeContent)}
            value={safeContent}
            theme="vs-dark"
            onMount={(editor) => { editorRef.current = editor; }}
            options={{
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              fontSize: 14,
              lineNumbers: "on",
              renderLineHighlight: "line",
              scrollbar: { vertical: "auto", horizontal: "auto" },
              overviewRulerLanes: 0,
              hideCursorInOverviewRuler: true,
              contextmenu: false,
              folding: true,
              wordWrap,
              padding: { top: 8, bottom: 8 },
            }}
          />
        </div>
      </div>

      {/* Caption */}
      {safeCaption && !isFullscreen && (
        <p className="text-center text-sm text-gray-500 mt-3">{safeCaption}</p>
      )}
    </div>
  );
}

