export const RUNTIME_PUBLIC_ENV_KEYS = [
  "NEXT_PUBLIC_BACKEND_API_BASE",
  "NEXT_PUBLIC_RSA_PUBLIC_KEY",
  "NEXT_PUBLIC_STATIC_FILES_BASE",
  "NEXT_PUBLIC_STATIC_BASIC_AUTH",
] as const;

export type RuntimePublicEnvKey = (typeof RUNTIME_PUBLIC_ENV_KEYS)[number];

export type RuntimePublicEnvMap = Record<RuntimePublicEnvKey, string>;

function readRuntimeConfig(): Partial<RuntimePublicEnvMap> {
  if (typeof window === "undefined") return {};
  const value = window.__EV_RUNTIME_CONFIG__;
  if (!value || typeof value !== "object") return {};
  return value;
}

export function getRuntimePublicEnv(key: RuntimePublicEnvKey): string {
  const value = readRuntimeConfig()[key];
  return typeof value === "string" ? value : "";
}

function isPrivateHost(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    // 192.168.x.x, 10.x.x.x, 172.16-31.x.x
    /^192\.168\./.test(hostname) ||
    /^10\./.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
  );
}

function rewriteHostname(urlStr: string): string {
  if (!urlStr || typeof window === "undefined") return urlStr;
  // Only rewrite when the browser is on a local/private address.
  // If the user is accessing from a public domain (e.g. a Cloudflare Worker),
  // keep the env-configured URL exactly as-is so backend calls go to the right host.
  if (!isPrivateHost(window.location.hostname)) return urlStr;
  try {
    const url = new URL(urlStr);
    // Also only rewrite if the configured URL itself points to a local/private host,
    // not if it's already pointing to a specific public server.
    if (!isPrivateHost(url.hostname)) return urlStr;
    url.hostname = window.location.hostname;
    return url.toString();
  } catch {
    return urlStr;
  }
}

export function getBackendApiBase(): string {
  const base = getRuntimePublicEnv("NEXT_PUBLIC_BACKEND_API_BASE");
  return rewriteHostname(base).replace(/\/$/, "");
}

export function getRsaPublicKey(): string {
  return getRuntimePublicEnv("NEXT_PUBLIC_RSA_PUBLIC_KEY");
}

export function getStaticFilesBase(): string {
  const base = getRuntimePublicEnv("NEXT_PUBLIC_STATIC_FILES_BASE");
  return rewriteHostname(base);
}

export function getStaticBasicAuth(): string {
  return getRuntimePublicEnv("NEXT_PUBLIC_STATIC_BASIC_AUTH");
}

declare global {
  interface Window {
    __EV_RUNTIME_CONFIG__?: Partial<RuntimePublicEnvMap>;
  }
}

export {};
