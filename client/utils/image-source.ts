export interface PreparedImageSource {
  src: string;
  shouldRevoke: boolean;
}

import { getStaticBasicAuth, getStaticFilesBase } from "@/utils/runtime-config";

const STATIC_FILES_BASE = getStaticFilesBase();
const STATIC_BASIC_AUTH = getStaticBasicAuth();

function normalizeContentType(value: string | null): string {
  return (value ?? "").split(";")[0].trim().toLowerCase();
}

function looksLikeSvg(bytes: Uint8Array): boolean {
  const head = new TextDecoder()
    .decode(bytes.slice(0, 4096))
    .replace(/^\uFEFF/, "")
    .trimStart();

  return /^<svg[\s>]/i.test(head) || (/^<\?xml/i.test(head) && /<svg[\s>]/i.test(head));
}

function detectBinaryImageMime(bytes: Uint8Array): string | null {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }

  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }

  if (
    bytes.length >= 6 &&
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38 &&
    (bytes[4] === 0x39 || bytes[4] === 0x37) &&
    bytes[5] === 0x61
  ) {
    return "image/gif";
  }

  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }

  return null;
}

function detectImageMime(bytes: Uint8Array): string | null {
  if (looksLikeSvg(bytes)) return "image/svg+xml";
  return detectBinaryImageMime(bytes);
}

function isTransparentCssValue(value: string): boolean {
  const v = value.trim().toLowerCase();
  if (!v) return true;
  if (v === "transparent" || v === "none") return true;
  if (/^rgba\([^)]*,\s*0(?:\.0+)?\s*\)$/i.test(v)) return true;
  if (/^hsla\([^)]*,\s*0(?:\.0+)?\s*\)$/i.test(v)) return true;
  if (/^#([0-9a-f]{4}|[0-9a-f]{8})$/i.test(v)) {
    const hex = v.slice(1);
    const alpha = hex.length === 4 ? hex[3] + hex[3] : hex.slice(6, 8);
    return alpha === "00";
  }
  return false;
}

function svgHasExplicitOpaqueBackground(bytes: Uint8Array): boolean {
  const text = new TextDecoder().decode(bytes.slice(0, 16384));
  const rootSvgTag = text.match(/<svg\b[^>]*>/i)?.[0] ?? "";
  if (!rootSvgTag) return false;

  const styleValue = rootSvgTag.match(/\bstyle\s*=\s*["']([^"']*)["']/i)?.[1] ?? "";
  const styleBackground =
    styleValue.match(/(?:^|;)\s*(?:background|background-color)\s*:\s*([^;]+)/i)?.[1]?.trim() ?? "";
  if (styleBackground) return !isTransparentCssValue(styleBackground);

  const attrBackground =
    rootSvgTag.match(/\bbackground-color\s*=\s*["']([^"']+)["']/i)?.[1]?.trim() ??
    rootSvgTag.match(/\bbackground\s*=\s*["']([^"']+)["']/i)?.[1]?.trim() ??
    "";

  if (attrBackground) return !isTransparentCssValue(attrBackground);
  return false;
}

function detectPngHasTransparency(bytes: Uint8Array): boolean {
  // PNG IHDR colorType: 4/6 have alpha channel. Palette/truecolor can use tRNS chunk.
  if (bytes.length < 33) return false;
  const colorType = bytes[25];
  if (colorType === 4 || colorType === 6) return true;

  let offset = 8; // after PNG signature
  while (offset + 12 <= bytes.length) {
    const length =
      (bytes[offset] << 24) |
      (bytes[offset + 1] << 16) |
      (bytes[offset + 2] << 8) |
      bytes[offset + 3];
    const type = String.fromCharCode(
      bytes[offset + 4],
      bytes[offset + 5],
      bytes[offset + 6],
      bytes[offset + 7]
    );
    if (type === "tRNS") return true;
    if (type === "IEND") break;
    offset += 12 + length;
  }
  return false;
}

function detectGifHasTransparency(bytes: Uint8Array): boolean {
  // Graphics Control Extension: 21 F9 04 [packed], transparency flag = bit 0.
  for (let i = 0; i + 7 < bytes.length; i++) {
    if (bytes[i] === 0x21 && bytes[i + 1] === 0xf9 && bytes[i + 2] === 0x04) {
      const packed = bytes[i + 3];
      if ((packed & 0x01) === 0x01) return true;
    }
  }
  return false;
}

