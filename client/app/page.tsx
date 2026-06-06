"use client";

import Link from "next/link";
import AppNavbar from "@/components/edu-viewer/AppNavbar";
import {
  HomeAuthProvider,
  HomeNavSignIn,
  HomeHeroCTA,
  HomeBottomCTA,
} from "@/components/edu-viewer/HomeAuthSection";
import HomePwaInstallButton from "@/components/edu-viewer/HomePwaInstallButton";
import { motion, Variants } from "framer-motion";
import { useState } from "react";
import {
  TerminalSquare,
  Lightbulb,
  Layers,
  Sparkles,
  Zap,
  ExternalLink,
  ChevronRight,
  Play,
  CheckCircle2,
  XCircle,
  Plus,
  Trash2,
  Code2,
  Hash,
  HelpCircle,
  GitBranch,
  RotateCcw,
  FileCode2,
} from "lucide-react";

// ─── Data ─────────────────────────────────────────────────────────────────────



const stats = [
  { value: "50+", label: "Rich Components" },
  { value: "0ms", label: "Latency Execution" },
  { value: "100%", label: "Dark Mode Native" },
];

// ─── Animations ─────────────────────────────────────────────────────────────

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15, delayChildren: 0.2 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 100, damping: 20 },
  },
};

function InteractiveShowcase() {
  const [activeTab, setActiveTab] = useState<"sandbox" | "array" | "quiz" | "latex" | "diagram" | "flashcard" | "diff">("sandbox");
  
  // Sandbox State
  const [isRunning, setIsRunning] = useState(false);
  const [runLogs, setRunLogs] = useState<string[]>([]);

  const handleRunCode = () => {
    if (isRunning) return;
    setIsRunning(true);
    setRunLogs(["Compiling...", "Running in Sandbox environment..."]);
    setTimeout(() => {
      setRunLogs((prev) => [...prev, "Output: Fibonacci(7) = 13", "Process completed with exit code 0"]);
      setIsRunning(false);
    }, 1200);
  };

  // Array State
  const [arrayElements, setArrayElements] = useState([12, 45, 78, 23]);
  const [arrayAction, setArrayAction] = useState<string | null>(null);
  
  const handlePush = () => {
    if (arrayElements.length >= 7) return;
    const newVal = Math.floor(Math.random() * 90) + 10;
    setArrayElements([...arrayElements, newVal]);
    setArrayAction(`Pushed ${newVal} to the array`);
  };

  const handlePop = () => {
    if (arrayElements.length === 0) return;
    const popped = arrayElements[arrayElements.length - 1];
    setArrayElements(arrayElements.slice(0, -1));
    setArrayAction(`Popped ${popped} from the array`);
  };

  // Quiz State
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const quizAnswers = [
    { text: "O(N)", correct: false },
    { text: "O(log N)", correct: true },
    { text: "O(1)", correct: false },
  ];

  // Flashcard State
  const [isFlipped, setIsFlipped] = useState(false);

  return (
    <div className="w-full max-w-5xl mx-auto rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-950 shadow-2xl overflow-hidden flex flex-col md:flex-row h-[550px] md:h-[450px]">
      
      {/* Sidebar - Topics Navigation */}
      <div className="w-full md:w-64 bg-zinc-50/50 dark:bg-zinc-900/40 border-b md:border-b-0 md:border-r border-zinc-200 dark:border-zinc-800/80 p-4 flex flex-col gap-2 shrink-0 overflow-y-auto">
        <div className="flex items-center gap-1.5 px-2 py-1 mb-4">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
          <span className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
          <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
          <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 ml-2 font-mono uppercase tracking-wider">Viewer Preview</span>
        </div>
        
        <button
          onClick={() => setActiveTab("sandbox")}
          className={`flex items-center gap-3 px-3 py-2.5 border-l-2 text-sm font-semibold transition-all cursor-pointer ${
            activeTab === "sandbox"
              ? "border-indigo-600 dark:border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 rounded-r-xl"
              : "border-transparent text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100/60 dark:hover:bg-zinc-900/40 hover:text-zinc-900 dark:hover:text-zinc-200 rounded-r-xl"
          }`}
        >
          <Code2 className="w-4 h-4" />
          1. Welcome to Sandbox
        </button>
        
        <button
          onClick={() => setActiveTab("array")}
          className={`flex items-center gap-3 px-3 py-2.5 border-l-2 text-sm font-semibold transition-all cursor-pointer ${
            activeTab === "array"
              ? "border-indigo-600 dark:border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 rounded-r-xl"
              : "border-transparent text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100/60 dark:hover:bg-zinc-900/40 hover:text-zinc-900 dark:hover:text-zinc-200 rounded-r-xl"
          }`}
        >
          <Hash className="w-4 h-4" />
          2. Interactive Arrays
        </button>
        
        <button
          onClick={() => setActiveTab("quiz")}
          className={`flex items-center gap-3 px-3 py-2.5 border-l-2 text-sm font-semibold transition-all cursor-pointer ${
            activeTab === "quiz"
              ? "border-indigo-600 dark:border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 rounded-r-xl"
              : "border-transparent text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100/60 dark:hover:bg-zinc-900/40 hover:text-zinc-900 dark:hover:text-zinc-200 rounded-r-xl"
          }`}
        >
          <HelpCircle className="w-4 h-4" />
          3. Structured Quizzes
        </button>
        <button
          onClick={() => setActiveTab("latex")}
          className={`flex items-center gap-3 px-3 py-2.5 border-l-2 text-sm font-semibold transition-all cursor-pointer ${
            activeTab === "latex"
              ? "border-indigo-600 dark:border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 rounded-r-xl"
              : "border-transparent text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100/60 dark:hover:bg-zinc-900/40 hover:text-zinc-900 dark:hover:text-zinc-200 rounded-r-xl"
          }`}
        >
          <span className="font-serif font-bold italic text-[11px] leading-none shrink-0 w-5 flex items-center justify-center">f(x)</span>
          4. Mathematical LaTeX
        </button>

        <button
          onClick={() => setActiveTab("diagram")}
          className={`flex items-center gap-3 px-3 py-2.5 border-l-2 text-sm font-semibold transition-all cursor-pointer ${
            activeTab === "diagram"
              ? "border-indigo-600 dark:border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 rounded-r-xl"
              : "border-transparent text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100/60 dark:hover:bg-zinc-900/40 hover:text-zinc-900 dark:hover:text-zinc-200 rounded-r-xl"
          }`}
        >
          <GitBranch className="w-4 h-4" />
          5. Diagram Engine
        </button>

        <button
          onClick={() => { setActiveTab("flashcard"); setIsFlipped(false); }}
          className={`flex items-center gap-3 px-3 py-2.5 border-l-2 text-sm font-semibold transition-all cursor-pointer ${
            activeTab === "flashcard"
              ? "border-indigo-600 dark:border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 rounded-r-xl"
              : "border-transparent text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100/60 dark:hover:bg-zinc-900/40 hover:text-zinc-900 dark:hover:text-zinc-200 rounded-r-xl"
          }`}
        >
          <RotateCcw className="w-4 h-4" />
          6. Flip Flashcards
        </button>

        <button
          onClick={() => setActiveTab("diff")}
          className={`flex items-center gap-3 px-3 py-2.5 border-l-2 text-sm font-semibold transition-all cursor-pointer ${
            activeTab === "diff"
              ? "border-indigo-600 dark:border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 rounded-r-xl"
              : "border-transparent text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100/60 dark:hover:bg-zinc-900/40 hover:text-zinc-900 dark:hover:text-zinc-200 rounded-r-xl"
          }`}
        >
          <FileCode2 className="w-4 h-4" />
          7. Code Diff View
        </button>
      </div>

      {/* Main Content Showcase Panel */}
      <div className="flex-1 min-w-0 bg-white dark:bg-zinc-950 p-6 flex flex-col justify-between overflow-hidden relative">
        <div className="flex-1 flex flex-col min-h-0 w-full">
          {activeTab === "sandbox" && (
            <div className="h-full flex flex-col gap-4 flex-1 w-full">
              <div className="flex justify-between items-center pb-2 border-b border-zinc-100 dark:border-zinc-900 gap-4 w-full">
                <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate min-w-0">Sandpack JavaScript Executor</span>
                <button
                  onClick={handleRunCode}
                  disabled={isRunning}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg shadow-sm hover:shadow-md cursor-pointer transition-all active:scale-95 disabled:bg-indigo-400 shrink-0"
                >
                  {isRunning ? (
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Play className="w-3.5 h-3.5 fill-current" />
                  )}
                  Run Sandbox
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-[280px] md:h-[285px] min-h-0 w-full">
                {/* Code Window */}
                <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-[#0B0F19] p-4 overflow-auto font-mono text-[11px] text-zinc-300 leading-relaxed h-full shadow-inner">
                  <pre className="text-left select-none pointer-events-none">
                    <span className="text-zinc-500">{`// Fibonacci algorithm`}</span><br />
                    <span className="text-pink-400 font-medium">function</span> <span className="text-sky-400">fibonacci</span>(<span className="text-orange-400">n</span>) &#123;<br />
                    &nbsp;&nbsp;<span className="text-pink-400 font-medium">if</span> (n &lt;= <span className="text-amber-400">1</span>) <span className="text-pink-400 font-medium">return</span> n;<br />
                    &nbsp;&nbsp;<span className="text-pink-400 font-medium">return</span> <span className="text-sky-400">fibonacci</span>(n - <span className="text-amber-400">1</span>) + <span className="text-sky-400">fibonacci</span>(n - <span className="text-amber-400">2</span>);<br />
                    &#125;<br />
                    <span className="text-indigo-400">console</span>.<span className="text-teal-400">log</span>(<span className="text-emerald-400">&quot;Fibonacci(7):&quot;</span>, <span className="text-sky-400">fibonacci</span>(<span className="text-amber-400">7</span>));
                  </pre>
                </div>
                {/* Console Window */}
                <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/30 p-4 font-mono text-[11px] flex flex-col justify-between h-full min-h-0 overflow-hidden">
                  <div className="space-y-1.5 overflow-y-auto text-left flex-1 min-h-0">
                    <div className="text-zinc-400 dark:text-zinc-550">{"// Console logs output"}</div>
                    {runLogs.map((log, index) => (
                      <div
                        key={index}
                        className={
                          log.startsWith("Output:")
                            ? "text-emerald-600 dark:text-emerald-450 font-bold"
                            : log.startsWith("Process")
                            ? "text-zinc-400 dark:text-zinc-500"
                            : "text-zinc-700 dark:text-zinc-350"
                        }
                      >
                        {log}
                      </div>
                    ))}
                  </div>
                  <div className="h-4 flex items-center justify-end mt-1 shrink-0">
                    {runLogs.length > 0 && (
                      <button
                        onClick={() => setRunLogs([])}
                        className="text-[9px] font-bold text-zinc-400 hover:text-zinc-650 dark:text-zinc-500 dark:hover:text-zinc-350 transition-colors uppercase tracking-wider cursor-pointer"
                      >
                        Clear Console
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "array" && (
            <div className="h-full flex flex-col gap-4 flex-1 w-full">
              <div className="flex justify-between items-center pb-2 border-b border-zinc-100 dark:border-zinc-900 gap-4 w-full">
                <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate min-w-0">Interactive Data Array Visualizer</span>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={handlePush}
                    disabled={arrayElements.length >= 7}
                    className="flex items-center gap-1 px-2.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-950 text-xs font-semibold rounded-lg shadow-sm cursor-pointer transition-all active:scale-95 disabled:opacity-50 shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" /> Push
                  </button>
                  <button
                    onClick={handlePop}
                    disabled={arrayElements.length === 0}
                    className="flex items-center gap-1 px-2.5 py-1.5 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900 text-zinc-700 dark:text-zinc-300 text-xs font-semibold rounded-lg cursor-pointer transition-all active:scale-95 disabled:opacity-50 shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Pop
                  </button>
                </div>
              </div>

              <div className="h-[280px] md:h-[285px] flex flex-col justify-center items-center gap-6 p-4 w-full">
                <div className="h-24 flex items-center justify-center w-full">
                  <div className="flex flex-wrap gap-2.5 justify-center items-center h-20">
                    {arrayElements.length === 0 ? (
                      <div className="text-sm text-zinc-400 dark:text-zinc-500 font-medium py-2">Array is empty</div>
                    ) : (
                      arrayElements.map((val, idx) => (
                        <motion.div
                          key={idx}
                          layout
                          initial={{ scale: 0.8, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ type: "spring", stiffness: 300, damping: 20 }}
                          className="w-14 h-14 rounded-xl border border-zinc-300 dark:border-indigo-900/40 bg-zinc-50 dark:bg-indigo-950/20 flex flex-col items-center justify-center relative shadow-sm hover:shadow-md transition-all duration-300"
                        >
                          <span className="text-sm font-bold text-zinc-950 dark:text-indigo-200">{val}</span>
                          <span className="absolute -bottom-5 text-[10px] font-mono text-zinc-400 dark:text-zinc-500">[{idx}]</span>
                        </motion.div>
                      ))
                    )}
                  </div>
                </div>
                
                <div className="h-10 flex items-center justify-center w-full mt-2">
                  {arrayAction ? (
                    <motion.div
                      key={arrayAction}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-xs font-mono font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/50 px-3 py-1 rounded-md"
                    >
                      {arrayAction}
                    </motion.div>
                  ) : (
                    <span className="text-xs font-mono text-zinc-400 dark:text-zinc-600 opacity-0 select-none">Placeholder</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === "quiz" && (
            <div className="h-full flex flex-col gap-4 flex-1 w-full">
              <div className="pb-2 border-b border-zinc-100 dark:border-zinc-900 w-full">
                <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Structured Learning Quiz</span>
              </div>

              <div className="h-[280px] md:h-[285px] flex flex-col justify-between max-w-lg mx-auto w-full py-2 text-left">
                <div className="flex flex-col gap-3">
                  <h4 className="text-sm sm:text-base font-bold text-zinc-950 dark:text-white min-h-[44px] flex items-center leading-snug">
                    What is the average time complexity of searching in a Balanced Binary Search Tree?
                  </h4>
                  
                  <div className="flex flex-col gap-2">
                    {quizAnswers.map((answer, index) => {
                      const isSelected = selectedAnswer === index;
                      return (
                        <button
                          key={index}
                          onClick={() => setSelectedAnswer(index)}
                          className={`w-full flex items-center justify-between px-4 py-2 rounded-xl border text-xs sm:text-sm font-semibold transition-all text-left cursor-pointer ${
                            isSelected
                              ? answer.correct
                                ? "bg-emerald-50 border-emerald-500 dark:bg-emerald-950/20 dark:border-emerald-500 text-emerald-800 dark:text-emerald-400"
                                : "bg-rose-50 border-rose-500 dark:bg-rose-950/20 dark:border-rose-500 text-rose-800 dark:text-rose-400"
                              : "bg-zinc-50 dark:bg-zinc-900/30 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 text-zinc-700 dark:text-zinc-350"
                          }`}
                        >
                          <span>{answer.text}</span>
                          {isSelected && (
                            answer.correct ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                            ) : (
                              <XCircle className="w-4 h-4 text-rose-500 shrink-0" />
                            )
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="h-12 flex items-center mt-2 w-full shrink-0">
                  {selectedAnswer !== null ? (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className={`text-xs font-semibold ${
                        quizAnswers[selectedAnswer].correct
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-rose-600 dark:text-rose-400"
                      }`}
                    >
                      {quizAnswers[selectedAnswer].correct
                        ? "Correct! Balanced search trees maintain an O(log N) depth."
                        : "Incorrect. Recall that binary search partitions the search space in half at each step."}
                    </motion.p>
                  ) : (
                    <span className="text-xs font-semibold text-zinc-400 dark:text-zinc-600 opacity-0 select-none">Placeholder</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === "latex" && (
            <div className="h-full flex flex-col gap-4 flex-1 w-full">
              <div className="pb-2 border-b border-zinc-100 dark:border-zinc-900 w-full">
                <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Mathematical LaTeX Engine</span>
              </div>

              <div className="h-[280px] md:h-[285px] flex flex-col justify-center items-center p-4 w-full">
                <div className="bg-zinc-50 dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 sm:p-6 max-w-md w-full h-[220px] shadow-xs text-center flex flex-col items-center justify-between">
                  <div className="text-zinc-400 dark:text-zinc-500 text-[10px] font-mono uppercase tracking-wider select-none">LaTeX Formula Output</div>
                  <div className="text-2xl sm:text-3xl font-serif text-zinc-950 dark:text-zinc-100 select-all leading-normal py-2 font-normal tracking-wide italic flex items-center justify-center gap-1">
                    <span className="text-indigo-600 dark:text-indigo-400 font-normal">∫</span>
                    <span className="text-[11px] font-mono -ml-1.5 -mb-6 mr-1">a</span>
                    <span className="text-[11px] font-mono -ml-3.5 -mt-6 mr-2">b</span>
                    f(x)dx = F(b) - F(a)
                  </div>
                  <div className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed font-normal">
                    KaTeX-powered mathematical typesetting compiles static formula definitions into clean vector output inside the document tree.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── 5. Diagram Engine ─────────────────────────────────────── */}
          {activeTab === "diagram" && (
            <div className="h-full flex flex-col gap-3 flex-1 w-full">
              <div className="pb-2 border-b border-zinc-100 dark:border-zinc-900 w-full">
                <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Mermaid Diagram Engine</span>
              </div>
              <div className="h-[280px] md:h-[285px] flex items-center justify-center p-2 w-full overflow-hidden">
                <div className="flex flex-col items-center gap-0 select-none font-mono text-[11px] w-full max-w-[200px]">
                  {/* Start */}
                  <div className="px-7 py-1 rounded-full bg-indigo-600 text-white font-bold shadow-sm shadow-indigo-500/30">Start</div>
                  <div className="w-px h-3 bg-zinc-300 dark:bg-zinc-700" />
                  <div style={{ width: 0, height: 0, borderLeft: "4px solid transparent", borderRight: "4px solid transparent", borderTop: "6px solid #9ca3af" }} />
                  {/* Parse */}
                  <div className="w-full text-center py-1.5 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700/70 bg-white dark:bg-zinc-900/50 text-zinc-700 dark:text-zinc-300 font-medium">Parse Input Data</div>
                  <div className="w-px h-3 bg-zinc-300 dark:bg-zinc-700" />
                  <div style={{ width: 0, height: 0, borderLeft: "4px solid transparent", borderRight: "4px solid transparent", borderTop: "6px solid #9ca3af" }} />
                  {/* Diamond decision */}
                  <div className="relative flex items-center justify-center" style={{ width: 140, height: 54 }}>
                    <div
                      className="absolute bg-violet-50/60 dark:bg-violet-950/30 border border-violet-400 dark:border-violet-600"
                      style={{ width: 40, height: 40, transform: "rotate(45deg)" }}
                    />
                    <span className="relative z-10 text-[9px] font-bold text-violet-700 dark:text-violet-400 text-center leading-tight">
                      Is<br />Valid?
                    </span>
                    <span className="absolute right-0 text-[9px] font-semibold text-emerald-500" style={{ top: "48%", transform: "translateY(-50%)" }}>Yes →</span>
                  </div>
                  <div className="w-px h-3 bg-zinc-300 dark:bg-zinc-700" />
                  <div style={{ width: 0, height: 0, borderLeft: "4px solid transparent", borderRight: "4px solid transparent", borderTop: "6px solid #9ca3af" }} />
                  {/* Process */}
                  <div className="w-full text-center py-1.5 px-3 rounded-lg border border-indigo-200 dark:border-indigo-800/50 bg-indigo-50/40 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-300 font-medium">Process & Transform</div>
                  <div className="w-px h-3 bg-zinc-300 dark:bg-zinc-700" />
                  <div style={{ width: 0, height: 0, borderLeft: "4px solid transparent", borderRight: "4px solid transparent", borderTop: "6px solid #9ca3af" }} />
                  {/* End */}
                  <div className="px-7 py-1 rounded-full bg-teal-600 text-white font-bold shadow-sm shadow-teal-500/30">End</div>
                </div>
              </div>
            </div>
          )}

          {/* ── 6. Flip Flashcards ────────────────────────────────────── */}
          {activeTab === "flashcard" && (
            <div className="h-full flex flex-col gap-4 flex-1 w-full">
              <div className="flex justify-between items-center pb-2 border-b border-zinc-100 dark:border-zinc-900 w-full">
                <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Flip Flashcard Deck</span>
                <span className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500 bg-zinc-100 dark:bg-zinc-800/60 px-2 py-0.5 rounded">1 / 3</span>
              </div>
              <div className="h-[280px] md:h-[285px] flex flex-col items-center justify-center gap-5 p-4 w-full">
                <div
                  className="cursor-pointer"
                  style={{ perspective: "900px", width: 280, height: 145 }}
                  onClick={() => setIsFlipped((f) => !f)}
                >
                  <div
                    style={{
                      transformStyle: "preserve-3d",
                      transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
                      transition: "transform 0.55s cubic-bezier(0.4, 0.2, 0.2, 1)",
                      position: "relative",
                      width: "100%",
                      height: "100%",
                    }}
                  >
                    {/* Front */}
                    <div
                      style={{ backfaceVisibility: "hidden", position: "absolute", inset: 0 }}
                      className="rounded-2xl border border-zinc-200 dark:border-zinc-700/80 bg-gradient-to-br from-indigo-50 to-violet-50/30 dark:from-zinc-900 dark:to-indigo-950/30 flex flex-col items-center justify-center gap-2.5 p-5 shadow-lg"
                    >
                      <div className="text-[9px] font-bold uppercase tracking-widest text-indigo-400 dark:text-indigo-500">Question</div>
                      <p className="text-[12px] font-semibold text-zinc-900 dark:text-zinc-100 text-center leading-snug">
                        What is the average-case time complexity of a Hash Table lookup?
                      </p>
                      <div className="text-[10px] text-zinc-400 dark:text-zinc-600">Tap to reveal answer →</div>
                    </div>
                    {/* Back */}
                    <div
                      style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)", position: "absolute", inset: 0 }}
                      className="rounded-2xl border border-emerald-200/80 dark:border-emerald-800/60 bg-gradient-to-br from-emerald-50 to-teal-50/20 dark:from-emerald-950/20 dark:to-teal-950/20 flex flex-col items-center justify-center gap-2 p-5 shadow-lg"
                    >
                      <div className="text-[9px] font-bold uppercase tracking-widest text-emerald-500">Answer</div>
                      <p className="text-3xl font-black text-emerald-700 dark:text-emerald-400">O(1)</p>
                      <p className="text-[10.5px] text-zinc-600 dark:text-zinc-400 text-center leading-relaxed">
                        Hash tables use a hash function to map keys to indices, giving constant-time average lookup.
                      </p>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setIsFlipped((f) => !f)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-900/40 transition-all cursor-pointer active:scale-95"
                >
                  <RotateCcw className="w-3 h-3" />
                  Flip Card
                </button>
              </div>
            </div>
          )}

          {/* ── 7. Code Diff View ─────────────────────────────────────── */}
          {activeTab === "diff" && (
            <div className="h-full flex flex-col gap-4 flex-1 w-full">
              <div className="flex justify-between items-center pb-2 border-b border-zinc-100 dark:border-zinc-900 w-full">
                <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Code Diff Viewer</span>
                <span className="text-[10px] font-mono bg-zinc-100 dark:bg-zinc-800/60 text-zinc-500 dark:text-zinc-400 px-2 py-0.5 rounded-md">
                  <span className="text-emerald-600 dark:text-emerald-400">+4</span>{" / "}<span className="text-red-500">-3</span>
                </span>
              </div>
              <div className="h-[280px] md:h-[285px] w-full overflow-hidden">
                <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-[#0B0F19] h-full overflow-auto p-4 font-mono text-[11px] leading-[1.75]">
                  <div className="text-zinc-500 mb-2 text-[10px] select-none">{"@@ -12,8 +12,9 @@ class BinarySearch:"}</div>
                  <div className="text-zinc-400">{"  def __init__(self, data):"}</div>
                  <div className="text-zinc-400">{"    self.data = sorted(data)"}</div>
                  <div className="flex gap-1.5 items-start">
                    <span className="text-red-400 font-bold select-none shrink-0">-</span>
                    <span className="bg-red-500/10 text-red-400 px-1 rounded-sm flex-1">{"  def find(self, target):"}</span>
                  </div>
                  <div className="flex gap-1.5 items-start">
                    <span className="text-red-400 font-bold select-none shrink-0">-</span>
                    <span className="bg-red-500/10 text-red-400 px-1 rounded-sm flex-1">{"    for i, v in enumerate(self.data):"}</span>
                  </div>
                  <div className="flex gap-1.5 items-start">
                    <span className="text-red-400 font-bold select-none shrink-0">-</span>
                    <span className="bg-red-500/10 text-red-400 px-1 rounded-sm flex-1">{"      if v == target: return i"}</span>
                  </div>
                  <div className="flex gap-1.5 items-start">
                    <span className="text-emerald-400 font-bold select-none shrink-0">+</span>
                    <span className="bg-emerald-500/10 text-emerald-400 px-1 rounded-sm flex-1">{"  def find(self, target) -> int:"}</span>
                  </div>
                  <div className="flex gap-1.5 items-start">
                    <span className="text-emerald-400 font-bold select-none shrink-0">+</span>
                    <span className="bg-emerald-500/10 text-emerald-400 px-1 rounded-sm flex-1">{"    lo, hi = 0, len(self.data) - 1"}</span>
                  </div>
                  <div className="flex gap-1.5 items-start">
                    <span className="text-emerald-400 font-bold select-none shrink-0">+</span>
                    <span className="bg-emerald-500/10 text-emerald-400 px-1 rounded-sm flex-1">{"    while lo <= hi:"}</span>
                  </div>
                  <div className="flex gap-1.5 items-start">
                    <span className="text-emerald-400 font-bold select-none shrink-0">+</span>
                    <span className="bg-emerald-500/10 text-emerald-400 px-1 rounded-sm flex-1">{"      mid = (lo + hi) // 2"}</span>
                  </div>
                  <div className="text-zinc-400">{"      if self.data[mid] == target: return mid"}</div>
                  <div className="text-zinc-400">{"    return -1"}</div>
                </div>
              </div>
            </div>
          )}

        </div>
        
        {/* Footer of the showcase mockup */}
        <div className="flex items-center justify-between pt-3 border-t border-zinc-100 dark:border-zinc-900 text-[10px] text-zinc-400 dark:text-zinc-500 font-medium mt-auto w-full">
          <span>Target Component: {activeTab.toUpperCase()}</span>
          <span>100% Client-Side Rendered</span>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <HomeAuthProvider>
      <div className="min-h-screen bg-[#fafafa] dark:bg-[#030712] text-gray-900 dark:text-gray-100 selection:bg-indigo-500/30 font-sans flex flex-col">
        {/* Navbar */}
        <AppNavbar
          actions={
            <div className="flex items-center gap-4">
              <HomeNavSignIn />
            </div>
          }
        />

        {/* ── Hero Section ────────────────────────────────────────────────── */}
        <section
          className="relative min-h-[90vh] flex flex-col justify-center items-center overflow-hidden pt-20 pb-32"
        >
          {/* Animated Background Mesh - Premium Lighting */}
          <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
            {/* Subtle, refined centered ambient light */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[80vw] max-w-5xl aspect-[2/1] opacity-25 dark:opacity-15 bg-[radial-gradient(circle_at_center,var(--tw-gradient-stops))] from-indigo-500/20 via-violet-500/5 to-transparent blur-[100px]" />

            {/* Refined Responsive Grid Pattern */}
            <div
              className="absolute inset-0 opacity-[0.06] dark:opacity-[0.02] text-zinc-950 dark:text-white"
              style={{
                backgroundImage:
                  "linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)",
                backgroundSize: "64px 64px",
                maskImage:
                  "radial-gradient(ellipse 60% 60% at 50% 50%, #000 40%, transparent 100%)",
                WebkitMaskImage:
                  "radial-gradient(ellipse 60% 60% at 50% 50%, #000 40%, transparent 100%)",
              }}
            />
          </div>

          <motion.div
            className="relative z-10 max-w-5xl mx-auto px-6 text-center"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {/* Pill */}
            <motion.div
              variants={itemVariants}
              className="flex justify-center mb-8"
            >
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/60 dark:bg-gray-900/40 backdrop-blur-md border border-gray-200/50 dark:border-gray-800/50 text-sm font-semibold text-gray-700 dark:text-gray-300 shadow-xs shadow-indigo-500/5 hover:scale-102 transition-all cursor-default">
                <Sparkles className="w-4 h-4 text-indigo-500" />
                <span className="bg-linear-to-r from-indigo-500 to-fuchsia-500 bg-clip-text text-transparent">
                  Next-Gen Learning Space
                </span>
              </span>
            </motion.div>

            {/* Headline */}
            <motion.h1
              variants={itemVariants}
              className="text-6xl sm:text-8xl font-black tracking-tighter leading-none text-gray-950 dark:text-white mb-8"
            >
              Explore. Code. <br className="hidden sm:block" />
              <span className="relative inline-block text-transparent bg-clip-text bg-linear-to-r from-indigo-500 via-violet-500 to-fuchsia-500">
                Master Everything.
              </span>
            </motion.h1>

            {/* Sub */}
            <motion.p
              variants={itemVariants}
              className="max-w-2xl mx-auto text-xl text-gray-600 dark:text-gray-400 font-medium leading-relaxed mb-12"
            >
              The most advanced, power-packed open-source content viewer. Live
              sandboxes, complex quizzes, embedded LaTeX, and visually rich
              tools—rendered instantly.
            </motion.p>

            {/* CTAs */}
            <motion.div
              variants={itemVariants}
              className="flex flex-col sm:flex-row items-center justify-center gap-6"
            >
              <HomeHeroCTA />
              <HomePwaInstallButton />
              <Link
                href="/about"
                prefetch={false}
                className="group flex items-center gap-2 text-gray-600 dark:text-gray-400 font-semibold hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                Discover the architecture
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </motion.div>
          </motion.div>
        </section>

        {/* ── Interactive Showcase Panel ─────────────────────────────────── */}
        <section className="w-full relative z-20 mt-8 max-w-5xl mx-auto px-6 mb-16">
          <InteractiveShowcase />
        </section>

        {/* ── Floating Stats Banner ───────────────────────────────────────── */}
        <section className="relative z-20 max-w-4xl mx-auto px-6">
          <div
            className="flex flex-col sm:flex-row justify-between items-center rounded-2xl bg-white/60 dark:bg-zinc-950/40 backdrop-blur-xl border border-zinc-200/80 dark:border-zinc-900/80 p-2 shadow-lg divide-y sm:divide-y-0 sm:divide-x divide-zinc-200/40 dark:divide-zinc-900/50"
          >
            {stats.map(({ value, label }) => (
              <div key={label} className="w-full text-center px-8 py-5 sm:py-3">
                <div className="text-3xl font-bold text-zinc-950 dark:text-zinc-50 tracking-tight tabular-nums">
                  {value}
                </div>
                <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mt-1 uppercase tracking-wider">
                  {label}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Bento Features ──────────────────────────────────────────────── */}
        <section className="py-32 relative">
          <div className="max-w-6xl mx-auto px-6">
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-extrabold text-gray-900 dark:text-white tracking-tight mb-4">
                Engineered for deep learning
              </h2>
              <p className="text-lg text-zinc-500 dark:text-zinc-400 max-w-2xl mx-auto font-medium">
                We&apos;ve combined the velocity of modern web capabilities with
                a meticulously crafted educational toolkit.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
              {/* Bento Item 1: Live Execution (Wide) */}
              <div className="group md:col-span-2 relative rounded-2xl bg-white/60 dark:bg-zinc-950/40 backdrop-blur-xl border border-zinc-200/80 dark:border-zinc-900/80 p-8 shadow-md hover:border-zinc-300 dark:hover:border-zinc-700 hover:bg-white/80 dark:hover:bg-zinc-900/50 transition-all duration-300 flex flex-col justify-between overflow-hidden gap-6 hover:-translate-y-1 hover:shadow-xl">
                <div>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-6 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 group-hover:border-indigo-500/50 dark:group-hover:border-indigo-400/50 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-all duration-300">
                    <TerminalSquare strokeWidth={1.5} className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-zinc-950 dark:text-white text-lg mb-2">Live Code Execution</h3>
                  <p className="text-sm text-zinc-605 dark:text-zinc-400 leading-relaxed font-normal max-w-xl">
                    Sandpack-powered client side execution. Write, compile, and execute code entirely in the web browser instantly with no backend latency.
                  </p>
                </div>
                
                {/* Visual Preview */}
                <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-[#0B0F19] p-4 font-mono text-[10px] text-zinc-300 select-none pointer-events-none relative overflow-hidden h-36 flex flex-col justify-between shadow-inner">
                  <div className="flex items-center gap-1.5 pb-2 border-b border-zinc-800/80 mb-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                    <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
                    <span className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
                    <span className="text-[9px] font-semibold text-zinc-550 ml-2 font-mono uppercase tracking-wider">App.js</span>
                  </div>
                  <div className="space-y-0.5 flex-1">
                    <div><span className="text-zinc-650">1</span>&nbsp;&nbsp;<span className="text-pink-400">import</span> React <span className="text-pink-400">from</span> <span className="text-emerald-400">&quot;react&quot;</span>;</div>
                    <div><span className="text-zinc-650">2</span>&nbsp;&nbsp;<span className="text-pink-400">export default function</span> <span className="text-sky-400">App</span>() &#123;</div>
                    <div><span className="text-zinc-650">3</span>&nbsp;&nbsp;&nbsp;&nbsp;<span className="text-pink-400">return</span> &lt;<span className="text-sky-400">div</span>&gt;Hello Sandbox!&lt;/<span className="text-sky-400">div</span>&gt;;</div>
                    <div><span className="text-zinc-650">4</span>&nbsp;&nbsp;&#125;</div>
                  </div>
                  <div className="text-[9px] text-emerald-400 border-t border-zinc-805/80 pt-2 flex justify-between items-center">
                    <span>● App mounted successfully in 12ms</span>
                    <span className="text-[8px] uppercase tracking-wider text-zinc-500">Live</span>
                  </div>
                </div>
              </div>

              {/* Bento Item 2: Smart Quizzes (Standard) */}
              <div className="group md:col-span-1 relative rounded-2xl bg-white/60 dark:bg-zinc-950/40 backdrop-blur-xl border border-zinc-200/80 dark:border-zinc-900/80 p-8 shadow-md hover:border-zinc-300 dark:hover:border-zinc-700 hover:bg-white/80 dark:hover:bg-zinc-900/50 transition-all duration-300 flex flex-col justify-between overflow-hidden gap-6 hover:-translate-y-1 hover:shadow-xl">
                <div>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-6 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 group-hover:border-indigo-500/50 dark:group-hover:border-indigo-400/50 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-all duration-300">
                    <Lightbulb strokeWidth={1.5} className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-zinc-950 dark:text-white text-lg mb-2">Smart Quizzes</h3>
                  <p className="text-sm text-zinc-605 dark:text-zinc-400 leading-relaxed font-normal">
                    Drag-and-drop permutations, multiple choice layouts, and instant feedback algorithms that adapt to your speed.
                  </p>
                </div>
                
                {/* Visual Preview */}
                <div className="flex flex-col gap-2 select-none pointer-events-none h-36 justify-center">
                  <div className="px-3 py-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400 text-xs font-semibold flex items-center justify-between shadow-xs">
                    <span className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      O(log N) Time Complexity
                    </span>
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  </div>
                  <div className="px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/30 text-zinc-500 dark:text-zinc-400 text-xs font-semibold flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-zinc-300 dark:bg-zinc-700" />
                      O(N) Time Complexity
                    </span>
                  </div>
                </div>
              </div>

              {/* Bento Item 3: Mathematical Rendering (Standard) */}
              <div className="group md:col-span-1 relative rounded-2xl bg-white/60 dark:bg-zinc-950/40 backdrop-blur-xl border border-zinc-200/80 dark:border-zinc-900/80 p-8 shadow-md hover:border-zinc-300 dark:hover:border-zinc-700 hover:bg-white/80 dark:hover:bg-zinc-900/50 transition-all duration-300 flex flex-col justify-between overflow-hidden gap-6 hover:-translate-y-1 hover:shadow-xl">
                <div>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-6 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 group-hover:border-indigo-500/50 dark:group-hover:border-indigo-400/50 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-all duration-300">
                    <span className="font-serif font-bold italic text-sm leading-none">f(x)</span>
                  </div>
                  <h3 className="font-bold text-zinc-950 dark:text-white text-lg mb-2">Math & Typesetting</h3>
                  <p className="text-sm text-zinc-605 dark:text-zinc-400 leading-relaxed font-normal">
                    KaTeX formula rendering compiles math expressions dynamically, providing gorgeous math blocks without layout shifts.
                  </p>
                </div>
                
                {/* Visual Preview */}
                <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/30 p-4 font-serif text-center text-zinc-850 dark:text-zinc-200 select-none pointer-events-none h-36 flex flex-col justify-center gap-1.5 shadow-xs">
                  <div className="text-sm sm:text-base font-normal tracking-wide italic flex items-center justify-center gap-0.5">
                    T = 2π
                    <span className="text-zinc-400 dark:text-zinc-600 font-sans mx-0.5">√</span>
                    <div className="flex flex-col inline-flex -mb-1 text-[11px] font-sans">
                      <span className="border-b border-zinc-800 dark:border-zinc-350 pb-0.5 px-0.5">L</span>
                      <span className="pt-0.5 px-0.5">g</span>
                    </div>
                  </div>
                  <div className="text-[9px] font-mono text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mt-1">Simple Pendulum Period</div>
                </div>
              </div>

              {/* Bento Item 4: Rich Visual Engine (Wide) */}
              <div className="group md:col-span-2 relative rounded-2xl bg-white/60 dark:bg-zinc-950/40 backdrop-blur-xl border border-zinc-200/80 dark:border-zinc-900/80 p-8 shadow-md hover:border-zinc-300 dark:hover:border-zinc-700 hover:bg-white/80 dark:hover:bg-zinc-900/50 transition-all duration-300 flex flex-col justify-between overflow-hidden gap-6 hover:-translate-y-1 hover:shadow-xl">
                <div>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-6 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 group-hover:border-indigo-500/50 dark:group-hover:border-indigo-400/50 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-all duration-300">
                    <Layers strokeWidth={1.5} className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-zinc-950 dark:text-white text-lg mb-2">Rich Visual Engine</h3>
                  <p className="text-sm text-zinc-605 dark:text-zinc-400 leading-relaxed font-normal max-w-xl">
                    Canvas animations, Graphviz vectors, DrawIO diagrams, tree structures, and markdown arrays render side-by-side with zero latency.
                  </p>
                </div>
                
                {/* Visual Preview */}
                <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/30 p-3 select-none pointer-events-none relative h-36 flex justify-center items-center overflow-hidden shadow-inner">
                  {/* Tech grid dot pattern */}
                  <div 
                    className="absolute inset-0 opacity-[0.15] dark:opacity-[0.1]" 
                    style={{
                      backgroundImage: "radial-gradient(circle, currentColor 1px, transparent 1px)",
                      backgroundSize: "8px 8px",
                    }}
                  />
                  {/* Mock node diagram */}
                  <div className="flex items-center gap-3 relative z-10">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 dark:bg-indigo-950/30 border border-indigo-500 text-indigo-600 dark:text-indigo-400 text-xs font-bold flex flex-col items-center justify-center shadow-md shadow-indigo-500/10">
                      <span>Root</span>
                      <span className="text-[8px] font-mono text-indigo-500/70 -mt-0.5">#0</span>
                    </div>
                    <div className="flex flex-col gap-1 items-center">
                      <div className="w-8 h-[2px] bg-linear-to-r from-indigo-500 to-zinc-300 dark:to-zinc-700" />
                      <span className="text-[8px] font-mono text-zinc-400 dark:text-zinc-555">push</span>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 text-xs font-bold flex flex-col items-center justify-center shadow-xs">
                      <span>NodeA</span>
                      <span className="text-[8px] font-mono text-zinc-500 -mt-0.5">#1</span>
                    </div>
                    <div className="flex flex-col gap-1 items-center">
                      <div className="w-8 h-[2px] bg-linear-to-r from-zinc-300 dark:from-zinc-700 to-zinc-300 dark:to-zinc-800" />
                      <span className="text-[8px] font-mono text-zinc-400 dark:text-zinc-555">pop</span>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 text-xs font-bold flex flex-col items-center justify-center shadow-xs opacity-60">
                      <span>NodeB</span>
                      <span className="text-[8px] font-mono text-zinc-500 -mt-0.5">#2</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Component Taxonomy Grid ────────────────────────────────────── */}
        <section id="components" className="py-24 bg-zinc-50/60 dark:bg-[#060a13]/40 border-y border-zinc-200 dark:border-zinc-900/80">
          <div className="max-w-5xl mx-auto px-6 mb-16 text-center">
            <h2 className="text-3xl md:text-4xl font-extrabold text-zinc-950 dark:text-white mb-3 tracking-tight">
              A Complete Educational Component Suite
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium max-w-xl mx-auto">
              Over 50+ custom, production-grade components engineered for high-performance interactive learning.
            </p>
          </div>

          <div className="max-w-6xl mx-auto px-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* Category 1 */}
            <div className="group/card rounded-2xl border border-zinc-200/50 dark:border-zinc-800/50 bg-white/40 dark:bg-zinc-950/20 backdrop-blur-md p-6 shadow-xs hover:shadow-md hover:border-indigo-500/30 transition-all duration-300">
              <div className="flex items-center gap-2 pb-3 border-b border-zinc-200/50 dark:border-zinc-800/50 mb-4">
                <Code2 className="w-4 h-4 text-indigo-500" />
                <h3 className="text-xs font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">Runtimes & Editors</h3>
              </div>
              <ul className="flex flex-col gap-2">
                {["Sandpack", "WebpackBin", "RunJS", "Editor Code", "Notepad"].map(name => (
                  <li key={name} className="group/item flex items-center gap-2.5 text-xs font-semibold text-zinc-650 dark:text-zinc-400 hover:text-zinc-955 dark:hover:text-zinc-200 transition-colors py-1 cursor-default">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500/60 dark:bg-indigo-450/60 group-hover/item:scale-125 transition-transform" />
                    <span className="group-hover/item:translate-x-0.5 transition-transform">{name}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Category 2 */}
            <div className="group/card rounded-2xl border border-zinc-200/50 dark:border-zinc-800/50 bg-white/40 dark:bg-zinc-950/20 backdrop-blur-md p-6 shadow-xs hover:shadow-md hover:border-violet-500/30 transition-all duration-300">
              <div className="flex items-center gap-2 pb-3 border-b border-zinc-200/50 dark:border-zinc-800/50 mb-4">
                <Lightbulb className="w-4 h-4 text-violet-500" />
                <h3 className="text-xs font-bold uppercase tracking-widest text-violet-600 dark:text-violet-400">Quizzes & Q&A</h3>
              </div>
              <ul className="flex flex-col gap-2">
                {["Quiz", "Structured Quiz", "Permutation", "Match Answers", "CodeTest"].map(name => (
                  <li key={name} className="group/item flex items-center gap-2.5 text-xs font-semibold text-zinc-650 dark:text-zinc-400 hover:text-zinc-955 dark:hover:text-zinc-200 transition-colors py-1 cursor-default">
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-500/60 dark:bg-violet-405/60 group-hover/item:scale-125 transition-transform" />
                    <span className="group-hover/item:translate-x-0.5 transition-transform">{name}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Category 3 */}
            <div className="group/card rounded-2xl border border-zinc-200/50 dark:border-zinc-800/50 bg-white/40 dark:bg-zinc-950/20 backdrop-blur-md p-6 shadow-xs hover:shadow-md hover:border-fuchsia-500/30 transition-all duration-300">
              <div className="flex items-center gap-2 pb-3 border-b border-zinc-200/50 dark:border-zinc-800/50 mb-4">
                <Hash className="w-4 h-4 text-fuchsia-500" />
                <h3 className="text-xs font-bold uppercase tracking-widest text-fuchsia-600 dark:text-fuchsia-400">Data Structures</h3>
              </div>
              <ul className="flex flex-col gap-2">
                {["Interactive Array", "Matrix", "NaryTree", "LinkedList", "Graphviz", "BinaryTree", "Stack"].map(name => (
                  <li key={name} className="group/item flex items-center gap-2.5 text-xs font-semibold text-zinc-650 dark:text-zinc-400 hover:text-zinc-955 dark:hover:text-zinc-200 transition-colors py-1 cursor-default">
                    <span className="w-1.5 h-1.5 rounded-full bg-fuchsia-500/60 dark:bg-fuchsia-405/60 group-hover/item:scale-125 transition-transform" />
                    <span className="group-hover/item:translate-x-0.5 transition-transform">{name}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Category 4 */}
            <div className="group/card rounded-2xl border border-zinc-200/50 dark:border-zinc-800/50 bg-white/40 dark:bg-zinc-950/20 backdrop-blur-md p-6 shadow-xs hover:shadow-md hover:border-emerald-500/30 transition-all duration-300">
              <div className="flex items-center gap-2 pb-3 border-b border-zinc-200/50 dark:border-zinc-800/50 mb-4">
                <Sparkles className="w-4 h-4 text-emerald-500" />
                <h3 className="text-xs font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Rich Rendering</h3>
              </div>
              <ul className="flex flex-col gap-2">
                {["LaTeX Math", "Canvas Animation", "Draw IO", "Spoiler", "Markdown Layouts", "InstaCalc", "Video Player", "Chart"].map(name => (
                  <li key={name} className="group/item flex items-center gap-2.5 text-xs font-semibold text-zinc-650 dark:text-zinc-400 hover:text-zinc-955 dark:hover:text-zinc-200 transition-colors py-1 cursor-default">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/60 dark:bg-emerald-450/60 group-hover/item:scale-125 transition-transform" />
                    <span className="group-hover/item:translate-x-0.5 transition-transform">{name}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* ── Bottom CTA ─────────────────────────────────────────────────── */}
        <section className="py-32 relative overflow-hidden">
          {/* subtle background glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[50vw] max-w-xl aspect-square bg-indigo-500/5 dark:bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none" />

          <div className="relative z-10 px-6 text-center">
            <HomeBottomCTA />
          </div>
        </section>

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <footer className="border-t border-zinc-200/50 dark:border-zinc-900/50 bg-white/40 dark:bg-[#030712]/40 backdrop-blur-md">
          <div className="max-w-6xl mx-auto px-6 py-16">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-10 md:gap-8 pb-12 border-b border-zinc-200/50 dark:border-zinc-900/50">
              
              {/* Brand & Tagline */}
              <div className="md:col-span-4 flex flex-col gap-4">
                <div className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-indigo-500 fill-indigo-500/20" />
                  <span className="font-bold text-zinc-950 dark:text-white tracking-tight">
                    Edu-Viewer <span className="text-indigo-500">PRO</span>
                  </span>
                </div>
                <p className="text-xs text-zinc-550 dark:text-zinc-400 leading-relaxed">
                  A high-performance offline content viewer for developer documentation, code playpens, and interactive course components.
                </p>
              </div>

              {/* Navigation */}
              <div className="md:col-span-2 flex flex-col gap-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-950 dark:text-zinc-300">Navigation</h4>
                <ul className="flex flex-col gap-2">
                  <li>
                    <Link href="/" className="text-xs text-zinc-550 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors font-medium">
                      Home
                    </Link>
                  </li>
                  <li>
                    <Link href="/about" className="text-xs text-zinc-550 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors font-medium">
                      About Project
                    </Link>
                  </li>
                  <li>
                    <Link href="/dashboard" className="text-xs text-zinc-550 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors font-medium">
                      Dashboard
                    </Link>
                  </li>
                </ul>
              </div>

              {/* Resources */}
              <div className="md:col-span-2 flex flex-col gap-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-950 dark:text-zinc-300">Resources</h4>
                <ul className="flex flex-col gap-2">
                  <li>
                    <a href="https://github.com/Biraj2004/educative-viewer" target="_blank" rel="noopener noreferrer" className="group inline-flex items-center gap-1 text-xs text-zinc-550 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors font-medium">
                      GitHub Repository
                      <ExternalLink className="w-3 h-3 opacity-60 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                    </a>
                  </li>
                  <li>
                    <a href="https://educative-viewer-guide.vercel.app/" target="_blank" rel="noopener noreferrer" className="group inline-flex items-center gap-1 text-xs text-zinc-550 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors font-medium">
                      Setup Guide
                      <ExternalLink className="w-3 h-3 opacity-60 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                    </a>
                  </li>
                </ul>
              </div>

              {/* Disclaimer */}
              <div className="md:col-span-4 flex flex-col gap-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-950 dark:text-zinc-300">Disclaimer</h4>
                <p className="text-xs text-zinc-550 dark:text-zinc-400 leading-relaxed font-normal">
                  Edu-Viewer PRO is an independent open-source client viewer. It is not affiliated with, authorized, or endorsed by any proprietary course hosting platforms.
                </p>
              </div>

            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-8 text-xs font-medium text-zinc-500 dark:text-zinc-500">
              <div>
                © 2026 Crafted with precision. Open-source under the MIT License.
              </div>
              <div className="flex items-center gap-4">
                <span>v1.0.193</span>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </HomeAuthProvider>
  );
}
