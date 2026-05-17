"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { prepareSvg } from "@/utils/svg-helpers";

export interface UMLData {
  comp_id: string;
  content: string;
  caption?: string;
  title?: string;
  language?: string;
  evaluateLanguage?: string;
  entryFileName?: string;
  isCodeDrawing?: boolean;
  theme?: string;
  centerOutput?: boolean;
  allowDownload?: boolean;
  fullWidthFileOutput?: boolean;
  uml_widget_version?: number;
  version?: string;
  runnable?: boolean;
}

// ─── PlantUML encoding ───────────────────────────────────────────────────────
// Use PlantUML's hex encoding mode (~h prefix).
// The source is encoded as UTF-8 bytes then represented as lowercase hex.
// This is simpler and doesn't require deflate/zlib compression.

function toUtf8Bytes(text: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c < 0x80) {
      bytes.push(c);
    } else if (c < 0x800) {
      bytes.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
    } else {
      bytes.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
    }
  }
  return bytes;
}

function encodeHex(text: string): string {
  return toUtf8Bytes(text)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ─── Server config ───────────────────────────────────────────────────────────

const SERVERS = [
  "https://www.plantuml.com/plantuml",
  "https://plantuml.com/plantuml",
];

function svgUrl(source: string, serverIdx: number): string {
  // ~h prefix tells PlantUML the payload is hex-encoded (no compression needed)
  return `${SERVERS[serverIdx]}/svg/~h${encodeHex(source)}`;
}

// ─── SVG normalization ───────────────────────────────────────────────────────

function normalizeSvg(raw: string): string {
  const prepared = prepareSvg(raw);
  if (typeof window === "undefined") return prepared;

  try {
    const doc = new DOMParser().parseFromString(prepared, "image/svg+xml");
    const svg = doc.querySelector("svg");
    if (!svg) return prepared;

    const w = svg.getAttribute("width");
    const h = svg.getAttribute("height");
    // Build a max-width from the original width attribute (before we strip it)
    // so the diagram never renders larger than its natural size.
    const naturalWidth = w ? parseFloat(w) : null;
    const maxWidthRule = naturalWidth && naturalWidth > 0
      ? `max-width:${naturalWidth}px;`
      : "";

    if (!svg.getAttribute("viewBox") && w && h) {
      svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    }
    svg.removeAttribute("width");
    svg.removeAttribute("height");
    svg.setAttribute(
      "style",
      `${maxWidthRule}width:100%;height:auto;display:block;margin:0 auto;`
    );
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    return new XMLSerializer().serializeToString(svg);
  } catch {
    return prepared;
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ok"; svg: string }
  | { kind: "error"; msg: string };

export default function UML({ data }: { data: UMLData }) {
  const source = useMemo(() => data.content?.trim() ?? "", [data.content]);
  const [state, setState] = useState<State>({ kind: "idle" });
  const cancelled = useRef(false);

  useEffect(() => {
    if (!source) {
      setState({ kind: "idle" });
      return;
    }

    cancelled.current = false;
    setState({ kind: "loading" });

    (async () => {
      for (let idx = 0; idx < SERVERS.length; idx++) {
        try {
          const res = await fetch(svgUrl(source, idx));
          if (cancelled.current) return;
          if (!res.ok) continue;
          const text = await res.text();
          if (cancelled.current) return;
          if (text.includes("<svg") || text.includes("<SVG")) {
            setState({ kind: "ok", svg: normalizeSvg(text) });
            return;
          }
        } catch {
          // try next
        }
      }
      if (!cancelled.current) {
        setState({ kind: "error", msg: "Could not reach PlantUML server. Showing source." });
      }
    })();

    return () => {
      cancelled.current = true;
    };
  }, [source]);

  const caption = data.caption?.trim();
  const title = data.title?.trim();

  if (!source) {
    return (
      <div className="flex items-center justify-center h-20 text-sm text-gray-400 italic bg-gray-50 dark:bg-gray-900/50 rounded-lg">
        No UML source.
      </div>
    );
  }

  return (
    <div className="w-full">
      {title && (
        <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/60">
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 font-mono">
            {title}
          </span>
        </div>
      )}

      <div className="relative w-full flex flex-col items-center gap-4 px-4 py-6 bg-white dark:bg-gray-950">
        {state.kind === "loading" && (
          <div className="flex flex-col items-center gap-3 py-10">
            <div className="flex gap-1.5">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-2 h-2 rounded-full bg-indigo-400 dark:bg-indigo-500 animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
            <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">
              Rendering diagram…
            </span>
          </div>
        )}

        {state.kind === "ok" && (
          <div
            className="w-full flex justify-center dark:brightness-90 dark:invert dark:hue-rotate-180"
            dangerouslySetInnerHTML={{ __html: state.svg }}
          />
        )}

        {state.kind === "error" && (
          <div className="w-full flex flex-col gap-3">
            <p className="text-xs text-amber-600 dark:text-amber-400 text-center">
              {state.msg}
            </p>
            <pre className="w-full overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-3 text-xs text-gray-700 dark:text-gray-300 font-mono leading-relaxed">
              {source}
            </pre>
          </div>
        )}
      </div>

      {caption && (
        <div className="flex justify-center px-4 pb-4">
          <span className="text-sm font-medium text-gray-700 bg-gray-50 px-3 py-1 rounded-md shadow-sm border border-gray-100 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300">
            {caption}
          </span>
        </div>
      )}
    </div>
  );
}
