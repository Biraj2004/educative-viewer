"use client";

import { useState, useEffect, useRef } from "react";
import Editor from "@monaco-editor/react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CodeTab {
  id: string;
  key: number;
  title: string;
  caption: string;
  content: string;
  language: string;
  entryFileName?: string;
  runnable?: boolean;
}

export interface TabbedCodeData {
  comp_id: string;
  caption: string;
  version: string;
  codeContents: CodeTab[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function monacoLang(lang: string) {
  const map: Record<string, string> = { "c++": "cpp" };
  return map[lang.toLowerCase()] ?? lang.toLowerCase();
}

// Language icon: a small "G" style C++ logo look-alike using plain SVG
function LangIcon() {
  return (
    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="11" stroke="#659AD2" strokeWidth="1.5" />
      <path d="M15.5 9A5 5 0 1 0 15.5 15" stroke="#659AD2" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M14 12h3M15.5 10.5v3" stroke="#659AD2" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TabbedCode({ data }: { data: TabbedCodeData }) {
  const tabs = data.codeContents;
  const [activeIdx, setActiveIdx] = useState(0);
  const [copied, setCopied] = useState(false);
  const [wordWrap, setWordWrap] = useState<"off" | "on">("off");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const editorRef = useRef<any>(null);

  const active = tabs[activeIdx];
  const lineCount = active.content.split("\n").length;
  const editorHeight = Math.min(Math.max(lineCount, 5), 30) * 20 + 16;

  useEffect(() => {
    if (!isFullscreen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setIsFullscreen(false); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isFullscreen]);

  const handleCopy = () => {
    navigator.clipboard.writeText(active.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-2">
      <div className={isFullscreen ? "fixed inset-0 z-50 flex flex-col" : "rounded-lg overflow-hidden border border-gray-700 shadow-lg"}>

        {/* Tab bar */}
        <div className="flex items-center bg-[#1e1e1e] border-b border-gray-700 overflow-x-auto shrink-0">
          {/* Left scroll hint arrow */}
          <div className="flex-1 flex overflow-x-auto scrollbar-none">
            {tabs.map((tab, i) => (
              <button
                key={tab.id}
                onClick={() => setActiveIdx(i)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm whitespace-nowrap border-r border-gray-700 transition-colors cursor-pointer ${
                  i === activeIdx
                    ? "bg-[#1e1e1e] text-white font-medium"
                    : "bg-[#2d2d2d] text-gray-400 hover:text-gray-200"
                }`}
              >
                <LangIcon />
                <span className="max-w-30 truncate">{tab.title}</span>
              </button>
            ))}
          </div>

          {/* Right icons: word wrap + copy + fullscreen */}
          <div className="flex items-center gap-3 px-3 text-gray-500 shrink-0 border-l border-gray-700">
            {/* Reset */}
            <button
              onClick={() => { editorRef.current?.setValue(active.content); editorRef.current?.revealLine(1); }}
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
            language={monacoLang(active.language)}
            value={active.content}
            theme="vs-dark"
            onMount={(editor) => { editorRef.current = editor; }}
            options={{
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              fontSize: 14,
              lineNumbers: "on",
              renderLineHighlight: "line",
              wordWrap,
              overviewRulerLanes: 0,
              hideCursorInOverviewRuler: true,
              scrollbar: { vertical: "auto", horizontal: "auto" },
              padding: { top: 8, bottom: 8 },
            }}
          />
        </div>

        {/* Footer */}
        <div className="flex items-center bg-[#1e1e1e] border-t border-gray-700 px-3 py-2 shrink-0">
        </div>
      </div>

      {/* Caption */}
      {(active.caption || data.caption) && !isFullscreen && (
        <p className="text-center text-sm font-medium text-indigo-600 dark:text-indigo-400 mt-3">
          {active.caption || data.caption}
        </p>
      )}
    </div>
  );
}
