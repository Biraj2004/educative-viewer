"use client";

import { useMemo } from "react";
import { prepareSvg } from "@/utils/svg-helpers";

export interface SequenceDiagramData {
  caption?: string;
  comp_id: string;
  diagram_type?: string;
  svg_string?: string;
  text?: string;
  version?: string;
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

function normalizeSequenceSvg(svgString: string): string {
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

    const computedWidth = Math.round(viewBoxSize?.width ?? svgWidth ?? 0);
    const computedHeight = Math.round(viewBoxSize?.height ?? svgHeight ?? 0);

    if (!viewBoxSize && computedWidth && computedHeight) {
      svg.setAttribute("viewBox", `0 0 ${computedWidth} ${computedHeight}`);
    }

    const cleanStyle = stripSizeStyles(svg.getAttribute("style"));
    const extraStyle = computedWidth 
      ? `max-width: ${computedWidth}px; width: 100%; height: auto; display: block; margin: 0 auto;`
      : `width: 100%; height: auto; display: block; margin: 0 auto;`;
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

export default function SequenceDiagrams({ data }: { data: SequenceDiagramData }) {
  const renderedSvg = useMemo(() => {
    if (!data.svg_string) return null;
    return normalizeSequenceSvg(data.svg_string);
  }, [data.svg_string]);

  if (!renderedSvg && !data.text) {
    return (
      <div className="flex items-center justify-center h-20 text-sm text-gray-400 italic bg-gray-50 dark:bg-gray-900/50 rounded-lg">
        No sequence diagram data.
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
            {data.text}
          </pre>
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
