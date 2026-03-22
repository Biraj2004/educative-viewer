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

export function getBackendApiBase(): string {
  return getRuntimePublicEnv("NEXT_PUBLIC_BACKEND_API_BASE").replace(/\/$/, "");
}

export function getRsaPublicKey(): string {
  return getRuntimePublicEnv("NEXT_PUBLIC_RSA_PUBLIC_KEY");
}

export function getStaticFilesBase(): string {
  return getRuntimePublicEnv("NEXT_PUBLIC_STATIC_FILES_BASE");
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
