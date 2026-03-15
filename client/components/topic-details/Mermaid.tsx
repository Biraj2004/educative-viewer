"use client";

import { useEffect, useMemo, useState } from "react";
import { prepareSvg } from "@/utils/svg-helpers";

export interface MermaidData {
  caption?: string;
  comp_id: string;
  height?: number;
  image_id?: number | null;
  svgString?: string;
  text?: string;
  version?: string;
  width?: number;
}

declare global {
  interface Window {
    mermaid?: {
      initialize: (config: Record<string, unknown>) => void;
      render: (
        id: string,
        text: string
      ) => Promise<{ svg: string; bindFunctions?: (element: Element) => void }>;
    };
  }
}

let mermaidScriptPromise: Promise<void> | null = null;
const scriptPromises = new Map<string, Promise<void>>();

function loadScript(src: string, marker: string): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (scriptPromises.has(src)) return scriptPromises.get(src)!;

  const promise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(
      `script[data-ev-script="${marker}"]`
    ) as HTMLScriptElement | null;

    if (existing) {
      if (existing.getAttribute("data-loaded") === "true") {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error(`Failed to load ${marker}`)),
        { once: true }
      );
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.setAttribute("data-ev-script", marker);
    script.onload = () => {
      script.setAttribute("data-loaded", "true");
      resolve();
    };
    script.onerror = () => reject(new Error(`Failed to load ${marker}`));
    document.head.appendChild(script);
  });

  scriptPromises.set(src, promise);
  return promise;
}

async function loadScriptWithFallback(
  sources: string[],
  marker: string
): Promise<void> {
  let lastError: Error | null = null;
  for (const src of sources) {
    try {
      await loadScript(src, `${marker}:${src}`);
      return;
    } catch (error) {
      lastError =
        error instanceof Error
          ? error
          : new Error(`Failed to load ${marker} from ${src}`);
    }
  }
  throw (lastError ?? new Error(`Failed to load ${marker}`));
}

function loadMermaidScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.mermaid) return Promise.resolve();
  if (mermaidScriptPromise) return mermaidScriptPromise;

  mermaidScriptPromise = loadScriptWithFallback(
    [
      "https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js",
      "https://unpkg.com/mermaid@10/dist/mermaid.min.js",
    ],
    "mermaid"
  );

  return mermaidScriptPromise;
}

function parseSvgNumber(value: string | null): number | null {
  if (!value) return null;
  const match = value.match(/^\s*([0-9]+(?:\.[0-9]+)?)/);
  if (!match) return null;
  const num = Number(match[1]);
  return Number.isFinite(num) ? num : null;
}

function parseViewBoxSize(
  viewBox: string | null
): { width: number; height: number } | null {
  if (!viewBox) return null;
  const parts = viewBox.trim().split(/\s+/).map(Number);
  if (parts.length !== 4 || parts.some((value) => !Number.isFinite(value))) {
    return null;
  }
  return {
    width: Math.abs(parts[2]),
    height: Math.abs(parts[3]),
  };
}

function stripSizeStyles(styleValue: string | null): string | null {
  if (!styleValue) return null;
  const rules = styleValue
    .split(";")
    .map((rule) => rule.trim())
    .filter(Boolean)
    .filter(
      (rule) =>
        !/^max-width\s*:/i.test(rule) &&
        !/^width\s*:/i.test(rule) &&
        !/^height\s*:/i.test(rule)
    );
  return rules.length > 0 ? rules.join("; ") : null;
}

function normalizeMermaidSvg(
  svgString: string,
  minWidth: number,
  minHeight: number
): string {
  const prepared = prepareSvg(svgString);
  if (typeof window === "undefined") return prepared;

  try {
    const parser = new DOMParser();
    const xml = parser.parseFromString(prepared, "image/svg+xml");
    const svg = xml.querySelector("svg");
    if (!svg) return prepared;

    const viewBoxSize = parseViewBoxSize(svg.getAttribute("viewBox"));
    const svgWidth = parseSvgNumber(svg.getAttribute("width"));
    const svgHeight = parseSvgNumber(svg.getAttribute("height"));

    const computedWidth = Math.round(viewBoxSize?.width ?? svgWidth ?? minWidth);
    const computedHeight = Math.round(viewBoxSize?.height ?? svgHeight ?? minHeight);

    if (!viewBoxSize) {
      svg.setAttribute("viewBox", `0 0 ${computedWidth} ${computedHeight}`);
    }

    const cleanStyle = stripSizeStyles(svg.getAttribute("style"));
    const extraStyle = `max-width: ${computedWidth}px; width: 100%; height: auto; display: block; margin: 0 auto;`;
    const finalStyle = cleanStyle ? `${cleanStyle}; ${extraStyle}` : extraStyle;

    svg.setAttribute("style", finalStyle);
    svg.removeAttribute("width");
    svg.removeAttribute("height");
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");

    return new XMLSerializer().serializeToString(svg);
  } catch {
    return prepared;
  }
}

export default function Mermaid({ data }: { data: MermaidData }) {
  const [rawSvg, setRawSvg] = useState<string | null>(
    data.svgString || null
  );
  const [error, setError] = useState<string | null>(null);
  const diagramText = useMemo(() => data.text?.trim() ?? "", [data.text]);
  const minWidth = data.width ?? 0;
  const minHeight = data.height ?? 0;

  const renderedSvg = useMemo(() => {
    if (!rawSvg) return null;
    return normalizeMermaidSvg(rawSvg, minWidth, minHeight);
  }, [rawSvg, minWidth, minHeight]);

  useEffect(() => {
    setRawSvg(data.svgString || null);
    setError(null);
  }, [data.svgString, data.text]);

  useEffect(() => {
    let cancelled = false;

    async function renderFromText() {
      if (rawSvg || !diagramText) return;
      try {
        await loadMermaidScript();
        if (!window.mermaid) throw new Error("Mermaid is unavailable");

        const isDark = document.documentElement.classList.contains("dark");
        window.mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: isDark ? "dark" : "default",
        });

        const id = `ev-mermaid-${data.comp_id}-${Math.random()
          .toString(36)
          .slice(2, 8)}`;
        const result = await window.mermaid.render(id, diagramText);
        if (!cancelled) setRawSvg(result.svg);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to render Mermaid");
        }
      }
    }

    void renderFromText();

    return () => {
      cancelled = true;
    };
  }, [data.comp_id, diagramText, rawSvg]);

  if (!renderedSvg && !diagramText) {
    return (
      <div className="flex items-center justify-center h-20 text-sm text-gray-400 italic bg-gray-50 dark:bg-gray-900/50 rounded-lg">
        No mermaid data.
      </div>
    );
  }

  return (
    <div className="max-w-full mx-auto px-6 py-4">
      <div className="flex flex-col items-center gap-3">
        {renderedSvg ? (
          <div
            className="w-full flex justify-center dark:brightness-90 dark:invert dark:hue-rotate-180"
            dangerouslySetInnerHTML={{ __html: renderedSvg }}
          />
        ) : (
          <pre className="w-full max-w-4xl overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-3 text-sm text-gray-700 dark:text-gray-300">
            {diagramText}
          </pre>
        )}

        {error && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            Mermaid render fallback: {error}
          </p>
        )}

        {data.caption && (
          <span className="text-sm font-medium text-gray-700 bg-gray-50 px-3 py-1 rounded-md mt-1 shadow-sm border border-gray-100 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300">
            {data.caption}
          </span>
        )}
      </div>
    </div>
  );
}
