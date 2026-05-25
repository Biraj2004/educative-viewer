"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";

interface Props {
  onClose: () => void;
}

const SHORTCUTS: Array<{ keys: string[]; description: string; context?: string }> = [
  { keys: ["?"], description: "Open this shortcuts reference" },
  { keys: ["Ctrl", "Shift", "H"], description: "Highlight selected text", context: "Topic reader" },
  { keys: ["Alt", "←"], description: "Navigate to previous topic", context: "Topic reader" },
  { keys: ["Alt", "→"], description: "Navigate to next topic", context: "Topic reader" },
  { keys: ["Esc"], description: "Close open drawers or modals" },
];

function Kbd({ children }: { children: string }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[1.75rem] h-7 px-1.5 rounded-md border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-[11px] font-mono font-semibold shadow-sm">
      {children}
    </kbd>
  );
}

export default function KeyboardShortcutsModal({ onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  const modal = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
      aria-label="Keyboard shortcuts"
    >
      <div
        className="w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <rect x="2" y="6" width="20" height="12" rx="2" />
              <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8" strokeLinecap="round" />
            </svg>
            <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">Keyboard Shortcuts</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <ul className="divide-y divide-gray-100 dark:divide-gray-800">
          {SHORTCUTS.map((s, i) => (
            <li key={i} className="flex items-center justify-between gap-4 px-6 py-3.5">
              <div>
                <p className="text-sm text-gray-800 dark:text-gray-200">{s.description}</p>
                {s.context && (
                  <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">{s.context}</p>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {s.keys.map((k, ki) => (
                  <span key={ki} className="flex items-center gap-1">
                    <Kbd>{k}</Kbd>
                    {ki < s.keys.length - 1 && (
                      <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">+</span>
                    )}
                  </span>
                ))}
              </div>
            </li>
          ))}
        </ul>

        <div className="px-6 py-3 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-800">
          <p className="text-[11px] text-gray-400 dark:text-gray-500 text-center">
            Press <Kbd>?</Kbd> anywhere (outside a text field) to open this panel
          </p>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
