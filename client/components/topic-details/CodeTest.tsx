import { useState, useRef, useEffect } from "react";
import MonacoEditor from "@monaco-editor/react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CodeTestData {
  comp_id: string;
  caption?: string;
  languageContents?: {
    [key: string]: {
      codeContents: {
        content: string;
        language: string;
      };
      mainFileName: string;
    };
  };
  selectedLanguage?: string;
  publicTestCases?: {
    content: string;
  };
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function PlayIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <path d="M5 3l14 9-14 9V3z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="w-4 h-4 text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function ResultsIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}

function CodeIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  );
}

function HelpIcon() {
  return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
}

function ResetIcon() {
  return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>;
}

function FullScreenIcon() {
  return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4h4M16 4h4v4M4 16v4h4M20 16v4h-4" /></svg>;
}

function ExitFullScreenIcon() {
  return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 3v4a1 1 0 01-1 1H3m18 0h-4a1 1 0 01-1-1V3m0 18v-4a1 1 0 011-1h4M3 16h4a1 1 0 011 1v4" /></svg>;
}

function CloudCheckIcon() {
  return <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" /><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4" /></svg>;
}

function ChevronUpIcon() {
  return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" /></svg>;
}

function ErrorIcon() {
  return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CodeTest({ data }: { data: CodeTestData }) {
  const [activeTab, setActiveTab] = useState<"testCases" | "results" | "feedback">("testCases");
  const defaultCode = data.languageContents?.[data.selectedLanguage || "Python"]?.codeContents.content || "";
  const [code, setCode] = useState(defaultCode);
  const [isFullscreen, setIsFullscreen] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const editorRef = useRef<any>(null);
  const [runState, setRunState] = useState<"idle" | "running" | "done">("idle");

  const lang = data.languageContents?.[data.selectedLanguage || "Python"]?.codeContents.language || "python";
  const fileName = data.languageContents?.[data.selectedLanguage || "Python"]?.mainFileName || "main.py";

  // Naive YAML extraction to find the inputs
  const rawTestCases = data.publicTestCases?.content || "";
  const matchTestCases = Array.from(rawTestCases.matchAll(/- name: "(.*?)"[\s\S]*?inputs:[\s\S]*?- 1 : (\[.*?\])[\s\S]*?output:[\s\S]*?- 1 : (\[.*?\])/g));
  
  const testCases = matchTestCases.map((m) => ({
    name: m[1],
    input: m[2],
    output: m[3],
  }));

  const [activeTestIndex, setActiveTestIndex] = useState(0);

  useEffect(() => {
    if (!isFullscreen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setIsFullscreen(false); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isFullscreen]);

  const handleReset = () => {
    setCode(defaultCode);
    editorRef.current?.setValue(defaultCode);
  };

  const handleRun = () => {
    setRunState("running");
    setTimeout(() => {
      setRunState("done");
      setActiveTab("results");
    }, 800);
  };

  return (
    <div className={isFullscreen
      ? "fixed inset-0 z-50 flex flex-col overflow-hidden bg-white dark:bg-gray-900 shadow-sm font-sans"
      : "w-full max-w-5xl mx-auto rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden bg-white dark:bg-gray-900 shadow-sm font-sans flex flex-col"
    }>
      {/* ─── Top Bar ────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950">
        <div className="flex items-center gap-2">
          {/* Logo mock */}
          <div className="text-yellow-500 w-5 h-5 flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2m0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8"/></svg>
          </div>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {data.selectedLanguage || "Python"}
          </span>
        </div>

        {/* Toolbar Actions */}
        <div className="flex items-center gap-3 text-gray-400 dark:text-gray-500">
           <button title="Help" className="hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer transition-colors">
             <HelpIcon />
           </button>
           <button title="Reset Code" onClick={handleReset} className="hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer transition-colors">
             <ResetIcon />
           </button>
           <button title="Toggle Fullscreen" onClick={() => setIsFullscreen(v => !v)} className="hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer transition-colors">
             {isFullscreen ? <ExitFullScreenIcon /> : <FullScreenIcon />}
           </button>
        </div>
      </div>

      {/* ─── Editor Header ──────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#1e1e1e] border-b border-[#333] text-gray-400 text-xs font-mono">
        <div className="flex items-center gap-2">
          <CodeIcon />
          <span className="text-gray-200 font-medium">{fileName}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5"><span className="text-gray-500 font-bold">{"{}"}</span> <CloudCheckIcon /> <span className="text-gray-400">Saved</span></span>
          <span className="text-gray-600">|</span>
          <ChevronUpIcon />
        </div>
      </div>

      {/* ─── Monaco Editor ──────────────────────────────────────── */}
      <div className="h-80 w-full relative group">
        <MonacoEditor
          height="100%"
          language={lang === "python3" ? "python" : lang}
          theme="vs-dark"
          value={code}
          onChange={(v) => setCode(v || "")}
          onMount={(editor) => { editorRef.current = editor; }}
          options={{
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            fontSize: 14,
            padding: { top: 16 },
          }}
        />

        {/* Floating Actions */}
        <div className="absolute bottom-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
           <button onClick={handleRun} className="px-4 py-2 bg-[#20253e] hover:bg-[#2a304a] text-gray-200 rounded-md text-sm font-medium flex items-center gap-1.5 transition-colors border border-[#2a304a] cursor-pointer">
             <PlayIcon /> Run
           </button>
           <button className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-sm font-medium transition-colors border border-indigo-700 cursor-pointer">
             Submit
           </button>
        </div>
      </div>

      {/* ─── Bottom Tabs ────────────────────────────────────────── */}
      <div className={`border-t border-gray-200 dark:border-[#333] bg-white dark:bg-gray-900 flex flex-col ${isFullscreen ? "flex-1" : "h-64"}`}>
        <div className="flex border-b border-gray-200 dark:border-[#333]">
          <button
            onClick={() => setActiveTab("testCases")}
            className={`flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors cursor-pointer ${activeTab === "testCases" ? "border-indigo-500 text-indigo-600 dark:text-indigo-400" : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"}`}
          >
            <CheckIcon /> Test Cases
          </button>
          <button
            onClick={() => setActiveTab("results")}
            className={`flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors cursor-pointer ${activeTab === "results" ? "border-indigo-500 text-indigo-600 dark:text-indigo-400" : "border-transparent text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400"}`}
          >
            <ResultsIcon /> Results
          </button>
          <button
            onClick={() => setActiveTab("feedback")}
            className={`flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors cursor-pointer ${activeTab === "feedback" ? "border-indigo-500 text-indigo-600 dark:text-indigo-400" : "border-transparent text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400"}`}
          >
             <CodeIcon /> Code Feedback
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 p-6 overflow-y-auto">
          {activeTab === "testCases" && (
            <div className="space-y-6">
              {/* Test Case Selectors */}
              <div className="flex gap-2">
                {testCases.map((tc, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveTestIndex(idx)}
                    className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors border cursor-pointer ${activeTestIndex === idx ? "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-300 dark:border-indigo-600/50" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50 dark:bg-[#1a1f35] dark:text-gray-300 dark:border-[#2a304a] dark:hover:bg-[#20253e]"}`}
                  >
                    Case {idx + 1}
                  </button>
                ))}
              </div>

              {/* Data View */}
              {testCases[activeTestIndex] && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Input #1</label>
                    <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded font-mono text-sm dark:bg-gray-800 dark:border-gray-700 text-gray-700 dark:text-gray-300">
                      {testCases[activeTestIndex].input}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Expected Output</label>
                    <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded font-mono text-sm dark:bg-gray-800 dark:border-gray-700 text-gray-700 dark:text-gray-300">
                      {testCases[activeTestIndex].output}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "results" && (
            <div className="space-y-4">
              {runState === "idle" && (
                 <div className="h-40 flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm italic">
                   Run the code to see results.
                 </div>
              )}
              {runState === "running" && (
                 <div className="h-40 flex items-center justify-center text-indigo-500 text-sm animate-pulse">
                   Running tests...
                 </div>
              )}
              {runState === "done" && (
                 <div className="border border-red-200 dark:border-red-900/50 bg-white dark:bg-gray-900 rounded-lg overflow-hidden">
                    <div className="flex justify-between items-center px-4 py-3 border-b border-gray-100 dark:border-gray-800">
                      <div className="flex items-center gap-2 text-red-600 dark:text-red-500 font-medium text-sm">
                        <ErrorIcon /> 2 / 10 Test Cases Passed
                      </div>
                      <div className="flex items-center gap-3">
                         <span className="text-xs text-gray-500">Runtime: 0.04ms</span>
                         <button className="flex items-center gap-1 border border-blue-500 text-blue-600 dark:text-blue-400 px-3 py-1 text-xs rounded font-medium hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors cursor-pointer">
                           <CodeIcon /> Debug Code
                         </button>
                         <button className="border border-gray-200 dark:border-gray-700 text-gray-500 px-3 py-1 text-xs rounded hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors bg-white dark:bg-gray-800">
                           Diff
                         </button>
                      </div>
                    </div>
                    {/* Test Case output failure details */}
                    <div className="p-5 space-y-4">
                      <div className="flex border-b border-gray-100 dark:border-gray-800 pb-3">
                         <span className="w-24 text-sm font-medium text-gray-700 dark:text-gray-300 pt-1">Input</span>
                         <div className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded font-mono text-sm dark:bg-gray-950 dark:border-gray-800 text-gray-600 dark:text-gray-400 font-normal">
                            Input #1 = [0,20,41]
                         </div>
                      </div>
                      <div className="flex border-b border-gray-100 dark:border-gray-800 pb-3">
                         <span className="w-24 text-sm font-medium text-gray-700 dark:text-gray-300 pt-1">Output</span>
                         <div className="flex-1 px-3 py-2 bg-red-50/50 text-red-600 border border-red-200 rounded font-mono text-sm dark:bg-red-500/5 dark:text-red-400 dark:border-red-900/40">
                            []
                         </div>
                      </div>
                      <div className="flex pb-1">
                         <span className="w-24 text-sm font-medium text-gray-700 dark:text-gray-300 pt-1">Expected</span>
                         <div className="flex-1 px-3 py-2 bg-green-50/50 text-green-700 border border-green-200 rounded font-mono text-sm dark:bg-green-500/5 dark:text-green-400 dark:border-green-800/40">
                            [41]
                         </div>
                      </div>
                    </div>
                 </div>
              )}
            </div>
          )}

          {activeTab === "feedback" && (
            <div className="h-full flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm italic">
              AI Code Feedback will appear here.
            </div>
          )}
        </div>
      </div>
      
      {data.caption && (
        <div className="p-3 bg-gray-50 border-t border-gray-200 dark:bg-gray-900 dark:border-[#333] flex justify-center">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{data.caption}</span>
        </div>
      )}
    </div>
  );
}
