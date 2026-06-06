"use client";

import React, { useMemo, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { ExcalidrawInitialDataState } from "@excalidraw/excalidraw/types";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SketchData {
  comp_id?: string;
  /** Canvas elements (usually empty; shapes come via libraryItems) */
  elements?: unknown[];
  /** Library items: array of element-arrays, each representing one shape group */
  libraryItems?: unknown[][];
  appState?: Record<string, unknown>;
  scrollToContent?: boolean;
  version?: number;
}

// ─── Excalidraw (SSR-safe dynamic import) ────────────────────────────────────

const Excalidraw = dynamic(
  async () => (await import("@excalidraw/excalidraw")).Excalidraw,
  { ssr: false }
);

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Flatten libraryItems (array of element-arrays) into a single list of
 * Excalidraw elements that can be passed to `initialData.elements`.
 * Each item-group gets a synthetic groupId so shapes belonging to the same
 * library item stay visually grouped.
 */
function flattenLibraryItems(libraryItems: unknown[][]): unknown[] {
  const result: unknown[] = [];
  libraryItems.forEach((group, groupIdx) => {
    if (!Array.isArray(group)) return;
    const groupId = `sketch-group-${groupIdx}`;
    group.forEach((element) => {
      if (!element || typeof element !== "object") return;
      const el = element as Record<string, unknown>;
      // Merge our synthetic groupId into any existing groupIds array.
      const existingGroupIds: string[] = Array.isArray(el.groupIds)
        ? (el.groupIds as string[])
        : [];
      result.push({
        ...el,
        groupIds: existingGroupIds.includes(groupId)
          ? existingGroupIds
          : [groupId, ...existingGroupIds],
      });
    });
  });
  return result;
}

/**
 * Build safe appState: strip runtime-only keys that break rehydration and
 * force `viewModeEnabled` + `zenModeEnabled` so users cannot edit.
 */
function buildAppState(
  raw: Record<string, unknown> | undefined
): Record<string, unknown> {
  const base: Record<string, unknown> = raw ? { ...raw } : {};
  delete base.collaborators;
  delete base.followedBy;
  delete base.userToFollow;
  // Force read-only / view-only
  base.viewModeEnabled = true;
  base.zenModeEnabled = false;
  return base;
}

// ─── Inner viewer (rendered client-side only) ─────────────────────────────────

function SketchViewer({ data }: { data: SketchData }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  // Track system / site dark-mode class
  useEffect(() => {
    const sync = () =>
      setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  // Set EXCALIDRAW_ASSET_PATH so fonts/wasm load from the root
  useEffect(() => {
    const w = window as Window & { EXCALIDRAW_ASSET_PATH?: string };
    if (!w.EXCALIDRAW_ASSET_PATH) w.EXCALIDRAW_ASSET_PATH = "/";
  }, []);

  const initialData = useMemo<ExcalidrawInitialDataState>(() => {
    // Prefer explicit elements; fall back to flattened libraryItems.
    const rawElements = Array.isArray(data.elements) ? data.elements : [];
    const libraryItems = Array.isArray(data.libraryItems) ? data.libraryItems : [];
    const elements =
      rawElements.length > 0 ? rawElements : flattenLibraryItems(libraryItems);

    return {
      elements: elements as ExcalidrawInitialDataState["elements"],
      appState: buildAppState(data.appState) as ExcalidrawInitialDataState["appState"],
      scrollToContent: data.scrollToContent !== false,
    };
  }, [data]);

  return (
    <div ref={containerRef} style={{ width: "100%", height: "480px" }}>
      <Excalidraw
        initialData={initialData}
        viewModeEnabled
        zenModeEnabled={false}
        gridModeEnabled={false}
        theme={theme}
      />
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export default function Sketch({ data }: { data: SketchData }) {
  const hasContent = useMemo(() => {
    const hasElements =
      Array.isArray(data.elements) && data.elements.length > 0;
    const hasLibrary =
      Array.isArray(data.libraryItems) && data.libraryItems.length > 0;
    return hasElements || hasLibrary;
  }, [data]);

  if (!hasContent) {
    return (
      <div className="flex items-center justify-center h-40 text-sm text-gray-400 italic">
        No sketch content available.
      </div>
    );
  }

  return (
    <div className="w-full rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden bg-white dark:bg-gray-900 shadow-sm">
      {/* Header bar */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-950">
        <svg
          className="w-4 h-4 text-indigo-500 shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
        </svg>
        <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 tracking-wide">
          Sketch
        </span>
      </div>

      {/* Canvas */}
      <SketchViewer data={data} />
    </div>
  );
}
