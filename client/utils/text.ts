export function normalizeText(value?: string): string | null {
  const next = value?.trim() ?? "";
  return next.length > 0 ? next : null;
}
