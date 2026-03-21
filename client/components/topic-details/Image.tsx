"use client";

import { useMemo } from "react";
import { resolveEduUrl } from "@/utils/constants";
import { usePreparedImageSource } from "@/utils/use-prepared-image";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ImageComponentData {
  comp_id: string;
  borderColor?: string;
  caption?: string;
  hasBorder?: boolean;
  image_id?: number;
  metadata?: {
    height?: number;
    name?: string;
    sizeInBytes?: number;
    width?: number;
  };
  path: string;
  style?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Image({ data }: { data: ImageComponentData }) {
  const resolvedSrc = useMemo(() => resolveEduUrl(data.path), [data.path]);
  const src = usePreparedImageSource(resolvedSrc);
  const alt = data.metadata?.name ?? data.caption ?? "image";

  return (
    <div className="max-w-6xl mx-auto px-6 py-2">
      <div className="flex flex-col items-center gap-3">
        <div
          style={
            data.hasBorder
              ? { border: `1px solid ${data.borderColor ?? "#ccc"}` }
              : undefined
          }
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            className="max-w-full no-dark-invert h-auto block dark:brightness-90 dark:contrast-95"
          />
        </div>
        {data.caption && (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center">{data.caption}</p>
        )}
      </div>
    </div>
  );
}
