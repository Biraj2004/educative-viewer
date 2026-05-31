"use client";

const DRAWING_DRAWER_OPEN_KEY_PREFIX = "ev:drawing-drawer-open:v1";

function getDrawingDrawerOpenKey(courseId: number): string {
  return `${DRAWING_DRAWER_OPEN_KEY_PREFIX}:${courseId}`;
}

export function readDrawingDrawerOpen(courseId: number): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(getDrawingDrawerOpenKey(courseId)) === "1";
  } catch {
    return false;
  }
}

export function writeDrawingDrawerOpen(courseId: number, isOpen: boolean): void {
  if (typeof window === "undefined") return;
  try {
    const key = getDrawingDrawerOpenKey(courseId);
    if (isOpen) {
      window.localStorage.setItem(key, "1");
    } else {
      window.localStorage.removeItem(key);
    }
  } catch {
    // ignore storage failures
  }
}
