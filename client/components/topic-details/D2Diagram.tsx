"use client";

import { useEffect, useRef, useState } from "react";
import { resolveEduUrl } from "@/utils/constants";
import { normalizeText } from "@/utils/text";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface D2DiagramD2File {
  /** Local `/api/...` path served by the local static server. */
  localPath?: string;
  layoutEngine?: string;
  name?: string;
  renderOptions?: Record<string, unknown>;
}

export interface D2DiagramData {
  comp_id: string;
  caption?: string;
  d2Code?: string;
  d2File?: D2DiagramD2File;
}

// ─── SVG pre-processing ──────────────────────────────────────────────────────
//
// D2/ELK renders SVGs with `height="auto"` (and sometimes `width="auto"`) on
// the <svg> root element. "auto" is not a valid SVG length — only CSS accepts
// it. Browsers that encounter height="auto" on <svg> cannot compute an intrinsic
// height and render the image as a zero-height sliver.
//
// Fix: strip those invalid attribute values from the <svg> opening tag so the
// browser falls back to using the viewBox for aspect-ratio calculation.

function fixSvgAttributes(svgText: string): string {
  // Remove height="auto" and width="auto" presentation attributes from the
  // <svg> root element. These are invalid SVG lengths that cause browsers to
  // render the image with zero intrinsic dimensions.
  //
  // NOTE: No /s (dotAll) flag — tsconfig targets ES2017 which predates it.
  // Newlines and carriage-returns inside the opening tag are handled with
  // an explicit [\r\n] alternation instead.
  return svgText.replace(
    /(<svg\b)((?:[^>]|[\r\n])*?)>/,
    (_match, open: string, attrs: string) => {
      let cleaned = attrs
        .replace(/\s+width\s*=\s*["']auto["']/gi, "")
        .replace(/\s+height\s*=\s*["']auto["']/gi, "");

      // Also strip width/height from an inline style attribute so that CSS
      // on the wrapping <img> element controls sizing.
      cleaned = cleaned.replace(
        /(style\s*=\s*["'])([^"']*)(["'])/gi,
        (_sm, pre: string, styleValue: string, post: string) => {
          const fixed = styleValue
            .split(";")
            .map((r) => r.trim())
            .filter(Boolean)
            .filter(
              (r) =>
                !/^width\s*:/i.test(r) &&
                !/^height\s*:/i.test(r) &&
                !/^max-width\s*:/i.test(r)
            )
            .join("; ");
          return `${pre}${fixed}${post}`;
        }
      );

      return `${open}${cleaned}>`;
    }
  );
}

/**
 * The scraper stores D2 diagrams as the raw GCS file content, which may be:
 *   a) Raw SVG XML:                <svg xmlns=...>...</svg>
 *   b) A base64 data URI:          data:image/svg+xml;base64,PD94bWwg...
 *   c) A URL-encoded data URI:     data:image/svg+xml,%3Csvg...
 *
 * This function normalises all cases to raw SVG XML string.
 */
function decodeSvgContent(raw: string): string {
  const text = raw.trim();

  // ── base64 data URI ──────────────────────────────────────────────────────
  const b64Match = text.match(/^data:image\/svg\+xml;base64,([\s\S]+)$/i);
  if (b64Match) {
    try {
      // atob gives Latin-1 bytes; use TextDecoder for proper UTF-8 handling.
      const binary = atob(b64Match[1].trim());
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return new TextDecoder("utf-8").decode(bytes);
    } catch {
      // Fallback: let the browser handle it via data URI src directly.
      return text;
    }
  }

  // ── URL-encoded data URI ─────────────────────────────────────────────────
  const urlMatch = text.match(/^data:image\/svg\+xml,([\s\S]+)$/i);
  if (urlMatch) {
    try {
      return decodeURIComponent(urlMatch[1]);
    } catch {
      return text;
    }
  }

  // ── Already raw SVG XML ──────────────────────────────────────────────────
  return text;
}
type LoadState = "loading" | "loaded" | "error" | "empty";

export default function D2Diagram({ data }: { data: D2DiagramData }) {
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Track the current blob URL so we can revoke it on cleanup.
  const blobUrlRef = useRef<string | null>(null);

  const captionText = normalizeText(data.caption);
  const rawPath = data.d2File?.localPath ?? "";
  const resolvedUrl = rawPath ? resolveEduUrl(rawPath) : "";

  // ── Fetch & create blob ────────────────────────────────────────────────────
  useEffect(() => {
    if (!resolvedUrl) {
      setLoadState("empty");
      return;
    }

    let cancelled = false;
    setLoadState("loading");
    setImageSrc(null);
    setErrorMsg(null);

    (async () => {
      try {
        const resp = await fetch(resolvedUrl);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

        // Read as text — the file is SVG content stored as .txt on disk,
        // so the server may return it as text/plain. We ignore Content-Type
        // entirely and create our own blob with the correct SVG MIME type.
        // D2/ELK generates SVGs with height="auto" which is an invalid SVG
        // length. Strip it before creating the blob so the browser computes
        // the intrinsic height from the viewBox instead.
        const raw = await resp.text();

        // The .txt file from the scraper may contain raw SVG XML *or* a
        // base64/URL-encoded data URI. Decode to raw SVG before processing.
        const svgText = decodeSvgContent(raw);

        // Strip invalid presentation attributes (height="auto", width="auto")
        // and any width/height in the SVG's inline style so the browser uses
        // the viewBox for intrinsic sizing.
        const fixedText = fixSvgAttributes(svgText);

        if (cancelled) return;

        const blob = new Blob([fixedText], { type: "image/svg+xml" });
        const blobUrl = URL.createObjectURL(blob);

        // Revoke the previous blob URL before replacing.
        if (blobUrlRef.current) {
          URL.revokeObjectURL(blobUrlRef.current);
        }
        blobUrlRef.current = blobUrl;

        setImageSrc(blobUrl);
        setLoadState("loaded");
      } catch (err) {
        if (!cancelled) {
          setErrorMsg(
            err instanceof Error ? err.message : "Failed to load diagram."
          );
          setLoadState("error");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [resolvedUrl]);

  // Revoke the blob URL when the component unmounts.
  useEffect(() => {
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, []);

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loadState === "empty") {
    return (
      <div className="flex items-center justify-center h-20 text-sm text-gray-400 italic bg-gray-50 dark:bg-gray-900/50 rounded-lg">
        No diagram data.
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-4">
      <div className="flex flex-col items-center gap-3">

        {loadState === "loading" && (
          <div className="flex items-center justify-center h-24 text-sm text-gray-400 italic">
            Loading diagram…
          </div>
        )}

        {loadState === "loaded" && imageSrc && (
          // Horizontally scrollable so very wide diagrams don't overflow the page
          <div className="w-full overflow-x-auto flex justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageSrc}
              alt={captionText ?? "D2 diagram"}
              className="w-full max-w-full h-auto max-h-[70vh] object-contain block mx-auto"
            />
          </div>
        )}

        {loadState === "error" && (
          <p className="text-sm text-amber-600 dark:text-amber-400 italic">
            {errorMsg ?? "Failed to load diagram."}
          </p>
        )}

        {captionText && (
          <span className="text-sm font-medium text-gray-700 bg-gray-50 px-3 py-1 rounded-md mt-1 shadow-sm border border-gray-100 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300">
            {captionText}
          </span>
        )}

      </div>
    </div>
  );
}
