"use client";

import React, { useState } from "react";

export interface CodeDrawingData {
  comp_id: string;
  content: string;
  entryFileName: string;
  language: string;
  isCodeDrawing: boolean;
  caption?: string;
  runnable?: boolean;
  allowDownload?: boolean;
}

export default function CodeDrawing({ data }: { data: CodeDrawingData }) {
  // We represent it like a split editor:
  // - Top: Monaco UI reusing the <Code> block we already have
  // - Bottom: Output "Drawing" mockup which triggers after 'Running'

  const [hasRun, setHasRun] = useState(false);

  return (
    <div className="w-full max-w-4xl mx-auto rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden bg-gray-50 dark:bg-gray-950 shadow-sm flex flex-col">
      
      {/* Relying on the generic standard viewer for Code execution since structurally they match Monaco interfaces perfectly. */}
      {/* 
          Note: Since the "Code" component doesn't inherently support overriding "Run" properly out-of-the-box inside out, 
          we render the Editor manually for absolute layout match.
      */}
      
      <div className="border-b border-gray-200 dark:border-gray-800 font-sans">
        <div className="flex justify-between items-center px-4 py-3 bg-white dark:bg-[#0f172a]">
           <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
             <CodeIcon />
             {data.entryFileName}
           </div>
           
           <div className="flex items-center gap-3">
             <span className="text-xs text-gray-500 dark:text-gray-400 font-mono bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
               {data.language === "pythondrawing" ? "Python (Diagrams)" : data.language}
             </span>
             <button title="Reset" onClick={() => setHasRun(false)} className="flex items-center gap-1.5 px-3 py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-gray-600 dark:text-gray-300 text-xs font-semibold rounded shadow-sm cursor-pointer">
               <ResetIcon /> Reset
             </button>
             <button title="Run Drawing" onClick={() => setHasRun(true)} className="flex items-center gap-1.5 px-3 py-1 bg-indigo-600 hover:bg-indigo-700 transition-colors text-white text-xs font-semibold rounded shadow-sm cursor-pointer border border-indigo-700">
               <PlayIcon /> Run
             </button>
           </div>
        </div>
        
        {/* Editor Area Mock */}
        <div className="bg-[#1e1e1e] p-4 text-gray-300 font-mono text-sm leading-relaxed overflow-x-auto">
          <pre>{data.content}</pre>
        </div>
      </div>

      <div className="flex-1 bg-white dark:bg-gray-900 p-6 min-h-75 flex flex-col items-center justify-center">
         {!hasRun ? (
           <div className="text-gray-400 dark:text-gray-500 text-sm italic flex flex-col items-center gap-2">
             <svg className="w-8 h-8 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
             Run the code to generate the architecture diagram.
           </div>
         ) : (
           <div className="flex flex-col items-center gap-4 animate-in fade-in duration-500">
             <div className="w-full flex justify-between text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2 border-b border-gray-100 dark:border-gray-800 pb-2">
                <span>Output Data</span>
                <span className="text-green-500 border border-green-500/20 bg-green-500/10 px-2 py-0.5 rounded">Success</span>
             </div>
             
             {/* Mock visual layout matching the basic python diagram output */}
             <div className="flex items-center gap-8 py-8 border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-12 rounded-lg shadow-sm">
                 <div className="flex flex-col items-center gap-2">
                   <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/50 rounded flex items-center justify-center border-2 border-blue-500 shadow-sm text-blue-700 dark:text-blue-400 font-bold border-dashed">LB</div>
                   <span className="text-xs font-mono text-gray-500 dark:text-gray-400">lb (ELB)</span>
                 </div>
                 <div className="text-gray-400"><ArrowRight /></div>
                 
                 <div className="flex flex-col items-center gap-2">
                   <div className="w-16 h-16 bg-orange-100 dark:bg-orange-900/50 rounded flex items-center justify-center border-2 border-orange-500 shadow-sm text-orange-700 dark:text-orange-400 font-bold border-dashed">WEB</div>
                   <span className="text-xs font-mono text-gray-500 dark:text-gray-400">web (EC2)</span>
                 </div>
                 <div className="text-gray-400"><ArrowRight /></div>
                 
                 <div className="flex flex-col items-center gap-2">
                   <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900/50 rounded flex items-center justify-center border-2 border-purple-500 shadow-sm text-purple-700 dark:text-purple-400 font-bold border-dashed">DB</div>
                   <span className="text-xs font-mono text-gray-500 dark:text-gray-400">userdb (RDS)</span>
                 </div>
             </div>
           </div>
         )}
      </div>

    </div>
  );
}

function PlayIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <path d="M5 3l14 9-14 9V3z" />
    </svg>
  );
}

function CodeIcon() {
  return (
    <svg className="w-4 h-4 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  );
}

function ArrowRight() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
    </svg>
  );
}

function ResetIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  );
}
