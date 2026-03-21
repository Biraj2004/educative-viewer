"use client";

import { useMemo, useState } from "react";
import { resolveEduUrl } from "@/utils/constants";
import { usePreparedImageSource, usePreparedImageSources } from "@/utils/use-prepared-image";
import { normalizeText } from "@/utils/text";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DrawIOWidgetData {
  comp_id: string;
  path?: string;
  caption?: string;
  width?: number;
  height?: number;
  isSlides?: boolean;
  slidesEnabled?: boolean;
  slidesImages?: string[];
  slidesCaption?: string[];
}

// ─── Slides sub-component ─────────────────────────────────────────────────────

function SlidesViewer({ data }: { data: DrawIOWidgetData }) {
  const captions = data.slidesCaption ?? [];
  const resolvedUrls = useMemo(
    () => (data.slidesImages ?? []).map(resolveEduUrl),
    [data.slidesImages]
  );
  const total = resolvedUrls.length;
  const imgHeight = data.height ?? 620;
  const [idx, setIdx] = useState(0);
  const { preparedUrls, isPreparing } = usePreparedImageSources(resolvedUrls);

  if (total === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-sm text-gray-400 italic">
        No slides available.
      </div>
    );
  }

  const safeIdx = Math.min(idx, Math.max(0, total - 1));
  const caption = normalizeText(captions[safeIdx]) ?? normalizeText(data.caption);
  const activeSrc = preparedUrls[safeIdx] ?? resolvedUrls[safeIdx] ?? "";

  return (
    <div className="flex flex-col">
      {isPreparing ? (
        <div className="flex items-center justify-center h-40 text-sm text-gray-400 italic">
          Preparing slides...
        </div>
      ) : (
        <>
          <div
            className="w-full bg-white dark:bg-gray-900 flex items-center justify-center overflow-hidden"
            style={{ minHeight: Math.min(imgHeight, 620) }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={activeSrc}
              alt={caption ?? `Slide ${idx + 1}`}
              className="max-w-full h-auto object-contain dark:brightness-90"
              style={{ maxHeight: imgHeight }}
            />
          </div>

          <div className="flex items-center justify-between px-4 py-2 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setIdx((i) => Math.max(0, Math.min(i, total - 1) - 1))}
              disabled={safeIdx === 0}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Prev
            </button>

            <div className="flex items-center gap-1.5">
              {preparedUrls.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setIdx(i)}
                  className={`w-2 h-2 rounded-full transition-colors cursor-pointer ${
                    i === safeIdx
                      ? "bg-indigo-500"
                      : "bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500"
                  }`}
                  aria-label={`Slide ${i + 1}`}
                />
              ))}
            </div>

            <button
              onClick={() => setIdx((i) => Math.min(total - 1, Math.min(i, total - 1) + 1))}
              disabled={safeIdx === total - 1}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors cursor-pointer"
            >
              Next
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {caption && (
            <p className="text-center text-sm text-gray-500 dark:text-gray-400 px-4 py-2">{caption}</p>
          )}

          <p className="text-center text-xs text-gray-400 pb-2">
            {safeIdx + 1} / {total}
          </p>
        </>
      )}
    </div>
  );
}

function SingleImageViewer({ data }: { data: DrawIOWidgetData }) {
  const resolvedSrc = useMemo(() => resolveEduUrl(data.path ?? ""), [data.path]);
  const preparedSrc = usePreparedImageSource(resolvedSrc);
  const captionText = normalizeText(data.caption);
  const altText = captionText ?? "diagram";

  return (
    <div className="max-w-4xl mx-auto px-6 py-2">
      <div className="flex flex-col items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={preparedSrc}
          alt={altText}
          width={data.width || undefined}
          height={data.height || undefined}
          className="max-w-full h-auto object-contain"
        />
        {captionText && (
          <p className="text-center text-sm text-gray-500">{captionText}</p>
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function DrawIOWidget({ data }: { data: DrawIOWidgetData }) {
  if ((data.isSlides || data.slidesEnabled) && data.slidesImages?.length) {
    return (
      <div className="max-w-4xl mx-auto">
        <SlidesViewer data={data} />
      </div>
    );
  }

  return <SingleImageViewer data={data} />;
}
