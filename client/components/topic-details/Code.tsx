"use client";

import { useState, useEffect, useRef } from "react";
import Editor from "@monaco-editor/react";
import { resolveMonacoLanguage } from "@/utils/monaco-language";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AdditionalFile {
  content: string;
  fileName: string;
  hidden: boolean;
  highlightedLines: string;
  staticFile: boolean;
}

export interface CodeComponentData {
  comp_id: string;
  content: string;
  language: string;
  entryFileName: string;
  caption: string;
  runnable: boolean;
  allowDownload: boolean;
  additionalContent?: AdditionalFile[];
}

// ─── Language helpers ─────────────────────────────────────────────────────────

const LANG_DISPLAY: Record<string, string> = {
  "c++": "C++", cpp: "C++", c: "C", python: "Python", java: "Java",
  javascript: "JavaScript", typescript: "TypeScript", go: "Go",
  rust: "Rust", ruby: "Ruby", kotlin: "Kotlin", swift: "Swift",
  sql: "SQL", bash: "Bash", shell: "Shell",
  js: "JavaScript", node: "JavaScript", "javascript-es2024": "JavaScript",
  ts: "TypeScript", "typescript-esnext": "TypeScript", sh: "Shell",
};

function langLabel(lang: string) {
  return LANG_DISPLAY[lang.toLowerCase()] ?? lang.toUpperCase();
}

// ─── File icon ────────────────────────────────────────────────────────────────

function LangFileIcon({ lang }: { lang: string }) {
  const l = lang.toLowerCase();
  if (l === "java") {
    return (
      <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 32 32" fill="none">
        <path d="M11 4s-1.5 5 3 8c2.5 1.7 2 5 2 5" stroke="#f89820" strokeWidth="2" strokeLinecap="round"/>
        <path d="M16 4s-1.5 5 3 8c2.5 1.7 2 5 2 5" stroke="#f89820" strokeWidth="2" strokeLinecap="round"/>
        <rect x="7" y="18" width="18" height="10" rx="1.5" stroke="#5382a1" strokeWidth="2"/>
        <path d="M25 22h2a2.5 2.5 0 010 5h-2" stroke="#5382a1" strokeWidth="2" strokeLinecap="round"/>
      </svg>
    );
  }
  if (l === "python") {
    return (
      <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none">
        <path d="M12 2C8 2 7 4 7 6v2h5v1H5.5C3.5 9 2 10.5 2 13s1.5 4 3.5 4H7v-2.5C7 12 8.5 11 10 11h4c2 0 3-1 3-3V6c0-2-1.5-4-5-4z" fill="#3776ab"/>
        <path d="M12 22c4 0 5-2 5-4v-2h-5v-1h6.5c2 0 3.5-1.5 3.5-4s-1.5-4-3.5-4H17v2.5c0 2.5-1.5 3.5-3 3.5h-4c-2 0-3 1-3 3v3c0 2 1.5 4 5 4z" fill="#ffd43b"/>
      </svg>
    );
  }
  // generic code icon
  return (
    <svg className="w-3.5 h-3.5 shrink-0 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
    </svg>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Code({ data }: { data: CodeComponentData }) {
  const allFiles = [
    { fileName: data.entryFileName, content: data.content },
    ...(data.additionalContent ?? [])
      .filter(f => !f.hidden)
      .map(f => ({ fileName: f.fileName, content: f.content })),
  ];
  const hasSidebar = allFiles.length > 1;

  const [selectedIdx, setSelectedIdx] = useState(0);
  const [copied, setCopied] = useState(false);
  const [wordWrap, setWordWrap] = useState<"off" | "on">("off");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const editorRef = useRef<any>(null);

  const activeFile = allFiles[selectedIdx];
  const lineCount = activeFile.content.split("\n").length;
  const editorHeight = Math.min(Math.max(lineCount, 5), 30) * 20 + 16;

  useEffect(() => {
    if (!isFullscreen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setIsFullscreen(false); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isFullscreen]);

  const handleCopy = () => {
    navigator.clipboard.writeText(activeFile.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-2">
      <div className={
        isFullscreen
          ? "fixed inset-0 z-50 flex overflow-hidden"
          : "rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 shadow-lg flex"
      }>
        {/* ── File sidebar ── */}
        {hasSidebar && sidebarOpen && (
          <div className={`shrink-0 bg-white dark:bg-[#0f172a] border-r border-gray-200 dark:border-gray-700 flex flex-col ${isFullscreen ? "w-44" : "w-40"}`}>
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
                </svg>
                <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Files</span>
              </div>
              <button onClick={() => setSidebarOpen(false)} title="Collapse" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors cursor-pointer">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            </div>
            <div className="overflow-y-auto py-1" style={isFullscreen ? undefined : { maxHeight: editorHeight }}>
              {allFiles.map((f, i) => (
                <button
                  key={f.fileName}
                  onClick={() => setSelectedIdx(i)}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors ${
                    i === selectedIdx
                      ? "text-gray-900 dark:text-white font-semibold dark:bg-white/10"
                      : "text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5 hover:text-gray-800 dark:hover:text-gray-200"
                  }`}
                >
                  <LangFileIcon lang={data.language} />
                  <span className="text-xs truncate">{f.fileName}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Editor panel ── */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Tab / header bar */}
          <div className="flex items-center justify-between bg-white dark:bg-[#0f172a] border-b border-gray-200 dark:border-gray-700 px-3 py-2 shrink-0">
            <div className="flex items-center gap-2">
              {/* Hamburger — toggle sidebar */}
              {hasSidebar && (
                <button onClick={() => setSidebarOpen(o => !o)} title={sidebarOpen ? "Hide files" : "Show files"} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors mr-1 cursor-pointer">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
              )}
              <svg className="w-4 h-4 text-blue-500 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
              <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">{activeFile.fileName}</span>
            </div>

            <div className="flex items-center gap-2.5">
              {/* Language badge */}
              <div className="flex items-center gap-1 text-xs font-semibold text-gray-700 dark:text-gray-300">
                <LangFileIcon lang={data.language} />
                <span>{langLabel(data.language)}</span>
              </div>
              <div className="w-px h-4 bg-gray-200 dark:bg-gray-700" />
              {/* Reset */}
              <button
                onClick={() => { editorRef.current?.setValue(activeFile.content); editorRef.current?.revealLine(1); }}
                title="Reset to original"
                className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-100 transition-colors cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
              {/* Copy */}
              <button onClick={handleCopy} title="Copy code" className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-100 transition-colors cursor-pointer">
                {copied ? (
                  <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-4 10h6a2 2 0 002-2v-8a2 2 0 00-2-2h-6a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                )}
              </button>
              {/* Word wrap */}
              <button
                onClick={() => setWordWrap(w => w === "off" ? "on" : "off")}
                className={`text-xs px-1.5 py-0.5 rounded border transition-colors cursor-pointer ${
                  wordWrap === "on"
                    ? "border-blue-500 text-blue-600 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30"
                    : "border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                }`}
              >
                Wrap
              </button>
              {/* Fullscreen */}
              <button onClick={() => setIsFullscreen(f => !f)} title={isFullscreen ? "Exit fullscreen" : "Fullscreen"} className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-100 transition-colors cursor-pointer">
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
              language={resolveMonacoLanguage(data.language, activeFile.content)}
              value={activeFile.content}
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
      </div>

      {/* Caption */}
      {data.caption && !isFullscreen && (
        <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-3">{data.caption}</p>
      )}
    </div>
  );
}

