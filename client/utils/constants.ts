export const EDU_BASE = process.env.STATIC_FILES_BASE ?? process.env.NEXT_PUBLIC_STATIC_FILES_BASE ?? "";
export const API_BASE = process.env.BACKEND_API_BASE ?? process.env.NEXT_PUBLIC_BACKEND_API_BASE ?? "";

/**
 * Always resolve a path through EDU_BASE.
 * If the path is already an absolute URL, the original domain is stripped
 * and replaced with EDU_BASE so all requests go through the configured proxy.
 */
export function resolveEduUrl(path: string): string {
  if (!path) return "";
  if (path.startsWith("http")) {
    // Strip scheme + host, keep everything from the first "/" of the pathname
    try {
      const url = new URL(path);
      return `${EDU_BASE}${url.pathname}${url.search}${url.hash}`;
    } catch {
      return `${EDU_BASE}${path}`;
    }
  }
  return `${EDU_BASE}${path}`;
}
