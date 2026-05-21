"use client";

import { useState, useEffect, useRef } from "react";

interface FontSettings {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  fontWeight: string;
}

const DEFAULT_SETTINGS: FontSettings = {
  fontFamily: "system-ui, sans-serif",
  fontSize: 15, // matches tailwind text-[15px] in content
  lineHeight: 1.8,
  fontWeight: "normal",
};

export default function FontManager({ inline = false }: { inline?: boolean }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [settings, setSettings] = useState<FontSettings>(DEFAULT_SETTINGS);

  const isFirstRender = useRef(true);

  // Load from local storage on mount
  useEffect(() => {
    const saved = localStorage.getItem("edu_font_settings");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSettings({ ...DEFAULT_SETTINGS, ...parsed });
      } catch (e) {}
    }
  }, []);

  // Save to local storage on change
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    localStorage.setItem("edu_font_settings", JSON.stringify(settings));
    window.dispatchEvent(new Event("edu_font_sync"));
  }, [settings]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  const updateSetting = <K extends keyof FontSettings>(key: K, value: FontSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const fonts = [
    { label: "System Default", value: "system-ui, sans-serif" },
    { label: "Inter", value: "'Inter', sans-serif" },
    { label: "Roboto", value: "'Roboto', sans-serif" },
    { label: "Open Sans", value: "'Open Sans', sans-serif" },
    { label: "Helvetica", value: "'Helvetica Neue', Helvetica, Arial, sans-serif" },
    { label: "Verdana", value: "Verdana, Geneva, sans-serif" },
    { label: "Atkinson Hyperlegible", value: "'Atkinson Hyperlegible', sans-serif" },
    { label: "Default Serif", value: "Georgia, Cambria, 'Times New Roman', Times, serif" },
    { label: "Merriweather", value: "'Merriweather', serif" },
    { label: "Lora", value: "'Lora', serif" },
    { label: "Default Mono", value: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" },
    { label: "Fira Code", value: "'Fira Code', monospace" },
  ];

  const styleTag = (
    <style suppressHydrationWarning>{`
      .topic-content-wrapper *:not(pre):not(code):not(.font-mono):not(svg):not(path) {
         font-family: ${settings.fontFamily} !important;
      }
      .topic-content-wrapper p, 
      .topic-content-wrapper span, 
      .topic-content-wrapper li, 
      .topic-content-wrapper td, 
      .topic-content-wrapper th, 
      .topic-content-wrapper div:not(.font-mono) {
         font-size: ${settings.fontSize}px !important;
         line-height: ${settings.lineHeight} !important;
         font-weight: ${settings.fontWeight} !important;
      }
      .topic-content-wrapper h1 { font-size: ${settings.fontSize * 1.6}px !important; }
      .topic-content-wrapper h2 { font-size: ${settings.fontSize * 1.4}px !important; }
      .topic-content-wrapper h3 { font-size: ${settings.fontSize * 1.2}px !important; }
      .topic-content-wrapper h4 { font-size: ${settings.fontSize * 1.1}px !important; }
    `}</style>
  );

  const settingsContent = (
    <div className="space-y-4">
      {/* Font Family */}
      <div>
        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
          Font Family
        </label>
        <select
          value={settings.fontFamily}
          onChange={(e) => updateSetting("fontFamily", e.target.value)}
          className="w-full text-sm rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 p-1.5 focus:ring-2 focus:ring-indigo-500 outline-none transition"
        >
          {fonts.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      </div>

      {/* Font Size */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
            Size ({settings.fontSize}px)
          </label>
        </div>
        <input
          type="range"
          min="12"
          max="24"
          step="1"
          value={settings.fontSize}
          onChange={(e) => updateSetting("fontSize", parseInt(e.target.value))}
          className="w-full accent-indigo-600"
        />
        <div className="flex justify-between text-[10px] text-gray-400 mt-1">
          <span>A</span>
          <span className="text-sm">A</span>
        </div>
      </div>

      {/* Font Weight */}
      <div>
        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
          Font Weight
        </label>
        <div className="flex gap-2">
          {[
            { label: "Light", value: "300" },
            { label: "Normal", value: "normal" },
            { label: "Medium", value: "500" },
          ].map((fw) => (
            <button
              key={fw.value}
              onClick={() => updateSetting("fontWeight", fw.value)}
              className={`flex-1 py-1 rounded border text-xs transition-colors ${
                settings.fontWeight === fw.value
                  ? "bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-900/30 dark:border-indigo-700/50 dark:text-indigo-300"
                  : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700"
              }`}
            >
              {fw.label}
            </button>
          ))}
        </div>
      </div>

      {/* Line Height */}
      <div>
        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
          Line Height
        </label>
        <div className="flex gap-2">
          {[1.4, 1.6, 1.8, 2.0].map((lh) => (
            <button
              key={lh}
              onClick={() => updateSetting("lineHeight", lh)}
              className={`flex-1 py-1 rounded border transition-colors ${
                settings.lineHeight === lh
                  ? "bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-900/30 dark:border-indigo-700/50 dark:text-indigo-300"
                  : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700"
              }`}
            >
              {lh}
            </button>
          ))}
        </div>
      </div>

      {/* Reset Button */}
      <button
        onClick={() => setSettings(DEFAULT_SETTINGS)}
        className="w-full py-1.5 mt-2 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
      >
        Reset to defaults
      </button>
    </div>
  );

  if (inline) {
    return (
      <>
        {styleTag}
        <div className="px-4 pb-3 pt-1">
          {settingsContent}
        </div>
      </>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Target content dynamically */}
      {styleTag}

      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="p-1.5 rounded-md text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer mr-2 flex items-center justify-center"
        aria-label="Font Settings"
        title="Font Settings"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="4 7 4 4 20 4 20 7"></polyline>
          <line x1="9" y1="20" x2="15" y2="20"></line>
          <line x1="12" y1="4" x2="12" y2="20"></line>
        </svg>
      </button>

      {/* Popover Menu */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-64 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-lg shadow-gray-100/50 dark:shadow-black/30 overflow-hidden z-50 p-4">
          {settingsContent}
        </div>
      )}
    </div>
  );
}

export function FontInjector() {
  const [settings, setSettings] = useState<FontSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    const loadSettings = () => {
      const saved = localStorage.getItem("edu_font_settings");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setSettings({ ...DEFAULT_SETTINGS, ...parsed });
        } catch (e) {}
      }
    };

    loadSettings();
    window.addEventListener("edu_font_sync", loadSettings);
    return () => window.removeEventListener("edu_font_sync", loadSettings);
  }, []);

  return (
    <style suppressHydrationWarning>{`
      .topic-content-wrapper *:not(pre):not(code):not(.font-mono):not(svg):not(path) {
         font-family: ${settings.fontFamily} !important;
      }
      .topic-content-wrapper p, 
      .topic-content-wrapper span, 
      .topic-content-wrapper li, 
      .topic-content-wrapper td, 
      .topic-content-wrapper th, 
      .topic-content-wrapper div:not(.font-mono) {
         font-size: ${settings.fontSize}px !important;
         line-height: ${settings.lineHeight} !important;
         font-weight: ${settings.fontWeight} !important;
      }
      .topic-content-wrapper h1 { font-size: ${settings.fontSize * 1.6}px !important; }
      .topic-content-wrapper h2 { font-size: ${settings.fontSize * 1.4}px !important; }
      .topic-content-wrapper h3 { font-size: ${settings.fontSize * 1.2}px !important; }
      .topic-content-wrapper h4 { font-size: ${settings.fontSize * 1.1}px !important; }
    `}</style>
  );
}