function detectWebpHasTransparency(bytes: Uint8Array): boolean {
  // VP8X feature flags: alpha bit (0x10).
  for (let i = 12; i + 16 < bytes.length; ) {
    const type = String.fromCharCode(bytes[i], bytes[i + 1], bytes[i + 2], bytes[i + 3]);
    const chunkSize =
      bytes[i + 4] |
      (bytes[i + 5] << 8) |
      (bytes[i + 6] << 16) |
      (bytes[i + 7] << 24);
    if (type === "VP8X" && i + 9 < bytes.length) {
      const flags = bytes[i + 8];
      return (flags & 0x10) === 0x10;
    }
    const paddedSize = chunkSize + (chunkSize % 2);
    i += 8 + paddedSize;
  }
  return false;
}

function detectImageHasTransparency(bytes: Uint8Array, mime: string): boolean {
  switch (mime) {
    case "image/svg+xml":
      return !svgHasExplicitOpaqueBackground(bytes);
    case "image/png":
      return detectPngHasTransparency(bytes);
    case "image/gif":
      return detectGifHasTransparency(bytes);
    case "image/webp":
      return detectWebpHasTransparency(bytes);
    default:
      return false;
  }
}

function markTransparentBlobSrc(blobUrl: string, isTransparent: boolean): string {
  if (!isTransparent) return blobUrl;
  return `${blobUrl}#transparent-bg`;
}

function normalizeRequestUrl(url: string): string {
  if (!url) return url;

  if (url.startsWith("http://") || url.startsWith("https://")) {
    try {
      const parsed = new URL(url);
      parsed.pathname = parsed.pathname.replace(/\/+/g, "/");
      return parsed.toString();
    } catch {
      return url;
    }
  }

  return url.replace(/\/+/g, "/");
}

function normalizePath(path: string): string {
  if (!path || path === "/") return "";
  return path.replace(/\/+$/, "");
}

function shouldAttachStaticAuth(url: string): boolean {
  if (!STATIC_BASIC_AUTH || !STATIC_FILES_BASE) return false;

  try {
    const base = new URL(STATIC_FILES_BASE);
    const target = new URL(url, base);

    if (target.origin !== base.origin) return false;

    const basePath = normalizePath(base.pathname);
    if (!basePath) return true;

    return target.pathname === basePath || target.pathname.startsWith(`${basePath}/`);
  } catch {
    return false;
  }
}

function getRequestHeaders(url: string): HeadersInit | undefined {
  if (!shouldAttachStaticAuth(url)) return undefined;
  return {
    Authorization: STATIC_BASIC_AUTH,
  };
}

export async function prepareImageSource(url: string): Promise<PreparedImageSource> {
  if (!url) return { src: url, shouldRevoke: false };

  const requestUrl = normalizeRequestUrl(url);
  const headers = getRequestHeaders(requestUrl);
  const needsAuthenticatedBlob = Boolean(headers);

  try {
    const resp = await fetch(requestUrl, { cache: "force-cache", headers });
    if (!resp.ok) return { src: requestUrl, shouldRevoke: false };

    const contentType = normalizeContentType(resp.headers.get("Content-Type"));
    if (!needsAuthenticatedBlob && contentType.startsWith("image/")) {
      return { src: requestUrl, shouldRevoke: false };
    }

    const bytes = new Uint8Array(await resp.arrayBuffer());
    const sniffedType = detectImageMime(bytes);
    const finalType = sniffedType || contentType || "application/octet-stream";
    const hasTransparency = detectImageHasTransparency(bytes, finalType);

    if (!sniffedType && !needsAuthenticatedBlob) {
      return { src: requestUrl, shouldRevoke: false };
    }

    const blob = new Blob([bytes], { type: finalType });
    const blobUrl = URL.createObjectURL(blob);
    return {
      src: markTransparentBlobSrc(blobUrl, hasTransparency),
      shouldRevoke: true,
    };
  } catch {
    return { src: requestUrl, shouldRevoke: false };
  }
}
