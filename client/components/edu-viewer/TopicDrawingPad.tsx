"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type {
  ExcalidrawImperativeAPI,
  ExcalidrawInitialDataState,
  LibraryItem,
  LibraryItems,
} from "@excalidraw/excalidraw/types";
import type { ViewerDrawingScene } from "@/utils/authClient";

const Excalidraw = dynamic(
  async () => (await import("@excalidraw/excalidraw")).Excalidraw,
  { ssr: false }
);
const ExcalidrawLibraryHandler = dynamic(
  async () => (await import("./ExcalidrawLibraryHandler")).default,
  { ssr: false }
);

interface Props {
  topicTitle: string;
  initialScene: ViewerDrawingScene | null;
  saveBusy: boolean;
  onSave: (scene: ViewerDrawingScene) => Promise<void>;
  onDelete: () => Promise<void>;
  onClose: () => void;
}

interface ExcalidrawLibraryAuthor {
  name: string;
  url?: string;
}

interface ExcalidrawLibraryItem {
  id: string;
  name: string;
  description?: string;
  source: string;
  preview?: string;
  itemNames?: string[];
  authors?: ExcalidrawLibraryAuthor[];
}

interface SourceLibraryMeta {
  signatures: string[];
  names: string[];
}

const EXCALIDRAW_LIBRARIES_BASE_URL = "https://libraries.excalidraw.com";
const LIBRARY_SOURCE_SIGNATURES_STORAGE_KEY = "ev_library_source_signatures_v1";
const LIBRARY_SOURCE_PRESENCE_STORAGE_KEY = "ev_library_source_presence_v1";

function toSerializableScene(scene: ViewerDrawingScene): ViewerDrawingScene {
  return JSON.parse(JSON.stringify(scene)) as ViewerDrawingScene;
}

function sanitizeAppState(value: Record<string, unknown>): Record<string, unknown> {
  const next = { ...value };
  // Collaboration runtime fields are Map/Set in-memory and may break restore.
  delete next.collaborators;
  delete next.followedBy;
  delete next.userToFollow;
  return next;
}

function buildContentSignature(
  elements: readonly unknown[],
  files: Record<string, unknown>,
): string {
  const normalizedElements = (Array.isArray(elements) ? elements : [])
    .filter((item) => {
      if (!item || typeof item !== "object") return false;
      const element = item as Record<string, unknown>;
      // Excalidraw uses transient selection elements during interaction.
      if (element.type === "selection") return false;
      // Deleted rows should not impact dirty check.
      if (element.isDeleted === true) return false;
      return true;
    })
    .map((item) => {
      const element = { ...(item as Record<string, unknown>) };
      // Volatile runtime fields that change without semantic drawing edits.
      delete element.version;
      delete element.versionNonce;
      delete element.updated;
      return element;
    });

  const normalizedFiles = Object.fromEntries(
    Object.entries(files || {})
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([id, value]) => {
        const file = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
        return [
          id,
          {
            id,
            mimeType: file.mimeType ?? "",
            dataURL: file.dataURL ?? "",
            created: file.created ?? "",
            size: file.size ?? "",
          },
        ];
      }),
  );

  return JSON.stringify({
    elements: normalizedElements,
    files: normalizedFiles,
  });
}

function contentSignatureFromScene(scene: ViewerDrawingScene): string {
  return buildContentSignature(
    Array.isArray(scene.elements) ? scene.elements : [],
    scene.files && typeof scene.files === "object" ? scene.files : {},
  );
}

function buildSerializableScene(
  elements: readonly unknown[],
  appState: Record<string, unknown>,
  files: Record<string, unknown>,
): ViewerDrawingScene {
  return toSerializableScene({
    elements: Array.isArray(elements) ? elements : [],
    appState: sanitizeAppState(appState),
    files: files && typeof files === "object" ? files : {},
  });
}

function contentSignatureFromUnknown(
  elements: readonly unknown[],
  files: Record<string, unknown>,
): string {
  try {
    return buildContentSignature(
      Array.isArray(elements) ? elements : [],
      files && typeof files === "object" ? files : {},
    );
  } catch {
    return "";
  }
}

