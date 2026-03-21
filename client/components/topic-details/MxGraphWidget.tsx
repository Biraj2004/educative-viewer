"use client";

import { useMemo } from "react";
import { resolveEduUrl } from "@/utils/constants";
import { isTransparentColor, isWhiteColor } from "@/utils/color-helpers";
import { prepareSvg } from "@/utils/svg-helpers";
import { usePreparedImageSources } from "@/utils/use-prepared-image";
import { normalizeText } from "@/utils/text";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MxGraphWidgetData {
  path?: string;
  caption?: string;
  prevPath?: string;
  svg?: string;
  xml?: string;
}

function getRootSvgBackground(svgString: string): string | null {
  const rootSvgTag = svgString.match(/<svg\b[^>]*>/i)?.[0] ?? "";
  if (!rootSvgTag) return null;

  const styleValue = rootSvgTag.match(/\bstyle\s*=\s*["']([^"']*)["']/i)?.[1] ?? "";
  const styleBackground =
    styleValue.match(/(?:^|;)\s*(?:background|background-color)\s*:\s*([^;]+)/i)?.[1]?.trim() ?? "";
  if (styleBackground) return styleBackground;

  const attributeBackground =
    rootSvgTag.match(/\bbackground-color\s*=\s*["']([^"']+)["']/i)?.[1]?.trim() ??
    rootSvgTag.match(/\bbackground\s*=\s*["']([^"']+)["']/i)?.[1]?.trim() ??
    "";

  return attributeBackground || null;
}

function shouldKeepWhiteBackgroundInDarkMode(svgString: string): boolean {
  const rootBackground = getRootSvgBackground(svgString);

  if (!rootBackground) {
    return true;
  }

  return isWhiteColor(rootBackground) || isTransparentColor(rootBackground);
}

// ─── Component ────────────────────────────────────────────────────────────────

function SvgRenderer({
  svgString,
  forceWhiteBackgroundInDarkMode,
}: {
  svgString: string;
  forceWhiteBackgroundInDarkMode: boolean;
}) {
  return (
    <div
      className={forceWhiteBackgroundInDarkMode ? "dark:bg-white" : undefined}
      dangerouslySetInnerHTML={{ __html: prepareSvg(svgString) }}
      style={{ lineHeight: 0, fontSize: 0, display: "block" }}
    />
  );
}

export default function MxGraphWidget({ data }: { data: MxGraphWidgetData }) {
  const pathValue = data.path?.trim() ?? "";
  const hasPath = pathValue.length > 0;
  const svgValue = data.svg ?? "";
  const hasSvg = svgValue.trim().length > 0;
  const captionText = normalizeText(data.caption);
  const pathLabel = useMemo(() => {
    if (!hasPath) return null;
    const fileName = pathValue.split("/").pop() ?? "";
    return normalizeText(fileName);
  }, [hasPath, pathValue]);
  const altText = captionText ?? pathLabel ?? "diagram";

  const resolvedSrc = useMemo(() => (hasPath ? resolveEduUrl(pathValue) : ""), [hasPath, pathValue]);
  const { preparedUrls, isPreparing } = usePreparedImageSources(hasPath ? [resolvedSrc] : []);
  const preparedSrc = preparedUrls[0] ?? "";
  const forceWhiteBackgroundInDarkMode = useMemo(
    () => shouldKeepWhiteBackgroundInDarkMode(svgValue),
    [svgValue]
  );

  return (
    <div className="flex flex-col items-center justify-center h-full py-2">
      {hasPath ? (
        isPreparing ? (
          <div className="text-sm text-gray-400 italic py-6">Preparing diagram...</div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preparedSrc}
            alt={altText}
            className="max-w-full h-auto object-contain"
          />
        )
      ) : hasSvg ? (
        <SvgRenderer
          svgString={svgValue}
          forceWhiteBackgroundInDarkMode={forceWhiteBackgroundInDarkMode}
        />
      ) : (
        <div className="text-sm text-gray-400 italic py-6">No diagram available.</div>
      )}

      {captionText && (
        <p className="text-center text-sm text-gray-500 mt-2">{captionText}</p>
      )}
    </div>
  );
}
