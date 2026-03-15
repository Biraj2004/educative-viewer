"use client";

import { useMemo } from "react";
import { resolveEduUrl } from "@/utils/constants";
import { prepareSvg } from "@/utils/svg-helpers";
import { usePreparedImageSources } from "@/utils/use-prepared-image";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MxGraphWidgetData {
  path?: string;
  caption?: string;
  prevPath?: string;
  svg?: string;
  xml?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

function SvgRenderer({ svgString }: { svgString: string }) {
  return (
    <div
      dangerouslySetInnerHTML={{ __html: prepareSvg(svgString) }}
      style={{ lineHeight: 0, fontSize: 0, display: "block" }}
    />
  );
}

export default function MxGraphWidget({ data }: { data: MxGraphWidgetData }) {
  const pathValue = data.path?.trim() ?? "";
  const hasPath = pathValue.length > 0;
  const hasSvg = (data.svg?.trim() ?? "").length > 0;

  const resolvedSrc = useMemo(() => (hasPath ? resolveEduUrl(pathValue) : ""), [hasPath, pathValue]);
  const { preparedUrls, isPreparing } = usePreparedImageSources(hasPath ? [resolvedSrc] : []);
  const preparedSrc = preparedUrls[0] ?? "";

  return (
    <div className="flex flex-col items-center justify-center h-full py-2">
      {hasPath ? (
        isPreparing ? (
          <div className="text-sm text-gray-400 italic py-6">Preparing diagram...</div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preparedSrc}
            alt={data.caption ?? "diagram"}
            className="max-w-full h-auto object-contain"
          />
        )
      ) : hasSvg ? (
        <SvgRenderer svgString={data.svg ?? ""} />
      ) : (
        <div className="text-sm text-gray-400 italic py-6">No diagram available.</div>
      )}

      {data.caption && (
        <p className="text-center text-sm text-gray-500 mt-2">{data.caption}</p>
      )}
    </div>
  );
}
