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

    if (!sniffedType && !needsAuthenticatedBlob) {
      return { src: requestUrl, shouldRevoke: false };
    }

    const blob = new Blob([bytes], { type: finalType });
    return {
      src: URL.createObjectURL(blob),
      shouldRevoke: true,
    };
  } catch {
    return { src: requestUrl, shouldRevoke: false };
  }
}