function extractLibraryUrlFromInput(input: string): string | null {
  const raw = String(input || "").trim();
  if (!raw) return null;

  const maybeDecode = (value: string): string => {
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  };

  try {
    const parsed = new URL(raw);
    const hash = parsed.hash.startsWith("#") ? parsed.hash.slice(1) : parsed.hash;
    const fromHash = new URLSearchParams(hash).get("addLibrary");
    if (fromHash) return maybeDecode(fromHash);

    const fromQuery = parsed.searchParams.get("addLibrary");
    if (fromQuery) return maybeDecode(fromQuery);

    if (/\.excalidrawlib$/i.test(parsed.pathname)) {
      return parsed.toString();
    }
  } catch {
    // Keep fallback checks below for non-URL input.
  }

  if (/\.excalidrawlib(?:\?|#|$)/i.test(raw)) {
    return maybeDecode(raw);
  }
  return null;
}

function parseLibraryTokensFromCurrentUrl(): { libraryUrl: string; idToken: string | null } | null {
  if (typeof window === "undefined") return null;
  const hash = new URLSearchParams(window.location.hash.slice(1));
  const query = new URLSearchParams(window.location.search);
  const libraryUrl = hash.get("addLibrary") || query.get("addLibrary");
  if (!libraryUrl) return null;
  return {
    libraryUrl,
    idToken: hash.get("token"),
  };
}

function removeLibraryTokensFromCurrentUrl(): void {
  if (typeof window === "undefined") return;
  const hash = new URLSearchParams(window.location.hash.slice(1));
  const query = new URLSearchParams(window.location.search);
  hash.delete("addLibrary");
  hash.delete("token");
  query.delete("addLibrary");
  const nextUrl = `${window.location.pathname}${query.toString() ? `?${query.toString()}` : ""}${hash.toString() ? `#${hash.toString()}` : ""}`;
  window.history.replaceState({}, "", nextUrl);
}

function encodeLibraryPath(path: string): string {
  return String(path || "")
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function buildLibraryAssetUrl(sourcePath: string): string {
  return `${EXCALIDRAW_LIBRARIES_BASE_URL}/libraries/${encodeLibraryPath(sourcePath)}`;
}

function computeLibrarySourcePresenceMap(
  sourceMetaMap: Record<string, SourceLibraryMeta>,
  activeSignatures: Set<string>,
  activeNames: Set<string>,
): Record<string, boolean> {
  const next: Record<string, boolean> = {};
  for (const [source, meta] of Object.entries(sourceMetaMap)) {
    const names = Array.isArray(meta?.names) ? meta.names.filter(Boolean) : [];
    if (names.length > 0) {
      next[source] = names.every((name) => activeNames.has(name));
      continue;
    }

    const signatures = Array.isArray(meta?.signatures) ? meta.signatures.filter(Boolean) : [];
    if (signatures.length === 0) {
      next[source] = false;
      continue;
    }
    next[source] = signatures.every((signature) => activeSignatures.has(signature));
  }
  return next;
}

function normalizeLibraryElementForSignature(element: unknown): string {
  if (!element || typeof element !== "object") return "";
  const next = { ...(element as Record<string, unknown>) };
  // Ignore runtime/non-semantic metadata so we can detect true content duplicates.
  delete next.id;
  delete next.seed;
  delete next.version;
  delete next.versionNonce;
  delete next.updated;
  delete next.index;
  delete next.groupIds;
  delete next.boundElements;
  return JSON.stringify(next);
}

function getLibraryItemSignature(item: Pick<LibraryItem, "elements">): string {
  const normalizedElements = Array.isArray(item.elements)
    ? item.elements.map((element) => normalizeLibraryElementForSignature(element))
    : [];
  return JSON.stringify(normalizedElements);
}

function isLibraryItemObject(value: unknown): value is LibraryItem {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return typeof row.id === "string" && Array.isArray(row.elements);
}

function parseLibraryItemsFromUnknown(raw: unknown): LibraryItems {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    if (raw.length === 0) return [];
    if (raw.every((entry) => isLibraryItemObject(entry))) {
      return raw as LibraryItems;
    }
    // Legacy library shape: array of element-arrays.
    if (raw.every((entry) => Array.isArray(entry))) {
      return raw.map((entry, index) => ({
        id: `legacy-${index}`,
        status: "published" as const,
        elements: entry as LibraryItem["elements"],
        created: Date.now(),
      }));
    }
    return [];
  }
  if (typeof raw === "object") {
    const objectRaw = raw as Record<string, unknown>;
    if ("libraryItems" in objectRaw) {
      return parseLibraryItemsFromUnknown(objectRaw.libraryItems);
    }
  }
  return [];
}

async function parseLibraryItemsFromBlob(blob: Blob): Promise<LibraryItems> {
  try {
    const text = await blob.text();
    if (!text.trim()) return [];
    const parsed = JSON.parse(text) as unknown;
    return parseLibraryItemsFromUnknown(parsed);
  } catch {
    return [];
  }
}

export default function TopicDrawingPad({
  topicTitle,
  initialScene,
  saveBusy,
  onSave,
  onDelete,
  onClose,
}: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null);
  const [dirty, setDirty] = useState(false);
  const [localSaveBusy, setLocalSaveBusy] = useState(false);
  const [localDeleteBusy, setLocalDeleteBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [libraryImportError, setLibraryImportError] = useState<string | null>(null);
  const [libraryImportBusy, setLibraryImportBusy] = useState(false);
  const [libraryBrowserOpen, setLibraryBrowserOpen] = useState(false);
  const [libraryCatalog, setLibraryCatalog] = useState<ExcalidrawLibraryItem[]>([]);
  const [libraryCatalogBusy, setLibraryCatalogBusy] = useState(false);
  const [libraryCatalogError, setLibraryCatalogError] = useState<string | null>(null);
  const [libraryCatalogQuery, setLibraryCatalogQuery] = useState("");
  const [librarySourceMetaBySource, setLibrarySourceMetaBySource] = useState<Record<string, SourceLibraryMeta>>({});
  const [librarySourcePresenceBySource, setLibrarySourcePresenceBySource] = useState<Record<string, boolean>>({});
  const [libraryImportingSource, setLibraryImportingSource] = useState<string | null>(null);
  const [pendingLibraryImportUrl, setPendingLibraryImportUrl] = useState<string | null>(null);
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [excalidrawTheme, setExcalidrawTheme] = useState<"dark" | "light">("light");
  const [showDebug, setShowDebug] = useState(false);
  const [debugInfo, setDebugInfo] = useState<{
    pointers: { id: number; type: string; x: number; y: number; isPrimary: boolean }[];
    touches: { id: number; type: string; x: number; y: number; rx: number; ry: number; force: number }[];
    penModeActive: boolean;
    log: string[];
  }>({
    pointers: [],
    touches: [],
    penModeActive: false,
    log: [],
  });
  const activePointersRef = useRef<Map<number, PointerEvent>>(new Map());
  const blockedPointerIdsRef = useRef<Set<number>>(new Set());
  const lastSavedContentKeyRef = useRef<string>("");
  const latestContentKeyRef = useRef<string>("");
  const latestSceneRef = useRef<ViewerDrawingScene | null>(null);
  const baselineInitializedRef = useRef(false);
  const initialSyncPendingRef = useRef(true);
  const saveRevisionRef = useRef(0);
  const suppressDirtyUntilRef = useRef(0);
  const hashImportInFlightRef = useRef(false);
  const libraryItemSignaturesRef = useRef<Set<string>>(new Set());
  const libraryItemNamesRef = useRef<Set<string>>(new Set());
  const librarySourceMetaRef = useRef<Record<string, SourceLibraryMeta>>({});
  const librarySyncInitializedRef = useRef(false);
  const librarySnapshotReadyRef = useRef(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const w = window as Window & { EXCALIDRAW_ASSET_PATH?: string };
      if (!w.EXCALIDRAW_ASSET_PATH) {
        w.EXCALIDRAW_ASSET_PATH = "/";
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(LIBRARY_SOURCE_SIGNATURES_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== "object") return;
      const nextMap: Record<string, SourceLibraryMeta> = {};
      for (const [source, value] of Object.entries(parsed as Record<string, unknown>)) {
        if (typeof source !== "string") continue;
        let signatures: string[] = [];
        let names: string[] = [];
        if (Array.isArray(value)) {
          signatures = value.filter((entry): entry is string => typeof entry === "string" && entry.length > 0);
        } else if (value && typeof value === "object") {
          const row = value as Record<string, unknown>;
          if (Array.isArray(row.signatures)) {
            signatures = row.signatures.filter((entry): entry is string => typeof entry === "string" && entry.length > 0);
          }
          if (Array.isArray(row.names)) {
            names = row.names.filter((entry): entry is string => typeof entry === "string" && entry.length > 0);
          }
        }
        if (signatures.length > 0 || names.length > 0) {
          nextMap[source] = { signatures, names };
        }
      }
      librarySourceMetaRef.current = nextMap;
      setLibrarySourceMetaBySource(nextMap);
    } catch {
      // ignore storage parse errors
    }

    try {
      const rawPresence = localStorage.getItem(LIBRARY_SOURCE_PRESENCE_STORAGE_KEY);
      if (!rawPresence) {
        const optimisticPresenceMap = Object.fromEntries(
          Object.keys(librarySourceMetaRef.current).map((source) => [source, true]),
        ) as Record<string, boolean>;
        if (Object.keys(optimisticPresenceMap).length > 0) {
          setLibrarySourcePresenceBySource(optimisticPresenceMap);
        }
        return;
      }
      const parsedPresence = JSON.parse(rawPresence) as unknown;
      if (!parsedPresence || typeof parsedPresence !== "object") return;
      const nextPresenceMap: Record<string, boolean> = {};
      for (const [source, present] of Object.entries(parsedPresence as Record<string, unknown>)) {
        if (typeof source === "string" && typeof present === "boolean") {
          nextPresenceMap[source] = present;
        }
      }
      setLibrarySourcePresenceBySource(nextPresenceMap);
    } catch {
      // ignore storage parse errors
    }
  }, []);

  // Capture addLibrary tokens early and strip hash/query so app URL stays stable
  // and does not keep re-triggering full-flow redirects.
  useLayoutEffect(() => {
    const tokens = parseLibraryTokensFromCurrentUrl();
    if (!tokens?.libraryUrl) return;
    setPendingLibraryImportUrl(tokens.libraryUrl);
    removeLibraryTokensFromCurrentUrl();
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    const syncTheme = () => {
      setExcalidrawTheme(root.classList.contains("dark") ? "dark" : "light");
    };
    syncTheme();
    const observer = new MutationObserver(syncTheme);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!api) return;
    const refreshNow = () => {
      try {
        api.refresh();
      } catch {
        // No-op. Refresh is best-effort to keep pointer offsets in sync.
      }
    };

    const raf1 = window.requestAnimationFrame(() => {
      refreshNow();
      window.requestAnimationFrame(refreshNow);
    });
    const timeoutId = window.setTimeout(refreshNow, 260);

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined" && rootRef.current) {
      resizeObserver = new ResizeObserver(() => {
        window.requestAnimationFrame(refreshNow);
      });
      resizeObserver.observe(rootRef.current);
    }

    const onWindowResize = () => window.requestAnimationFrame(refreshNow);
    window.addEventListener("resize", onWindowResize);

    return () => {
      window.cancelAnimationFrame(raf1);
      window.clearTimeout(timeoutId);
      window.removeEventListener("resize", onWindowResize);
      if (resizeObserver) resizeObserver.disconnect();
    };
  }, [api]);

  const libraryReturnUrl = useMemo(() => {
    if (typeof window === "undefined") return undefined;
    return window.location.href;
  }, []);

  const filteredLibraryCatalog = useMemo(() => {
    const query = libraryCatalogQuery.trim().toLowerCase();
    if (!query) return libraryCatalog;
    return libraryCatalog.filter((item) => {
      const haystack = [
        item.name,
        item.description ?? "",
        ...(Array.isArray(item.authors) ? item.authors.map((author) => author.name) : []),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [libraryCatalog, libraryCatalogQuery]);

  const initialData = useMemo<ExcalidrawInitialDataState | undefined>(() => {
    const rawAppState =
      initialScene?.appState && typeof initialScene.appState === "object"
        ? { ...initialScene.appState }
        : {};
    // Always default to the thinnest stroke when opening the drawing pad.
    rawAppState.currentItemStrokeWidth = 1;
    // These collaboration-specific fields are Map/Set in runtime and break
    // when rehydrated from plain JSON.
    delete (rawAppState as Record<string, unknown>).collaborators;
    delete (rawAppState as Record<string, unknown>).followedBy;
    delete (rawAppState as Record<string, unknown>).userToFollow;
    return {
      elements: Array.isArray(initialScene?.elements) ? (initialScene.elements as never[]) : [],
      appState: rawAppState as ExcalidrawInitialDataState["appState"],
      files: (initialScene?.files ?? {}) as ExcalidrawInitialDataState["files"],
    };
  }, [initialScene]);

  // ── Pinch-to-Zoom Fix for iPad + Real-time Touch Debugging ──
  const isPinchingRef = useRef(false);
  useEffect(() => {
    if (!api) return;
    const root = rootRef.current;
    if (!root) return;

    const preventDefault = (e: Event) => {
      e.preventDefault();
    };

    // Rolling event log for debug (keep last 8 entries)
    const logLines: string[] = [];
    const addLog = (msg: string) => {
      logLines.push(msg);
      if (logLines.length > 8) logLines.shift();
    };

    // Detect if touches contain a stylus
    const hasStylus = (touches: TouchList): boolean => {
      for (let i = 0; i < touches.length; i++) {
        if ((touches[i] as any).touchType === "stylus") return true;
      }
      return false;
    };

    const isDrawingArea = (target: EventTarget | null) => {
      if (!target) return false;
      const el = target as HTMLElement;
      return el.tagName === "CANVAS" || el.closest(".excalidraw__canvas") !== null;
    };

    const isInteractiveElement = (target: EventTarget | null): boolean => {
      if (!target) return false;
      const el = target as HTMLElement;
      if (el.tagName === "BUTTON" || el.tagName === "INPUT" || el.tagName === "SELECT" || el.tagName === "TEXTAREA" || el.tagName === "A") {
        return true;
      }
      if (typeof el.closest === "function") {
        if (el.closest("button") || el.closest("a") || el.closest(".excalidraw-button") || el.closest("[role='button']")) {
          return true;
        }
      }
      return false;
    };

    const syncDebug = (e: Event) => {
      const appState = api.getAppState();
      const penModeActive = appState ? !!appState.penMode : false;

      const pointersList = Array.from(activePointersRef.current.values()).map(p => ({
        id: p.pointerId,
        type: p.pointerType,
        x: Math.round(p.clientX),
        y: Math.round(p.clientY),
        isPrimary: p.isPrimary,
      }));

      let touchesList: any[] = [];
      if ('touches' in e) {
        touchesList = Array.from((e as TouchEvent).touches).map((t: any) => ({
          id: t.identifier,
          type: t.touchType || "direct",
          x: Math.round(t.clientX),
          y: Math.round(t.clientY),
          rx: Math.round(t.radiusX || 0),
          ry: Math.round(t.radiusY || 0),
          force: t.force || 0,
        }));
      }

      setDebugInfo({
        pointers: pointersList,
        touches: 'touches' in e ? touchesList : [],
        penModeActive,
        log: [...logLines],
      });
    };

    // ── Pointer event handlers ──
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        if (e.pointerType === "touch") {
          e.stopPropagation();
          e.stopImmediatePropagation();
        }
        return;
      }
      const appState = api.getAppState();
      const isPenActive = appState ? !!appState.penMode : false;
      const isHandToolActive = appState?.activeTool?.type === "hand";

      // Scribble Protection: If a textarea is active, block pencil taps on the canvas.
      // This stops Excalidraw from destroying the text box before iPadOS Scribble can inject the handwriting!
      if (e.pointerType === "pen" && document.activeElement?.tagName === "TEXTAREA" && !isInteractiveElement(e.target)) {
        e.stopPropagation();
        e.stopImmediatePropagation();
        addLog(`BLOCKED Scribble tap id=${e.pointerId}`);
        syncDebug(e);
        return;
      }

      if (e.pointerType === "touch") {
        if (isPinchingRef.current) {
          blockedPointerIdsRef.current.add(e.pointerId);
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          return;
        }

        if (isPenActive && !isHandToolActive && !isInteractiveElement(e.target)) {
          blockedPointerIdsRef.current.add(e.pointerId);
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          addLog(`BLOCKED ptr↓ touch id=${e.pointerId}`);
          syncDebug(e);
          return;
        }
      }

      activePointersRef.current.set(e.pointerId, e);
      addLog(`ptr↓ ${e.pointerType} id=${e.pointerId}`);
      syncDebug(e);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (blockedPointerIdsRef.current.has(e.pointerId)) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        return;
      }
      if (!rootRef.current?.contains(e.target as Node)) {
        if (e.pointerType === "touch") {
          e.stopPropagation();
          e.stopImmediatePropagation();
        }
        return;
      }

      if (e.pointerType === "touch") {
        const appState = api.getAppState();
        const isPenActive = appState ? !!appState.penMode : false;
        const isHandToolActive = appState?.activeTool?.type === "hand";

        if (isPenActive && !isHandToolActive && !isInteractiveElement(e.target)) {
          blockedPointerIdsRef.current.add(e.pointerId);
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          return;
        }
      }

      activePointersRef.current.set(e.pointerId, e);

      // Block touch pointer movement from propagating if we are pinch-zooming
      if (e.pointerType === "touch" && isPinchingRef.current) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (blockedPointerIdsRef.current.has(e.pointerId)) {
        blockedPointerIdsRef.current.delete(e.pointerId);
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        addLog(`BLOCKED ptr↑ touch id=${e.pointerId}`);
        syncDebug(e);
        return;
      }
      if (!rootRef.current?.contains(e.target as Node)) {
        if (e.pointerType === "touch") {
          e.stopPropagation();
          e.stopImmediatePropagation();
        }
        return;
      }

      activePointersRef.current.delete(e.pointerId);
      addLog(`ptr↑ ${e.pointerType} id=${e.pointerId}`);
      syncDebug(e);
    };

    const onPointerCancel = (e: PointerEvent) => {
      if (blockedPointerIdsRef.current.has(e.pointerId)) {
        blockedPointerIdsRef.current.delete(e.pointerId);
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        addLog(`BLOCKED ptr✗ touch id=${e.pointerId}`);
        syncDebug(e);
        return;
      }
      if (!rootRef.current?.contains(e.target as Node)) {
        if (e.pointerType === "touch") {
          e.stopPropagation();
          e.stopImmediatePropagation();
        }
        return;
      }

      activePointersRef.current.delete(e.pointerId);
      addLog(`ptr✗ ${e.pointerType} id=${e.pointerId}`);
      syncDebug(e);
    };

    // ── Touch event handlers ──
    let initialPinchDistance = 0;
    let initialZoom = 1;
    let initialScrollX = 0;
    let initialScrollY = 0;
    let initialMidpoint = { x: 0, y: 0 };

    const getPinchDistance = (touches: TouchList) => {
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      return Math.sqrt(dx * dx + dy * dy);
    };

    const onTouchStart = (e: TouchEvent) => {
      const stylusPresent = hasStylus(e.touches);
      if (stylusPresent && e.touches.length > 1) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        return;
      }

      if (!rootRef.current?.contains(e.target as Node)) {
        if (e.touches.length >= 2) {
          e.stopPropagation();
          e.stopImmediatePropagation();
        }
        return;
      }
      const appState = api.getAppState();
      const isPenActive = appState ? !!appState.penMode : false;
      const isHandToolActive = appState?.activeTool?.type === "hand";

      // Count finger-only touches and verify they are inside the container
      let fingerCount = 0;
      let allInside = true;
      for (let i = 0; i < e.touches.length; i++) {
        if (!rootRef.current?.contains(e.touches[i].target as Node)) allInside = false;
        if ((e.touches[i] as any).touchType !== "stylus") fingerCount++;
      }

      addLog(`ts n=${e.touches.length} stylus=${stylusPresent} fingers=${fingerCount}`);
      syncDebug(e);

      if (isPenActive && !isHandToolActive && !stylusPresent && e.touches.length === 1 && !isInteractiveElement(e.target)) {
        e.stopPropagation();
        e.stopImmediatePropagation();
        addLog("BLOCKED finger touchstart");
        syncDebug(e);
        return;
      }

      // Pinch zoom when exactly 2 finger touches AND both are inside the container
      if (fingerCount === 2 && allInside && !stylusPresent) {
        isPinchingRef.current = true;
        initialPinchDistance = getPinchDistance(e.touches);
        initialZoom = appState ? appState.zoom.value : 1;
        initialScrollX = appState ? appState.scrollX : 0;
        initialScrollY = appState ? appState.scrollY : 0;

        const rect = root.getBoundingClientRect();
        initialMidpoint = {
          x: (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left,
          y: (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top,
        };

        // Cancel all active touch pointers in Excalidraw to prevent long-press/context-menu bugs!
        activePointersRef.current.forEach((p, id) => {
          if (p.pointerType === "touch") {
            try {
              const cancelEvent = new PointerEvent("pointercancel", {
                pointerId: id,
                pointerType: "touch",
                bubbles: true,
                cancelable: true,
                clientX: p.clientX,
                clientY: p.clientY,
              });
              p.target?.dispatchEvent(cancelEvent);
            } catch (err) { }
            blockedPointerIdsRef.current.add(id);
          }
        });
      } else if (fingerCount < 2) {
        isPinchingRef.current = false;
        initialPinchDistance = 0;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      const stylusPresent = hasStylus(e.touches);
      if (stylusPresent && e.touches.length > 1) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        return;
      }

      if (!rootRef.current?.contains(e.target as Node)) {
        if (e.touches.length >= 2) {
          e.stopPropagation();
          e.stopImmediatePropagation();
        }
        return;
      }
      const appState = api.getAppState();
      const isPenActive = appState ? !!appState.penMode : false;
      const isHandToolActive = appState?.activeTool?.type === "hand";

      // Count finger-only touches and verify they are inside the container
      let fingerCount = 0;
      let allInside = true;
      for (let i = 0; i < e.touches.length; i++) {
        if (!rootRef.current?.contains(e.touches[i].target as Node)) allInside = false;
        if ((e.touches[i] as any).touchType !== "stylus") fingerCount++;
      }

      syncDebug(e);

      if (isPenActive && !isHandToolActive && !stylusPresent && e.touches.length === 1 && !isInteractiveElement(e.target)) {
        e.stopPropagation();
        e.stopImmediatePropagation();
        return;
      }

      if (fingerCount === 2 && allInside && !stylusPresent && initialPinchDistance > 0 && appState) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        const currentDistance = getPinchDistance(e.touches);
        const rect = root.getBoundingClientRect();
        const currentMidpointX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
        const currentMidpointY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;

        const dx = currentMidpointX - initialMidpoint.x;
        const dy = currentMidpointY - initialMidpoint.y;

        // Dampen the zoom sensitivity heavily so accidental distance changes during a pan are ignored
        const rawScale = currentDistance / initialPinchDistance;
        const scale = 1 + (rawScale - 1) * 0.4;

        const MIN_ZOOM = 0.1;
        const MAX_ZOOM = 30;
        const newZoomValue = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, initialZoom * scale));

        // Coordinate transformation: Excalidraw's scrollX/Y is in un-zoomed CANVAS coordinates.
        // We must translate the screen pixel changes into canvas space (by dividing by zoom).
        const scrollX = initialScrollX + initialMidpoint.x * (1 / newZoomValue - 1 / initialZoom) + dx / newZoomValue;
        const scrollY = initialScrollY + initialMidpoint.y * (1 / newZoomValue - 1 / initialZoom) + dy / newZoomValue;

        api.updateScene({
          appState: { ...appState, zoom: { value: newZoomValue }, scrollX, scrollY } as any,
        });
        syncDebug(e);
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      const stylusPresent = hasStylus(e.touches);
      if (stylusPresent && e.touches.length > 1) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        return;
      }

      if (!rootRef.current?.contains(e.target as Node)) {
        if (e.touches.length >= 2) {
          e.stopPropagation();
          e.stopImmediatePropagation();
        }
        return;
      }
      const appState = api.getAppState();
      const isPenActive = appState ? !!appState.penMode : false;
      const isHandToolActive = appState?.activeTool?.type === "hand";

      addLog(`te n=${e.touches.length}`);
      syncDebug(e);
      if (e.touches.length < 2) {
        isPinchingRef.current = false;
        initialPinchDistance = 0;
      }
    };

    root.addEventListener("gesturestart", preventDefault, { passive: false });
    root.addEventListener("gesturechange", preventDefault, { passive: false });

    // Protect Excalidraw's global window listeners from panicking over outside events (like left pane scrolling/gestures)
    const stopOutsideEventPropagation = (e: Event) => {
      // Excalidraw usually only cares about touch and pen for gestures. Let mouse clicks on outside UI bubble up safely.
      if ('pointerType' in e && (e as PointerEvent).pointerType === 'mouse') return;
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        e.stopPropagation();
        e.stopImmediatePropagation();
      }
    };
    document.addEventListener("pointerdown", stopOutsideEventPropagation);
    document.addEventListener("pointermove", stopOutsideEventPropagation);
    document.addEventListener("pointerup", stopOutsideEventPropagation);
    document.addEventListener("touchstart", stopOutsideEventPropagation, { passive: false });
    document.addEventListener("touchmove", stopOutsideEventPropagation, { passive: false });
    document.addEventListener("touchend", stopOutsideEventPropagation);
    document.addEventListener("gesturestart", stopOutsideEventPropagation, { passive: false });
    document.addEventListener("gesturechange", stopOutsideEventPropagation, { passive: false });
    document.addEventListener("gestureend", stopOutsideEventPropagation);

    const stopOutsideGesturePropagation = (e: Event) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        e.stopPropagation();
        e.stopImmediatePropagation();
      }
    };
    window.addEventListener("gesturestart", stopOutsideGesturePropagation, { capture: true, passive: false });
    window.addEventListener("gesturechange", stopOutsideGesturePropagation, { capture: true, passive: false });
    window.addEventListener("gestureend", stopOutsideGesturePropagation, { capture: true });

    // Pointer events: capture phase for blocking/filtering
    window.addEventListener("pointerdown", onPointerDown, { capture: true });
    window.addEventListener("pointerup", onPointerUp, { capture: true });
    window.addEventListener("pointercancel", onPointerCancel, { capture: true });
    window.addEventListener("pointermove", onPointerMove, { capture: true, passive: false });

    // Touch events: capture phase globally on window to intercept all regions
    window.addEventListener("touchstart", onTouchStart, { capture: true, passive: false });
    window.addEventListener("touchmove", onTouchMove, { capture: true, passive: false });
    window.addEventListener("touchend", onTouchEnd, { capture: true, passive: false });
    window.addEventListener("touchcancel", onTouchEnd, { capture: true, passive: false });

    return () => {
      root.removeEventListener("gesturestart", preventDefault);
      root.removeEventListener("gesturechange", preventDefault);
      
      document.removeEventListener("pointerdown", stopOutsideEventPropagation);
      document.removeEventListener("pointermove", stopOutsideEventPropagation);
      document.removeEventListener("pointerup", stopOutsideEventPropagation);
      document.removeEventListener("touchstart", stopOutsideEventPropagation);
      document.removeEventListener("touchmove", stopOutsideEventPropagation);
      document.removeEventListener("touchend", stopOutsideEventPropagation);
      document.removeEventListener("gesturestart", stopOutsideEventPropagation);
      document.removeEventListener("gesturechange", stopOutsideEventPropagation);
      document.removeEventListener("gestureend", stopOutsideEventPropagation);

      window.removeEventListener("gesturestart", stopOutsideGesturePropagation, { capture: true });
      window.removeEventListener("gesturechange", stopOutsideGesturePropagation, { capture: true });
      window.removeEventListener("gestureend", stopOutsideGesturePropagation, { capture: true });

      window.removeEventListener("pointerdown", onPointerDown, { capture: true });
      window.removeEventListener("pointerup", onPointerUp, { capture: true });
      window.removeEventListener("pointercancel", onPointerCancel, { capture: true });
      window.removeEventListener("pointermove", onPointerMove, { capture: true });
      window.removeEventListener("touchstart", onTouchStart, { capture: true });
      window.removeEventListener("touchmove", onTouchMove, { capture: true });
      window.removeEventListener("touchend", onTouchEnd, { capture: true });
      window.removeEventListener("touchcancel", onTouchEnd, { capture: true });
    };
  }, [api]);

  useEffect(() => {
    if (baselineInitializedRef.current) return;
    if (!initialData) {
      lastSavedContentKeyRef.current = "";
      latestContentKeyRef.current = "";
      latestSceneRef.current = null;
      baselineInitializedRef.current = true;
      initialSyncPendingRef.current = true;
      return;
    }
    const scene = buildSerializableScene(
      (initialData.elements ?? []) as readonly unknown[],
      (initialData.appState ?? {}) as Record<string, unknown>,
      (initialData.files ?? {}) as Record<string, unknown>,
    );
    const key = contentSignatureFromScene(scene);
    lastSavedContentKeyRef.current = key;
    latestContentKeyRef.current = key;
    latestSceneRef.current = scene;
    baselineInitializedRef.current = true;
    initialSyncPendingRef.current = true;
  }, [initialData]);

  useEffect(() => {
    // Keep editor clean when freshly opened.
    if (!baselineInitializedRef.current) {
      setDirty(false);
      return;
    }
    setDirty(false);
    setSaveError(null);
    setConfirmCloseOpen(false);
    setConfirmDeleteOpen(false);
  }, [initialData]);

  useEffect(() => {
    if (!api) return;
    api.updateScene({
      appState: {
        ...(api.getAppState() as unknown as Record<string, unknown>),
        theme: excalidrawTheme,
      } as never,
    });
  }, [api, excalidrawTheme]);

  const handleSave = useCallback(async (): Promise<boolean> => {
    if (!api) return false;
    const revision = saveRevisionRef.current + 1;
    saveRevisionRef.current = revision;
    setLocalSaveBusy(true);
    setSaveError(null);
    try {
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve());
      });
      const nextScene = latestSceneRef.current ?? buildSerializableScene(
        api.getSceneElements() as readonly unknown[],
        api.getAppState() as unknown as Record<string, unknown>,
        api.getFiles() as unknown as Record<string, unknown>,
      );
      const sceneKey = latestContentKeyRef.current || contentSignatureFromScene(nextScene);
      await onSave(nextScene);
      if (saveRevisionRef.current !== revision) {
        return false;
      }
      lastSavedContentKeyRef.current = sceneKey;
      latestContentKeyRef.current = sceneKey;
      latestSceneRef.current = nextScene;
      suppressDirtyUntilRef.current = Date.now() + 300;
      setConfirmCloseOpen(false);
      setDirty(false);
      return true;
    } catch (err: unknown) {
      const message = err instanceof Error && err.message
        ? err.message
        : "Could not save drawing notes. Please try again.";
      setSaveError(message);
      return false;
    } finally {
      setLocalSaveBusy(false);
    }
  }, [api, onSave]);

  const handleClose = useCallback(() => {
    if (dirty) {
      setConfirmCloseOpen(true);
      return;
    }
    onClose();
  }, [dirty, onClose]);

  const performDelete = useCallback(async (): Promise<boolean> => {
    if (!api) return false;
    setLocalDeleteBusy(true);
    setSaveError(null);
    try {
      await onDelete();
      const nextAppState = {
        ...(api.getAppState() as unknown as Record<string, unknown>),
        currentItemStrokeWidth: 1,
      };
      api.updateScene({
        elements: [],
        appState: nextAppState as never,
      });
      const clearedScene = buildSerializableScene([], nextAppState, {});
      const clearedKey = contentSignatureFromScene(clearedScene);
      lastSavedContentKeyRef.current = clearedKey;
      latestContentKeyRef.current = clearedKey;
      latestSceneRef.current = clearedScene;
      suppressDirtyUntilRef.current = Date.now() + 300;
      setConfirmCloseOpen(false);
      setConfirmDeleteOpen(false);
      setDirty(false);
      return true;
    } catch (err: unknown) {
      const message = err instanceof Error && err.message
        ? err.message
        : "Could not delete drawing notes. Please try again.";
      setSaveError(message);
      return false;
    } finally {
      setLocalDeleteBusy(false);
    }
  }, [api, onDelete]);

  const busy = saveBusy || localSaveBusy || localDeleteBusy;

  const handleDelete = useCallback(() => {
    if (busy || !api) return;
    setConfirmDeleteOpen(true);
  }, [api, busy]);

  const loadLibraryCatalog = useCallback(async () => {
    if (libraryCatalogBusy) return;
    setLibraryCatalogBusy(true);
    setLibraryCatalogError(null);
    try {
      const response = await fetch(`${EXCALIDRAW_LIBRARIES_BASE_URL}/libraries.json`, {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error(`Could not load libraries (${response.status}).`);
      }
      const raw = await response.json();
      if (!Array.isArray(raw)) {
        throw new Error("Received an invalid libraries response.");
      }
      const items: ExcalidrawLibraryItem[] = raw
        .filter((entry): entry is ExcalidrawLibraryItem => (
          Boolean(entry)
          && typeof entry === "object"
          && typeof (entry as ExcalidrawLibraryItem).id === "string"
          && typeof (entry as ExcalidrawLibraryItem).name === "string"
          && typeof (entry as ExcalidrawLibraryItem).source === "string"
        ))
        .sort((a, b) => a.name.localeCompare(b.name));
      setLibraryCatalog(items);
    } catch (err: unknown) {
      const message = err instanceof Error && err.message
        ? err.message
        : "Could not load Browser Libraries.";
      setLibraryCatalogError(message);
    } finally {
      setLibraryCatalogBusy(false);
    }
  }, [libraryCatalogBusy]);

  const handleOpenLibraryBrowser = useCallback(() => {
    setLibraryImportError(null);
    setLibraryCatalogError(null);
    setLibraryBrowserOpen(true);
    if (!libraryCatalogBusy && libraryCatalog.length === 0) {
      void loadLibraryCatalog();
    }
  }, [libraryCatalog.length, libraryCatalogBusy, loadLibraryCatalog]);

  const persistLibrarySourceMeta = useCallback((nextMap: Record<string, SourceLibraryMeta>) => {
    librarySourceMetaRef.current = nextMap;
    setLibrarySourceMetaBySource(nextMap);
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(LIBRARY_SOURCE_SIGNATURES_STORAGE_KEY, JSON.stringify(nextMap));
    } catch {
      // ignore storage write errors
    }
  }, []);

  const persistLibrarySourcePresence = useCallback((nextMap: Record<string, boolean>) => {
    setLibrarySourcePresenceBySource(nextMap);
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(LIBRARY_SOURCE_PRESENCE_STORAGE_KEY, JSON.stringify(nextMap));
    } catch {
      // ignore storage write errors
    }
  }, []);

  useEffect(() => {
    if (libraryCatalog.length === 0) return;
    let changed = false;
    const nextMap: Record<string, SourceLibraryMeta> = { ...librarySourceMetaRef.current };
    for (const library of libraryCatalog) {
      const names = Array.isArray(library.itemNames)
        ? library.itemNames.map((entry) => String(entry).trim()).filter(Boolean)
        : [];
      if (names.length === 0) continue;
      const current = nextMap[library.source];
      if (!current || current.names.length === 0) {
        nextMap[library.source] = {
          signatures: current?.signatures ?? [],
          names,
        };
        changed = true;
      }
    }
    if (changed) {
      persistLibrarySourceMeta(nextMap);
    }
  }, [libraryCatalog, persistLibrarySourceMeta]);

  const handleLibraryChange = useCallback((libraryItems: LibraryItems) => {
    librarySnapshotReadyRef.current = true;
    const signatures = new Set<string>();
    const names = new Set<string>();
    for (const item of libraryItems) {
      const signature = getLibraryItemSignature(item);
      if (signature) signatures.add(signature);
      const name = typeof item.name === "string" ? item.name.trim() : "";
      if (name) names.add(name);
    }
    libraryItemSignaturesRef.current = signatures;
    libraryItemNamesRef.current = names;
    persistLibrarySourcePresence(
      computeLibrarySourcePresenceMap(librarySourceMetaRef.current, signatures, names),
    );
  }, [persistLibrarySourcePresence]);

  useEffect(() => {
    if (!librarySnapshotReadyRef.current) return;
    persistLibrarySourcePresence(
      computeLibrarySourcePresenceMap(
        librarySourceMetaBySource,
        libraryItemSignaturesRef.current,
        libraryItemNamesRef.current,
      ),
    );
  }, [librarySourceMetaBySource, persistLibrarySourcePresence]);

  useEffect(() => {
    if (!api || librarySyncInitializedRef.current) return;
    librarySyncInitializedRef.current = true;
    void api.updateLibrary({
      libraryItems: (currentItems) => {
        handleLibraryChange(currentItems);
        return currentItems;
      },
      merge: false,
      openLibraryMenu: false,
    }).catch(() => {
      // best-effort bootstrap
    });
  }, [api, handleLibraryChange]);

  const importLibraryBlobWithDedupe = useCallback(async (
    blob: Blob,
    sourceKey?: string,
  ) => {
    if (!api) return false;

    const parsedItems = await parseLibraryItemsFromBlob(blob);
    const existingSignatures = libraryItemSignaturesRef.current;
    const existingNames = libraryItemNamesRef.current;
    let nextItemsToImport: LibraryItems | null = null;
    const parsedSignatures: string[] = [];
    const parsedNames: string[] = [];

    if (parsedItems.length > 0) {
      const seenSignatures = new Set<string>();
      const seenNames = new Set<string>();
      for (const item of parsedItems) {
        const signature = getLibraryItemSignature(item);
        if (signature && !seenSignatures.has(signature)) {
          seenSignatures.add(signature);
          parsedSignatures.push(signature);
        }
        const name = typeof item.name === "string" ? item.name.trim() : "";
        if (name && !seenNames.has(name)) {
          seenNames.add(name);
          parsedNames.push(name);
        }
      }

      nextItemsToImport = parsedItems.filter((item) => {
        const itemName = typeof item.name === "string" ? item.name.trim() : "";
        if (itemName && existingNames.has(itemName)) return false;
        const signature = getLibraryItemSignature(item);
        return signature ? !existingSignatures.has(signature) : true;
      });

      if (nextItemsToImport.length === 0) {
        return false;
      }
    }

    await api.updateLibrary({
      libraryItems: Promise.resolve(nextItemsToImport ?? blob),
      merge: true,
      openLibraryMenu: false,
      defaultStatus: "published",
    });

    if (nextItemsToImport && nextItemsToImport.length > 0) {
      const mergedSignatures = new Set(existingSignatures);
      const mergedNames = new Set(existingNames);
      for (const item of nextItemsToImport) {
        const signature = getLibraryItemSignature(item);
        if (signature) mergedSignatures.add(signature);
        const name = typeof item.name === "string" ? item.name.trim() : "";
        if (name) mergedNames.add(name);
      }
      libraryItemSignaturesRef.current = mergedSignatures;
      libraryItemNamesRef.current = mergedNames;
      persistLibrarySourcePresence(
        computeLibrarySourcePresenceMap(
          librarySourceMetaRef.current,
          mergedSignatures,
          mergedNames,
        ),
      );
    }

    if (sourceKey && (parsedSignatures.length > 0 || parsedNames.length > 0)) {
      const nextSourceMap: Record<string, SourceLibraryMeta> = {
        ...librarySourceMetaRef.current,
        [sourceKey]: {
          signatures: parsedSignatures,
          names: parsedNames,
        },
      };
      persistLibrarySourceMeta(nextSourceMap);
      persistLibrarySourcePresence(
        computeLibrarySourcePresenceMap(
          nextSourceMap,
          libraryItemSignaturesRef.current,
          libraryItemNamesRef.current,
        ),
      );
    }

    return true;
  }, [api, persistLibrarySourceMeta, persistLibrarySourcePresence]);

  const handleImportLibraryFromCatalog = useCallback(async (library: ExcalidrawLibraryItem) => {
    if (!api || libraryImportBusy) return;
    if (librarySourcePresenceBySource[library.source]) return;
    setLibraryImportBusy(true);
    setLibraryImportingSource(library.source);
    setLibraryImportError(null);
    try {
      const response = await fetch(buildLibraryAssetUrl(library.source));
      if (!response.ok) {
        throw new Error(`Could not load "${library.name}" (${response.status}).`);
      }
      const blob = await response.blob();
      await importLibraryBlobWithDedupe(blob, library.source);
    } catch (err: unknown) {
      const message = err instanceof Error && err.message
        ? err.message
        : `Could not import "${library.name}".`;
      setLibraryImportError(message);
    } finally {
      setLibraryImportBusy(false);
      setLibraryImportingSource(null);
    }
  }, [api, importLibraryBlobWithDedupe, libraryImportBusy, librarySourcePresenceBySource]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onHashChange = () => {
      const tokens = parseLibraryTokensFromCurrentUrl();
      if (!tokens?.libraryUrl) return;
      setPendingLibraryImportUrl(tokens.libraryUrl);
      removeLibraryTokensFromCurrentUrl();
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    if (!api || !pendingLibraryImportUrl) return;
    if (hashImportInFlightRef.current) return;
    hashImportInFlightRef.current = true;
    setLibraryImportBusy(true);
    setLibraryImportError(null);
    const url = extractLibraryUrlFromInput(pendingLibraryImportUrl) ?? pendingLibraryImportUrl;
    void (async () => {
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Could not load library (${response.status}).`);
        }
        const blob = await response.blob();
        await importLibraryBlobWithDedupe(blob);
        setPendingLibraryImportUrl(null);
      } catch (err: unknown) {
        const message = err instanceof Error && err.message
          ? err.message
          : "Could not import library from returned link.";
        setLibraryImportError(message);
      } finally {
        setLibraryImportBusy(false);
        hashImportInFlightRef.current = false;
      }
    })();
  }, [api, importLibraryBlobWithDedupe, pendingLibraryImportUrl]);

  return (
    <div ref={rootRef} className="relative h-full bg-white dark:bg-gray-950 flex flex-col" style={{ touchAction: "none" }}>
      <ExcalidrawLibraryHandler excalidrawAPI={api} />
      <div className="h-14 px-4 border-b border-gray-200 dark:border-gray-800 bg-white/95 dark:bg-gray-950/95 backdrop-blur flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
            Drawing Notes
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
            {topicTitle}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {dirty && (
            <span className="text-[10px] px-2 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 font-medium">
              Unsaved
            </span>
          )}

          {/* Debug Toggle Button */}
          <button
            type="button"
            onClick={() => setShowDebug(!showDebug)}
            title={showDebug ? "Hide Debug Box" : "Show Debug Box"}
            className={`inline-flex items-center justify-center p-2 rounded-lg border transition-all cursor-pointer ${showDebug
                ? "bg-green-50/80 dark:bg-green-950/20 border-green-300 dark:border-green-800 text-green-700 dark:text-green-400"
                : "bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
              }`}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="10" rx="2"></rect>
              <path d="M12 2v9M8 5a4 4 0 0 1 8 0M3 13h18M6 22V11M18 22V11"></path>
            </svg>
          </button>

          {/* Save Button */}
          <button
            type="button"
            onClick={() => { void handleSave(); }}
            disabled={busy || !api}
            title="Save changes"
            className="inline-flex items-center justify-center p-2 rounded-lg border border-sky-300 dark:border-sky-800 text-sky-700 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer bg-white dark:bg-gray-900"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
              <polyline points="17 21 17 13 7 13 7 21"></polyline>
              <polyline points="7 3 7 8 15 8"></polyline>
            </svg>
          </button>

          <button
            type="button"
            onClick={handleOpenLibraryBrowser}
            disabled={busy || !api}
            title="Browse Excalidraw libraries"
            className="inline-flex items-center justify-center p-2 rounded-lg border border-indigo-300 dark:border-indigo-800 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer bg-white dark:bg-gray-900"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18"></path>
              <path d="M3 12h18"></path>
              <path d="M3 18h18"></path>
            </svg>
          </button>

          {/* Delete Button */}
          <button
            type="button"
            onClick={handleDelete}
            disabled={busy || !api}
            title="Clear canvas"
            className="inline-flex items-center justify-center p-2 rounded-lg border border-red-300 dark:border-red-800 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer bg-white dark:bg-gray-900"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              <line x1="10" y1="11" x2="10" y2="17"></line>
              <line x1="14" y1="11" x2="14" y2="17"></line>
            </svg>
          </button>

          {/* Close Button */}
          <button
            type="button"
            onClick={handleClose}
            disabled={busy}
            title="Close drawing pad"
            className="inline-flex items-center justify-center p-2 rounded-lg border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer bg-white dark:bg-gray-900"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      </div>

      {saveError && (
        <div className="px-4 py-2 text-xs text-red-600 dark:text-red-400 border-b border-red-100 dark:border-red-900/40 bg-red-50 dark:bg-red-900/20">
          {saveError}
        </div>
      )}

      {libraryImportError && (
        <div className="px-4 py-2 text-xs text-red-600 dark:text-red-400 border-b border-red-100 dark:border-red-900/40 bg-red-50 dark:bg-red-900/20">
          {libraryImportError}
        </div>
      )}

      {libraryBrowserOpen && (
        <>
          <button
            type="button"
            aria-label="Close library browser"
            onClick={() => setLibraryBrowserOpen(false)}
            className="absolute inset-0 z-[65] bg-black/35"
          />
          <aside className="absolute inset-y-0 left-0 z-[66] w-full max-w-md border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-2xl flex flex-col">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  Browser Libraries
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Add library items, then close this panel.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setLibraryBrowserOpen(false)}
                title="Close"
                aria-label="Close"
                className="inline-flex items-center justify-center h-9 w-9 rounded-md border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
              <input
                type="search"
                value={libraryCatalogQuery}
                onChange={(event) => setLibraryCatalogQuery(event.target.value)}
                placeholder="Search libraries..."
                className="flex-1 h-9 px-3 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="button"
                onClick={() => { void loadLibraryCatalog(); }}
                disabled={libraryCatalogBusy}
                title="Reload libraries"
                aria-label="Reload libraries"
                className="inline-flex items-center justify-center h-9 w-9 rounded-md border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg
                  viewBox="0 0 24 24"
                  width="16"
                  height="16"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={libraryCatalogBusy ? "animate-spin" : ""}
                >
                  <path d="M21 12a9 9 0 1 1-2.64-6.36"></path>
                  <polyline points="21 3 21 9 15 9"></polyline>
                </svg>
              </button>
            </div>

            {libraryCatalogError && (
              <div className="px-4 py-2 border-b border-red-100 dark:border-red-900/40 bg-red-50 dark:bg-red-900/20">
                <p className="text-xs text-red-600 dark:text-red-400">
                  {libraryCatalogError}
                </p>
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-3">
              {libraryCatalogBusy && libraryCatalog.length === 0 && (
                <p className="text-xs text-gray-500 dark:text-gray-400">Loading libraries...</p>
              )}

              {!libraryCatalogBusy && filteredLibraryCatalog.length === 0 && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  No libraries found for this search.
                </p>
              )}

              {filteredLibraryCatalog.length > 0 && (
                <ul className="space-y-2">
                  {filteredLibraryCatalog.map((library) => {
                    const importingThis = libraryImportingSource === library.source && libraryImportBusy;
                    const alreadyInLibrary = Boolean(librarySourcePresenceBySource[library.source]);
                    const authorLabel = Array.isArray(library.authors)
                      ? library.authors.map((author) => author.name).filter(Boolean).join(", ")
                      : "";
                    return (
                      <li key={library.id} className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
                        <div className="aspect-[16/7] bg-gray-100 dark:bg-gray-800">
                          {library.preview ? (
                            <div
                              aria-label={`${library.name} preview`}
                              role="img"
                              className="w-full h-full bg-cover bg-center"
                              style={{ backgroundImage: `url("${buildLibraryAssetUrl(library.preview)}")` }}
                            />
                          ) : null}
                        </div>
                        <div className="relative p-3 space-y-2 pr-14">
                          <div>
                            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                              {library.name}
                            </p>
                            {authorLabel && (
                              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                                {authorLabel}
                              </p>
                            )}
                          </div>
                          <p className="text-xs text-gray-600 dark:text-gray-300 line-clamp-3">
                            {library.description || "No description provided."}
                          </p>
                          <button
                            type="button"
                            onClick={() => { void handleImportLibraryFromCatalog(library); }}
                            disabled={libraryImportBusy || !api || alreadyInLibrary}
                            title={
                              alreadyInLibrary
                                ? "Already added"
                                : importingThis
                                  ? "Adding..."
                                  : "Add library"
                            }
                            aria-label={
                              alreadyInLibrary
                                ? "Already added"
                                : importingThis
                                  ? "Adding..."
                                  : "Add library"
                            }
                            className={`absolute right-3 bottom-3 inline-flex items-center justify-center h-9 w-9 rounded-full border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                              alreadyInLibrary
                                ? "border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/20"
                                : "border-indigo-300 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
                            }`}
                          >
                            {alreadyInLibrary ? (
                              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12"></polyline>
                              </svg>
                            ) : importingThis ? (
                              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
                                <path d="M21 12a9 9 0 1 1-2.64-6.36"></path>
                                <polyline points="21 3 21 9 15 9"></polyline>
                              </svg>
                            ) : (
                              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="12" y1="5" x2="12" y2="19"></line>
                                <line x1="5" y1="12" x2="19" y2="12"></line>
                              </svg>
                            )}
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </aside>
        </>
      )}

      {confirmCloseOpen && (
        <div className="absolute inset-0 z-[70] bg-black/45 flex items-center justify-center px-4">
          <div className="w-full max-w-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-2xl p-4">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Unsaved changes
            </p>
            <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">
              You have unsaved drawing changes. Close without saving?
            </p>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmCloseOpen(false)}
                className="inline-flex items-center px-3 py-1.5 rounded-md border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmCloseOpen(false);
                  onClose();
                }}
                className="inline-flex items-center px-3 py-1.5 rounded-md border border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30 text-xs font-semibold transition-colors cursor-pointer"
              >
                Close without saving
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteOpen && (
        <div className="absolute inset-0 z-[70] bg-black/45 flex items-center justify-center px-4">
          <div className="w-full max-w-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-2xl p-4">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Delete drawing?
            </p>
            <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">
              This will remove the drawing from this course and clear the board.
            </p>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirmDeleteOpen(false)}
                className="inline-flex items-center px-3 py-1.5 rounded-md border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy || !api}
                onClick={() => { void performDelete(); }}
                className="inline-flex items-center px-3 py-1.5 rounded-md border border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 min-h-0">
        <Excalidraw
          excalidrawAPI={(editorApi) => setApi(editorApi)}
          initialData={initialData}
          libraryReturnUrl={libraryReturnUrl}
          theme={excalidrawTheme}
          onLibraryChange={handleLibraryChange}
          onChange={(elements, appState, files) => {
            const currentScene = buildSerializableScene(
              elements as readonly unknown[],
              appState as unknown as Record<string, unknown>,
              files as unknown as Record<string, unknown>,
            );
            const currentKey = contentSignatureFromUnknown(
              elements as readonly unknown[],
              files as unknown as Record<string, unknown>,
            );
            latestSceneRef.current = currentScene;
            latestContentKeyRef.current = currentKey;
            if (initialSyncPendingRef.current) {
              initialSyncPendingRef.current = false;
              lastSavedContentKeyRef.current = currentKey;
              setDirty(false);
              return;
            }
            if (!lastSavedContentKeyRef.current) {
              lastSavedContentKeyRef.current = currentKey;
              setDirty(false);
              return;
            }
            if (Date.now() < suppressDirtyUntilRef.current && currentKey === lastSavedContentKeyRef.current) {
              setDirty(false);
              return;
            }
            setDirty(currentKey !== lastSavedContentKeyRef.current);
            if (saveError) setSaveError(null);
          }}
        />
      </div>

      {/* Debug Overlay Box */}
      {showDebug && (
        <div className="absolute bottom-4 right-4 z-[60] bg-black/90 text-white font-mono text-[10px] p-3 rounded-lg border border-gray-700 shadow-xl w-[280px] pointer-events-none select-none max-h-[350px] overflow-y-auto">
          <div className="font-bold text-amber-400 mb-1 border-b border-gray-700 pb-1 flex justify-between items-center">
            <span>Drawing Pad Debug Box</span>
            <span className="text-[8px] bg-amber-400/20 text-amber-300 px-1 rounded">V2</span>
          </div>
          <div>Pen Mode: <span className={debugInfo.penModeActive ? "text-green-400 font-bold" : "text-red-400 font-bold"}>{debugInfo.penModeActive ? "ACTIVE" : "INACTIVE"}</span></div>

          <div className="mt-1 font-bold text-sky-400 border-b border-gray-800 pb-0.5">Active Touch Contacts ({debugInfo.touches.length})</div>
          {debugInfo.touches.length === 0 ? (
            <div className="text-gray-500 italic">No touch contacts</div>
          ) : (
            debugInfo.touches.map((t, idx) => (
              <div key={t.id} className="pl-1 border-l border-sky-800 my-0.5">
                T{idx}: ID={t.id} type={t.type === "stylus" ? "PEN" : "FINGER"}
                <br />
                x={t.x} y={t.y} force={t.force.toFixed(2)}
              </div>
            ))
          )}

          <div className="mt-1 font-bold text-purple-400 border-b border-gray-800 pb-0.5">Active Pointers ({debugInfo.pointers.length})</div>
          {debugInfo.pointers.length === 0 ? (
            <div className="text-gray-500 italic">No pointers</div>
          ) : (
            debugInfo.pointers.map((p, idx) => (
              <div key={p.id} className="pl-1 border-l border-purple-800 my-0.5">
                P{idx}: ID={p.id} type={p.type.toUpperCase()}
                <br />
                x={p.x} y={p.y} primary={p.isPrimary ? "Y" : "N"}
              </div>
            ))
          )}

          <div className="mt-1 font-bold text-emerald-400 border-b border-gray-800 pb-0.5">Event Log</div>
          <div className="space-y-0.5 flex flex-col-reverse text-[9px] text-gray-300 mt-1 max-h-[100px] overflow-y-auto">
            {debugInfo.log && debugInfo.log.map((line, idx) => {
              const isBlocked = line.includes("BLOCKED");
              return (
                <div key={idx} className={isBlocked ? "text-red-400 font-semibold" : "text-gray-300"}>
                  {line}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
