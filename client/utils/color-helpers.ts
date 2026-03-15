function normalizeColorValue(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "");
}

export function isTransparentColor(value: string): boolean {
  const normalized = normalizeColorValue(value);
  if (!normalized) return false;
  if (normalized === "transparent" || normalized === "none") return true;

  const rgbaMatch = normalized.match(/^rgba\((\d+),(\d+),(\d+),([0-9.]+)\)$/);
  if (rgbaMatch) {
    return Number(rgbaMatch[4]) === 0;
  }

  const hslaMatch = normalized.match(/^hsla\(([-0-9.]+),([-0-9.]+)%,([-0-9.]+)%,([0-9.]+)\)$/);
  if (hslaMatch) {
    return Number(hslaMatch[4]) === 0;
  }

  return false;
}

export function isWhiteColor(value: string): boolean {
  const normalized = normalizeColorValue(value);
  if (!normalized) return false;
  if (normalized === "white" || normalized === "#fff" || normalized === "#ffffff") return true;

  const rgbMatch = normalized.match(/^rgba?\((\d+),(\d+),(\d+)(?:,([0-9.]+))?\)$/);
  if (rgbMatch) {
    const alpha = rgbMatch[4] === undefined ? 1 : Number(rgbMatch[4]);
    return Number(rgbMatch[1]) === 255 && Number(rgbMatch[2]) === 255 && Number(rgbMatch[3]) === 255 && alpha > 0;
  }

  const hslMatch = normalized.match(/^hsla?\(([-0-9.]+),([-0-9.]+)%,([-0-9.]+)%(?:,([0-9.]+))?\)$/);
  if (hslMatch) {
    const saturation = Number(hslMatch[2]);
    const lightness = Number(hslMatch[3]);
    const alpha = hslMatch[4] === undefined ? 1 : Number(hslMatch[4]);
    return saturation === 0 && lightness === 100 && alpha > 0;
  }

  return false;
}
