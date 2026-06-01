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
  draftStorageKey?: string;
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

type TouchWithType = Touch & { touchType?: string };

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
  draftStorageKey,
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
  const [showDrawingToolbars, setShowDrawingToolbars] = useState(true);
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
  const latestElementsRawRef = useRef<readonly unknown[]>([]);
  const latestAppStateRawRef = useRef<Record<string, unknown>>({});
  const latestFilesRawRef = useRef<Record<string, unknown>>({});
  const changeComputeTimerRef = useRef<number | null>(null);
  const showDebugRef = useRef(false);
  const debugSyncRafRef = useRef<number | null>(null);
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
  const draftPersistedKeyRef = useRef<string | null>(null);
  const discardDraftOnCloseRef = useRef(false);

  const persistedDraftScene = useMemo<ViewerDrawingScene | null>(() => {
    if (!draftStorageKey || typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(draftStorageKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== "object") return null;
      const row = parsed as Record<string, unknown>;
      return {
        elements: Array.isArray(row.elements) ? (row.elements as ViewerDrawingScene["elements"]) : [],
        appState: row.appState && typeof row.appState === "object" ? (row.appState as ViewerDrawingScene["appState"]) : {},
        files: row.files && typeof row.files === "object" ? (row.files as ViewerDrawingScene["files"]) : {},
      };
    } catch {
      return null;
    }
  }, [draftStorageKey]);

  const initialSavedContentKey = useMemo(() => {
    if (!initialScene) return "";
    return contentSignatureFromScene(initialScene);
  }, [initialScene]);

  const writeDraftScene = useCallback((scene: ViewerDrawingScene, contentKey: string, savedContentKey: string) => {
    if (!draftStorageKey || typeof window === "undefined") return;
    if (discardDraftOnCloseRef.current) return;
    try {
      if (!contentKey || contentKey === savedContentKey) {
        if (draftPersistedKeyRef.current !== null) {
          window.localStorage.removeItem(draftStorageKey);
          draftPersistedKeyRef.current = null;
        }
        return;
      }
      if (draftPersistedKeyRef.current === contentKey) return;
      window.localStorage.setItem(draftStorageKey, JSON.stringify(scene));
      draftPersistedKeyRef.current = contentKey;
    } catch {
      // ignore storage errors
    }
  }, [draftStorageKey]);

  const clearDraftScene = useCallback(() => {
    if (!draftStorageKey || typeof window === "undefined") return;
    try {
      window.localStorage.removeItem(draftStorageKey);
      draftPersistedKeyRef.current = null;
    } catch {
      // ignore storage errors
    }
  }, [draftStorageKey]);

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

  useEffect(() => {
    showDebugRef.current = showDebug;
    if (!showDebug && debugSyncRafRef.current !== null) {
      window.cancelAnimationFrame(debugSyncRafRef.current);
      debugSyncRafRef.current = null;
    }
  }, [showDebug]);

  const initialData = useMemo<ExcalidrawInitialDataState | undefined>(() => {
    const seedScene = persistedDraftScene ?? initialScene;
    const rawAppState =
      seedScene?.appState && typeof seedScene.appState === "object"
        ? { ...seedScene.appState }
        : {};
    // Always default to the thinnest stroke when opening the drawing pad.
    rawAppState.currentItemStrokeWidth = 1;
    // These collaboration-specific fields are Map/Set in runtime and break
    // when rehydrated from plain JSON.
    delete (rawAppState as Record<string, unknown>).collaborators;
    delete (rawAppState as Record<string, unknown>).followedBy;
    delete (rawAppState as Record<string, unknown>).userToFollow;
    return {
      elements: Array.isArray(seedScene?.elements) ? (seedScene.elements as never[]) : [],
      appState: rawAppState as ExcalidrawInitialDataState["appState"],
      files: (seedScene?.files ?? {}) as ExcalidrawInitialDataState["files"],
    };
  }, [initialScene, persistedDraftScene]);

  // ── Pinch-to-Zoom Fix for iPad + Real-time Touch Debugging ──
  useEffect(() => {
    if (!api) return;
    const root = rootRef.current;
    if (!root) return;

    const preventDefault = (e: Event) => {
      e.preventDefault();
    };

    const isFloatingMenuElement = (target: EventTarget | null): boolean => {
      if (!(target instanceof Element)) return false;
      return Boolean(
        target.closest(".dropdown-menu-container") ||
        target.closest(".dropdown-menu") ||
        target.closest(".App-mobile-menu") ||
        target.closest(".color-picker") ||
        target.closest(".popover") ||
        target.closest(".excalidraw-sidebar") ||
        target.closest("aside") ||
        target.closest("[class*='sidebar']") ||
        target.closest("[class*='library']") ||
        target.closest("[data-testid*='sidebar']") ||
        target.closest("[data-testid*='library']") ||
        target.closest("[role='dialog']")
      );
    };

    const isAllowedExcalidrawOverlayTarget = (target: EventTarget | null): boolean => {
      if (!(target instanceof Element)) return false;
      return Boolean(
        isFloatingMenuElement(target) ||
        target.closest(".excalidraw") ||
        target.closest("[class*='excalidraw']")
      );
    };

    const hasOpenFloatingMenus = (): boolean => {
      if (!api) return false;
      const appState = api.getAppState() as Record<string, unknown>;
      return Boolean(
        appState.openMenu ||
        appState.openPopup ||
        appState.openSidebar ||
        appState.contextMenu ||
        appState.openDialog
      );
    };

    const closeFloatingMenus = () => {
      if (!api) return;
      const appState = api.getAppState() as Record<string, unknown>;
      api.updateScene({
        appState: {
          ...appState,
          openMenu: null,
          openPopup: null,
          openSidebar: null,
          contextMenu: null,
          openDialog: null,
        } as never,
      });
    };

    // Rolling event log for debug (keep last 8 entries)
    const logLines: string[] = [];
    const addLog = (msg: string) => {
      if (!showDebugRef.current) return;
      logLines.push(msg);
      if (logLines.length > 8) logLines.shift();
    };

    // Detect if touches contain a stylus
    const hasStylus = (touches: TouchList): boolean => {
      for (let i = 0; i < touches.length; i++) {
        if ((touches[i] as TouchWithType).touchType === "stylus") return true;
      }
      return false;
    };

    const isDragHandleElement = (target: EventTarget | null): boolean => {
      if (!target) return false;
      if (!(target instanceof Element)) return false;
      const el = target;
      if (typeof el.closest === "function") {
        if (
          el.closest("[role='separator']") ||
          el.closest("[aria-label*='Resize']") ||
          el.closest("[aria-label*='resize']") ||
          el.closest("[title*='resize']") ||
          el.closest("[title*='Resize']")
        ) {
          return true;
        }
      }
      return false;
    };

    const isInteractiveElement = (target: EventTarget | null): boolean => {
      if (!target) return false;
      if (!(target instanceof Element)) return false;
      const el = target;
      const tagName = String(el.tagName || "").toUpperCase();
      if (tagName === "BUTTON" || tagName === "INPUT" || tagName === "SELECT" || tagName === "TEXTAREA" || tagName === "A" || tagName === "LABEL") {
        return true;
      }
      if (typeof el.closest === "function") {
        if (
          el.closest("button") ||
          el.closest("a") ||
          el.closest("label") ||
          el.closest(".excalidraw-button") ||
          el.closest(".layer-ui__wrapper") ||
          el.closest(".excalidraw-sidebar") ||
          el.closest("aside") ||
          el.closest("[class*='sidebar']") ||
          el.closest("[class*='library']") ||
          el.closest("[data-testid*='sidebar']") ||
          el.closest("[data-testid*='library']") ||
          el.closest("[aria-label='Close library browser']") ||
          el.closest(".context-menu") ||
          el.closest(".dropdown-menu") ||
          el.closest(".popover") ||
          el.closest(".tooltip") ||
          el.closest(".excalidraw-tooltip") ||
          el.closest(".ToolIcon") ||
          el.closest("[role='button']") ||
          el.closest("[role='checkbox']") ||
          el.closest("[role='menuitem']") ||
          el.closest("[role='tab']") ||
          el.closest("[role='separator']") ||
          el.closest("[aria-label*='Resize']") ||
          el.closest("[aria-label*='resize']")
        ) {
          return true;
        }
      }
      return false;
    };

    const syncDebug = (e: Event) => {
      if (!showDebugRef.current) return;
      if (debugSyncRafRef.current !== null) return;
      debugSyncRafRef.current = window.requestAnimationFrame(() => {
        debugSyncRafRef.current = null;
      const appState = api.getAppState();
      const penModeActive = appState ? !!appState.penMode : false;

      const pointersList = Array.from(activePointersRef.current.values()).map(p => ({
        id: p.pointerId,
        type: p.pointerType,
        x: Math.round(p.clientX),
        y: Math.round(p.clientY),
        isPrimary: p.isPrimary,
      }));

      let touchesList: { id: number; type: string; x: number; y: number; rx: number; ry: number; force: number }[] = [];
      if ('touches' in e) {
        touchesList = Array.from((e as TouchEvent).touches).map((t) => {
          const touch = t as TouchWithType;
          return {
            id: t.identifier,
            type: touch.touchType || "direct",
            x: Math.round(t.clientX),
            y: Math.round(t.clientY),
            rx: Math.round(t.radiusX || 0),
            ry: Math.round(t.radiusY || 0),
            force: t.force || 0,
          };
        });
      }

      setDebugInfo({
        pointers: pointersList,
        touches: 'touches' in e ? touchesList : [],
        penModeActive,
        log: [...logLines],
      });
      });
    };

    let twoFingerHandActive = false;
    let handRestoreTool: { type: string; customType?: string } | null = null;

    const activateTwoFingerHand = () => {
      if (twoFingerHandActive) return;
      const appState = api.getAppState();
      // If a finger was previously blocked in pen mode, unblock it before
      // entering two-finger navigation to avoid mixed zoom-only jitter.
      if (blockedPointerIdsRef.current.size > 0) {
        blockedPointerIdsRef.current.clear();
      }
      const activeTool = appState?.activeTool as { type?: string; customType?: string } | undefined;
      if (activeTool?.type === "hand") {
        handRestoreTool = null;
        twoFingerHandActive = true;
        return;
      }
      handRestoreTool = activeTool?.type
        ? { type: activeTool.type, ...(activeTool.customType ? { customType: activeTool.customType } : {}) }
        : { type: "selection" };
      api.setActiveTool({ type: "hand" });
      twoFingerHandActive = true;
    };

    const restoreToolAfterTwoFinger = () => {
      if (!twoFingerHandActive) return;
      twoFingerHandActive = false;
      const restore = handRestoreTool;
      handRestoreTool = null;
      if (!restore || restore.type === "hand") return;
      api.setActiveTool(restore as never);
    };

    // ── Pointer event handlers ──
    const onPointerDown = (e: PointerEvent) => {
      if (isDragHandleElement(e.target)) return;
      if (!rootRef.current?.contains(e.target as Node)) {
        if (e.pointerType === "touch" && !isAllowedExcalidrawOverlayTarget(e.target)) {
          e.stopPropagation();
          e.stopImmediatePropagation();
        }
        return;
      }
      if (!isFloatingMenuElement(e.target) && hasOpenFloatingMenus()) {
        window.requestAnimationFrame(() => closeFloatingMenus());
        return;
      }
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
        if (twoFingerHandActive) {
          activePointersRef.current.set(e.pointerId, e);
          return;
        }
        // Let touch events drive pinch/pan flow to avoid pointer/touch conflicts on iPad.
        activePointersRef.current.set(e.pointerId, e);
        return;
      }

      activePointersRef.current.set(e.pointerId, e);
      addLog(`ptr↓ ${e.pointerType} id=${e.pointerId}`);
      syncDebug(e);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (isDragHandleElement(e.target)) return;
      if (blockedPointerIdsRef.current.has(e.pointerId)) {
        if (e.pointerType === "touch" && twoFingerHandActive) {
          blockedPointerIdsRef.current.delete(e.pointerId);
        } else {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          return;
        }
      }
      if (!rootRef.current?.contains(e.target as Node)) {
        if (e.pointerType === "touch" && !isAllowedExcalidrawOverlayTarget(e.target)) {
          e.stopPropagation();
          e.stopImmediatePropagation();
        }
        return;
      }

      if (e.pointerType === "touch") {
        activePointersRef.current.set(e.pointerId, e);
        return;
      }

      activePointersRef.current.set(e.pointerId, e);
    };

    const onPointerUp = (e: PointerEvent) => {
      if (isDragHandleElement(e.target)) return;
      if (blockedPointerIdsRef.current.has(e.pointerId)) {
        if (e.pointerType === "touch" && twoFingerHandActive) {
          blockedPointerIdsRef.current.delete(e.pointerId);
        } else {
          blockedPointerIdsRef.current.delete(e.pointerId);
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          addLog(`BLOCKED ptr↑ touch id=${e.pointerId}`);
          syncDebug(e);
          return;
        }
      }
      if (!rootRef.current?.contains(e.target as Node)) {
        if (e.pointerType === "touch" && !isAllowedExcalidrawOverlayTarget(e.target)) {
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
      if (isDragHandleElement(e.target)) return;
      if (blockedPointerIdsRef.current.has(e.pointerId)) {
        if (e.pointerType === "touch" && twoFingerHandActive) {
          blockedPointerIdsRef.current.delete(e.pointerId);
        } else {
          blockedPointerIdsRef.current.delete(e.pointerId);
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          addLog(`BLOCKED ptr✗ touch id=${e.pointerId}`);
          syncDebug(e);
          return;
        }
      }
      if (!rootRef.current?.contains(e.target as Node)) {
        if (e.pointerType === "touch" && !isAllowedExcalidrawOverlayTarget(e.target)) {
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
    const onTouchStart = (e: TouchEvent) => {
      if (isDragHandleElement(e.target)) return;
      const stylusPresent = hasStylus(e.touches);
      if (stylusPresent && e.touches.length > 1) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        return;
      }

      if (!rootRef.current?.contains(e.target as Node)) {
        if (isAllowedExcalidrawOverlayTarget(e.target)) return;
        if (e.touches.length >= 2) {
          e.stopPropagation();
          e.stopImmediatePropagation();
        }
        return;
      }
      if (!isFloatingMenuElement(e.target) && hasOpenFloatingMenus()) {
        window.requestAnimationFrame(() => closeFloatingMenus());
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
        if ((e.touches[i] as TouchWithType).touchType !== "stylus") fingerCount++;
      }

      addLog(`ts n=${e.touches.length} stylus=${stylusPresent} fingers=${fingerCount}`);
      syncDebug(e);

      if (isPenActive && !isHandToolActive && !stylusPresent && e.touches.length === 1 && !isInteractiveElement(e.target)) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        addLog("BLOCKED finger touchstart");
        syncDebug(e);
        return;
      }

      if (fingerCount === 2 && allInside && !stylusPresent) {
        activateTwoFingerHand();
        return;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (isDragHandleElement(e.target)) return;
      const stylusPresent = hasStylus(e.touches);
      if (stylusPresent && e.touches.length > 1) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        return;
      }

      if (!rootRef.current?.contains(e.target as Node)) {
        if (isAllowedExcalidrawOverlayTarget(e.target)) return;
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
        if ((e.touches[i] as TouchWithType).touchType !== "stylus") fingerCount++;
      }

      syncDebug(e);

      if (isPenActive && !isHandToolActive && !stylusPresent && e.touches.length === 1 && !isInteractiveElement(e.target)) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        return;
      }

      if (fingerCount >= 2 && allInside && !stylusPresent) {
        activateTwoFingerHand();
        return;
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (isDragHandleElement(e.target)) return;
      if (e.touches.length === 0) {
        restoreToolAfterTwoFinger();
      }
      const stylusPresent = hasStylus(e.touches);
      if (stylusPresent && e.touches.length > 1) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        return;
      }

      if (!rootRef.current?.contains(e.target as Node)) {
        if (isAllowedExcalidrawOverlayTarget(e.target)) return;
        if (e.touches.length >= 2) {
          e.stopPropagation();
          e.stopImmediatePropagation();
        }
        return;
      }
      addLog(`te n=${e.touches.length}`);
      syncDebug(e);
    };

    root.addEventListener("gesturestart", preventDefault, { passive: false });
    root.addEventListener("gesturechange", preventDefault, { passive: false });

    // Protect Excalidraw's global window listeners from panicking over outside events (like left pane scrolling/gestures)
    const stopOutsideEventPropagation = (e: Event) => {
      // Excalidraw usually only cares about touch and pen for gestures. Let mouse clicks on outside UI bubble up safely.
      if ('pointerType' in e && (e as PointerEvent).pointerType === 'mouse') return;
      if (isDragHandleElement(e.target)) return;
      if (isAllowedExcalidrawOverlayTarget(e.target)) return;
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
      if (isAllowedExcalidrawOverlayTarget(e.target)) return;
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
      restoreToolAfterTwoFinger();
      if (debugSyncRafRef.current !== null) {
        window.cancelAnimationFrame(debugSyncRafRef.current);
        debugSyncRafRef.current = null;
      }
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
      latestElementsRawRef.current = [];
      latestAppStateRawRef.current = {};
      latestFilesRawRef.current = {};
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
    latestElementsRawRef.current = (initialData.elements ?? []) as readonly unknown[];
    latestAppStateRawRef.current = (initialData.appState ?? {}) as Record<string, unknown>;
    latestFilesRawRef.current = (initialData.files ?? {}) as Record<string, unknown>;
    const key = contentSignatureFromScene(scene);
    lastSavedContentKeyRef.current = initialSavedContentKey;
    latestContentKeyRef.current = key;
    latestSceneRef.current = scene;
    baselineInitializedRef.current = true;
    initialSyncPendingRef.current = true;
  }, [initialData, initialSavedContentKey]);

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

  const commitLatestChange = useCallback(() => {
    const elements = latestElementsRawRef.current;
    const appState = latestAppStateRawRef.current;
    const files = latestFilesRawRef.current;
    const currentScene = buildSerializableScene(elements, appState, files);
    const currentKey = contentSignatureFromUnknown(elements, files);
    latestSceneRef.current = currentScene;
    latestContentKeyRef.current = currentKey;
    if (initialSyncPendingRef.current) {
      initialSyncPendingRef.current = false;
      setDirty(currentKey !== lastSavedContentKeyRef.current);
      writeDraftScene(currentScene, currentKey, lastSavedContentKeyRef.current);
      return;
    }
    if (!lastSavedContentKeyRef.current) {
      lastSavedContentKeyRef.current = currentKey;
      setDirty(false);
      writeDraftScene(currentScene, currentKey, lastSavedContentKeyRef.current);
      return;
    }
    if (Date.now() < suppressDirtyUntilRef.current && currentKey === lastSavedContentKeyRef.current) {
      setDirty(false);
      writeDraftScene(currentScene, currentKey, lastSavedContentKeyRef.current);
      return;
    }
    setDirty(currentKey !== lastSavedContentKeyRef.current);
    writeDraftScene(currentScene, currentKey, lastSavedContentKeyRef.current);
    setSaveError((prev) => (prev ? null : prev));
  }, [writeDraftScene]);

  const scheduleLatestChangeCommit = useCallback(() => {
    if (discardDraftOnCloseRef.current) return;
    if (changeComputeTimerRef.current !== null) return;
    changeComputeTimerRef.current = window.setTimeout(() => {
      changeComputeTimerRef.current = null;
      commitLatestChange();
    }, 120);
  }, [commitLatestChange]);

  const flushLatestChangeCommit = useCallback(() => {
    if (changeComputeTimerRef.current !== null) {
      window.clearTimeout(changeComputeTimerRef.current);
      changeComputeTimerRef.current = null;
      commitLatestChange();
    }
  }, [commitLatestChange]);

  useEffect(() => {
    return () => {
      if (changeComputeTimerRef.current !== null) {
        window.clearTimeout(changeComputeTimerRef.current);
        changeComputeTimerRef.current = null;
      }
    };
  }, []);

  const handleSave = useCallback(async (): Promise<boolean> => {
    if (!api) return false;
    discardDraftOnCloseRef.current = false;
    const revision = saveRevisionRef.current + 1;
    saveRevisionRef.current = revision;
    setLocalSaveBusy(true);
    setSaveError(null);
    try {
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve());
      });
      flushLatestChangeCommit();
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
      clearDraftScene();
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
  }, [api, clearDraftScene, flushLatestChangeCommit, onSave]);

  const closeAndDiscardDraft = useCallback(() => {
    discardDraftOnCloseRef.current = true;
    if (changeComputeTimerRef.current !== null) {
      window.clearTimeout(changeComputeTimerRef.current);
      changeComputeTimerRef.current = null;
    }
    clearDraftScene();
    onClose();
  }, [clearDraftScene, onClose]);

  const handleClose = useCallback(() => {
    if (dirty) {
      setConfirmCloseOpen(true);
      return;
    }
    closeAndDiscardDraft();
  }, [closeAndDiscardDraft, dirty]);

  const performDelete = useCallback(async (): Promise<boolean> => {
    if (!api) return false;
    discardDraftOnCloseRef.current = false;
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
      clearDraftScene();
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
  }, [api, clearDraftScene, onDelete]);

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

  const handleRemoveLibraryFromCatalog = useCallback(async (library: ExcalidrawLibraryItem) => {
    if (!api || libraryImportBusy) return;
    if (!librarySourcePresenceBySource[library.source]) return;
    setLibraryImportBusy(true);
    setLibraryImportingSource(library.source);
    setLibraryImportError(null);
    try {
      const meta = librarySourceMetaBySource[library.source];
      const signaturesToRemove = new Set(meta?.signatures || []);
      const namesToRemove = new Set(meta?.names || []);

      await api.updateLibrary({
        libraryItems: (currentItems) => {
          const nextItems = currentItems.filter((item) => {
            const signature = getLibraryItemSignature(item);
            if (signature && signaturesToRemove.has(signature)) return false;
            const name = typeof item.name === "string" ? item.name.trim() : "";
            if (name && namesToRemove.has(name)) return false;
            return true;
          });
          return nextItems;
        },
        merge: false,
        openLibraryMenu: false,
      });

      // Optimistically update presence in our local state/storage
      const updatedSignatures = new Set(libraryItemSignaturesRef.current);
      const updatedNames = new Set(libraryItemNamesRef.current);

      signaturesToRemove.forEach((sig) => updatedSignatures.delete(sig));
      namesToRemove.forEach((name) => updatedNames.delete(name));

      libraryItemSignaturesRef.current = updatedSignatures;
      libraryItemNamesRef.current = updatedNames;

      persistLibrarySourcePresence(
        computeLibrarySourcePresenceMap(
          librarySourceMetaRef.current,
          updatedSignatures,
          updatedNames,
        )
      );

    } catch (err: unknown) {
      const message = err instanceof Error && err.message
        ? err.message
        : `Could not remove "${library.name}".`;
      setLibraryImportError(message);
    } finally {
      setLibraryImportBusy(false);
      setLibraryImportingSource(null);
    }
  }, [
    api,
    libraryImportBusy,
    librarySourcePresenceBySource,
    librarySourceMetaBySource,
    persistLibrarySourcePresence,
  ]);

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
    <div
      ref={rootRef}
      className={`relative h-full bg-white dark:bg-gray-950 flex flex-col ${showDrawingToolbars ? "" : "ev-hide-drawing-toolbars"}`}
      style={{ touchAction: "none" }}
    >
      <style suppressHydrationWarning>{`
        /* Move Excalidraw bottom toolbar (mobile bottom bar & desktop footer-center) to top-left */
        .excalidraw .App-bottom-bar,
        .excalidraw .footer-center,
        .excalidraw .layer-ui__wrapper__footer-center {
          position: absolute !important;
          left: 12px !important;
          right: auto !important;
          bottom: auto !important;
          top: 12px !important;
          transform: none !important;
          width: auto !important;
          height: auto !important;
          display: flex !important;
          flex-direction: column !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 12px !important;
          padding: 8px !important;
          background: var(--island-bg-color, #ffffff) !important;
          border: 1px solid var(--sidebar-border-color, #e0e0e0) !important;
          border-radius: 12px !important;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05) !important;
          z-index: 5 !important;
        }

        .theme--dark .excalidraw .App-bottom-bar,
        .theme--dark .excalidraw .footer-center,
        .theme--dark .excalidraw .layer-ui__wrapper__footer-center {
          background: var(--island-bg-color, #1e1e1e) !important;
          border-color: var(--sidebar-border-color, #333333) !important;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.15) !important;
        }

        /* Stack internal container elements vertically, excluding popup menus/pickers */
        .excalidraw .App-bottom-bar > *:not(.App-mobile-menu):not(.color-picker-container):not(.dropdown-menu):not(.popover):not([role="dialog"]),
        .excalidraw .footer-center > *,
        .excalidraw .layer-ui__wrapper__footer-center > *,
        .excalidraw .undo-redo-buttons,
        .excalidraw .zoom-actions,
        .excalidraw .stack,
        .excalidraw .island {
          display: flex !important;
          flex-direction: column !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 8px !important;
          width: auto !important;
          height: auto !important;
          padding: 0 !important;
          margin: 0 !important;
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
        }

        /* mobile/tablet view left toolbar overrides: make it look EXACTLY like the right toolbar */
        .excalidraw.excalidraw--mobile .App-bottom-bar,
        .excalidraw.excalidraw--mobile .layer-ui__wrapper__footer-center {
          margin: 0 !important;
          position: absolute !important;
          left: 0px !important;
          right: auto !important;
          bottom: auto !important;
          top: 0px !important;
          transform: none !important;
          width: 36px !important;
          height: auto !important;
          display: flex !important;
          flex-direction: column !important;
          align-items: center !important;
          justify-content: flex-start !important;
          gap: 4px !important;
          padding: 8px 0 !important;
          background: var(--island-bg-color, rgb(35, 35, 41)) !important;
          border: none !important;
          border-radius: 0px 8px 8px 0px !important;
          box-shadow: none !important;
          z-index: 5 !important;
          overflow: visible !important;
        }

        /* Inner containers inside mobile left toolbar */
        .excalidraw.excalidraw--mobile .App-bottom-bar .Island,
        .excalidraw.excalidraw--mobile .App-bottom-bar .App-toolbar,
        .excalidraw.excalidraw--mobile .App-bottom-bar .App-toolbar-content,
        .excalidraw.excalidraw--mobile .App-bottom-bar .undo-redo-buttons {
          display: flex !important;
          flex-direction: column !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 4px !important;
          width: 36px !important;
          height: auto !important;
          padding: 0 !important;
          margin: 0 !important;
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
          overflow: visible !important;
        }

        /* Force mobile toolbar content to stack vertically */
        .excalidraw.excalidraw--mobile .App-bottom-bar .App-toolbar-content {
          flex-direction: column !important;
          overflow: visible !important;
        }

        /* Align & size individual mobile tool buttons precisely to match right bar - only direct children */
        .excalidraw.excalidraw--mobile .App-bottom-bar .App-toolbar-content > button,
        .excalidraw.excalidraw--mobile .App-bottom-bar .App-toolbar-content > .ToolIcon,
        .excalidraw.excalidraw--mobile .App-bottom-bar .undo-redo-buttons > button {
          width: 36px !important;
          height: 36px !important;
          min-width: 36px !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
          padding: 0 !important;
          margin: 0 !important;
        }

        /* Adjust mobile left toolbar icons to look crisp and clean */
        .excalidraw.excalidraw--mobile .App-bottom-bar .App-toolbar-content > button svg,
        .excalidraw.excalidraw--mobile .App-bottom-bar .App-toolbar-content > .ToolIcon svg,
        .excalidraw.excalidraw--mobile .App-bottom-bar .undo-redo-buttons > button svg {
          width: 18px !important;
          height: 18px !important;
        }

        /* Make right toolbar match left toolbar style */
        .excalidraw .mobile-misc-tools-container {
          position: absolute !important;
          top: -10px !important;
          right: calc(var(--editor-container-padding, 0px) * -1) !important;
          width: 36px !important;
          display: flex !important;
          flex-direction: column !important;
          align-items: center !important;
          justify-content: flex-start !important;
          gap: 4px !important;
          background: var(--island-bg-color, rgb(35, 35, 41)) !important;
          border: none !important;
          border-radius: 8px 0px 0px 8px !important;
          box-shadow: none !important;
          overflow: visible !important;
          z-index: 5 !important;
        }

        .excalidraw .mobile-misc-tools-container .ToolIcon,
        .excalidraw .mobile-misc-tools-container button {
          width: 36px !important;
          height: 36px !important;
          min-width: 36px !important;
          margin: 0 !important;
          padding: 0 !important;
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
          border-radius: 0 !important;
        }

        .excalidraw .mobile-misc-tools-container .ToolIcon__icon {
          width: 36px !important;
          height: 36px !important;
          border-radius: 0 !important;
        }

        .excalidraw .mobile-misc-tools-container .ToolIcon__icon svg {
          width: 18px !important;
          height: 18px !important;
        }

        /* Give right-rail icons stronger default contrast */
        .excalidraw .mobile-misc-tools-container .ToolIcon__icon,
        .excalidraw .mobile-misc-tools-container .ToolIcon__icon svg,
        .excalidraw .mobile-misc-tools-container button svg {
          color: #d1d5e7 !important;
        }

        /* Preserve visual active/checked state for lock/pen/hand buttons */
        .excalidraw .mobile-misc-tools-container .ToolIcon .ToolIcon_type_radio:checked + .ToolIcon__icon,
        .excalidraw .mobile-misc-tools-container .ToolIcon .ToolIcon_type_checkbox:checked + .ToolIcon__icon,
        .excalidraw .mobile-misc-tools-container .ToolIcon:has(input:checked) .ToolIcon__icon,
        .excalidraw .mobile-misc-tools-container .ToolIcon.ToolIcon--selected .ToolIcon__icon,
        .excalidraw .mobile-misc-tools-container .ToolIcon[aria-pressed="true"] .ToolIcon__icon,
        .excalidraw .mobile-misc-tools-container button[aria-pressed="true"] .ToolIcon__icon {
          background: rgba(105, 109, 185, 0.42) !important;
          color: #eef1ff !important;
        }

        .excalidraw .mobile-misc-tools-container .ToolIcon.ToolIcon_type_button.ToolIcon--selected,
        .excalidraw .mobile-misc-tools-container .ToolIcon_type_button.ToolIcon--selected,
        .excalidraw .mobile-misc-tools-container button.standalone.active {
          background: rgba(105, 109, 185, 0.42) !important;
          color: #eef1ff !important;
        }

        .excalidraw .mobile-misc-tools-container .ToolIcon.ToolIcon_type_button.ToolIcon--selected .ToolIcon__icon,
        .excalidraw .mobile-misc-tools-container .ToolIcon_type_button.ToolIcon--selected .ToolIcon__icon,
        .excalidraw .mobile-misc-tools-container button.standalone.active svg,
        .excalidraw .mobile-misc-tools-container .ToolIcon:has(input:checked) .ToolIcon__icon svg,
        .excalidraw .mobile-misc-tools-container .ToolIcon .ToolIcon_type_radio:checked + .ToolIcon__icon svg,
        .excalidraw .mobile-misc-tools-container .ToolIcon .ToolIcon_type_checkbox:checked + .ToolIcon__icon svg,
        .excalidraw .mobile-misc-tools-container .ToolIcon.ToolIcon--selected .ToolIcon__icon svg,
        .excalidraw .mobile-misc-tools-container .ToolIcon[aria-pressed="true"] .ToolIcon__icon svg,
        .excalidraw .mobile-misc-tools-container button[aria-pressed="true"] .ToolIcon__icon svg {
          color: #eef1ff !important;
          stroke: currentColor !important;
        }

        /* Reclaim top empty strip by moving shape toolbar row up */
        .excalidraw .App-menu_top {
          margin-top: -10px !important;
        }

        /* Reset and prevent overrides from breaking other sidebars and dialogs */
        .excalidraw.excalidraw--mobile .App-bottom-bar .excalidraw-sidebar,
        .excalidraw.excalidraw--mobile .App-bottom-bar [role="dialog"]:not(.color-picker-container):not(.color-picker) {
          position: absolute !important;
          left: 44px !important;
          top: 10px !important;
          width: auto !important;
          height: auto !important;
          max-width: none !important;
          max-height: none !important;
          display: flex !important;
          background: var(--island-bg-color, rgb(35, 35, 41)) !important;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.15) !important;
          z-index: 9999 !important;
        }
        
        .excalidraw .App-toolbar.App-toolbar--mobile {
          top: -10px !important;
        }
        
        .excalidraw .undo-redo-buttons {
          display: grid !important;
          margin: 0 0 0 10px !important;
        }

        /* Style the main hamburger dropdown menu container specifically */
        .excalidraw.excalidraw--mobile .App-bottom-bar .dropdown-menu-container {
          position: absolute !important;
          left: 44px !important;
          top: 60px !important; /* Start below the hamburger button */
          width: 220px !important;
          height: auto !important;
          max-height: calc(100vh - 120px) !important;
          overflow-y: auto !important;
          background: var(--island-bg-color, rgb(35, 35, 41)) !important;
          border: 1px solid var(--sidebar-border-color, #333333) !important;
          border-radius: 8px !important;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.15) !important;
          z-index: 9999 !important;
          padding: 8px 0 !important;
          display: flex !important;
          flex-direction: column !important;
        }

        /* Reset the inner dropdown menu inside its container */
        .excalidraw.excalidraw--mobile .App-bottom-bar .dropdown-menu {
          position: relative !important;
          left: auto !important;
          top: auto !important;
          width: 100% !important;
          height: auto !important;
          max-height: none !important;
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
          display: flex !important;
          flex-direction: column !important;
          padding: 0 !important;
          margin: 0 !important;
        }

        /* Hide the Excalidraw links group inside the hamburger menu */
        .excalidraw.excalidraw--mobile .App-bottom-bar .dropdown-menu-group {
          display: none !important;
        }
        /* Hide the separator divider line next to it to prevent double-dividers */
        .excalidraw.excalidraw--mobile .App-bottom-bar .dropdown-menu-group + div {
          display: none !important;
        }

        /* Specifically style the properties menu (.App-mobile-menu) on mobile/tablet */
        .excalidraw.excalidraw--mobile .App-bottom-bar .App-mobile-menu {
          position: absolute !important;
          left: 44px !important;
          top: 45px !important;
          width: 280px !important;
          height: auto !important;
          max-height: calc(100vh - 90px) !important;
          overflow-y: auto !important;
          display: flex !important;
          flex-direction: column !important;
          gap: 12px !important;
          padding: 16px !important;
          background: var(--island-bg-color, rgb(35, 35, 41)) !important;
          border: 1px solid var(--sidebar-border-color, #333333) !important;
          border-radius: 8px !important;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.15) !important;
          z-index: 9999 !important;
        }

        /* Excalidraw color picker and mobile menu need their grid/flex elements layout intact, excluding swatch buttons */
        .excalidraw.excalidraw--mobile .App-bottom-bar .color-picker-container button:not(.color-picker__button):not(.active-color),
        .excalidraw.excalidraw--mobile .App-bottom-bar .App-mobile-menu button:not(.color-picker__button):not(.active-color) {
          width: auto !important;
          height: auto !important;
          min-width: 0 !important;
          background: initial !important;
          border: initial !important;
          box-shadow: initial !important;
          padding: initial !important;
          margin: initial !important;
          display: inline-flex !important;
        }

        /* Hide Canvas background row in menu/palette */
        .excalidraw .dropdown-menu [data-testid="canvas-background-label"],
        .excalidraw .App-mobile-menu [data-testid="canvas-background-label"] {
          display: none !important;
        }
        .excalidraw .dropdown-menu [data-testid="canvas-background-label"] + div,
        .excalidraw .App-mobile-menu [data-testid="canvas-background-label"] + div {
          display: none !important;
        }
        .excalidraw .dropdown-menu div:has(> [data-testid="canvas-background-label"]),
        .excalidraw .App-mobile-menu div:has(> [data-testid="canvas-background-label"]) {
          display: none !important;
        }

        /* Hide/show all three Excalidraw toolbars with one top-nav toggle */
        .ev-hide-drawing-toolbars .excalidraw .App-bottom-bar,
        .ev-hide-drawing-toolbars .excalidraw .footer-center,
        .ev-hide-drawing-toolbars .excalidraw .layer-ui__wrapper__footer-center,
        .ev-hide-drawing-toolbars .excalidraw .App-menu_top,
        .ev-hide-drawing-toolbars .excalidraw .App-toolbar.App-toolbar--mobile,
        .ev-hide-drawing-toolbars .excalidraw .mobile-misc-tools-container,
        .ev-hide-drawing-toolbars .excalidraw .App-menu_bottom {
          display: none !important;
        }
      `}</style>
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

          <button
            type="button"
            onClick={() => setShowDrawingToolbars((prev) => !prev)}
            title={showDrawingToolbars ? "Hide drawing toolbars" : "Show drawing toolbars"}
            aria-label={showDrawingToolbars ? "Hide drawing toolbars" : "Show drawing toolbars"}
            className={`inline-flex items-center justify-center p-2 rounded-lg border transition-all cursor-pointer ${showDrawingToolbars
                ? "bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                : "bg-amber-50/80 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-300"
              }`}
          >
            {showDrawingToolbars ? (
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 3l18 18"></path>
                <path d="M10.5 10.5A3 3 0 0 0 13.5 13.5"></path>
                <path d="M9.88 5.09A10.94 10.94 0 0 1 12 5c6.5 0 10 7 10 7a19.16 19.16 0 0 1-3.22 4.19"></path>
                <path d="M6.53 6.53C4.55 7.96 3.17 9.88 2 12c0 0 3.5 7 10 7a9.77 9.77 0 0 0 4.47-1.03"></path>
              </svg>
            )}
          </button>

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
                            onClick={() => {
                              if (alreadyInLibrary) {
                                void handleRemoveLibraryFromCatalog(library);
                              } else {
                                void handleImportLibraryFromCatalog(library);
                              }
                            }}
                            disabled={libraryImportBusy || !api}
                            title={
                              importingThis
                                ? "Processing..."
                                : alreadyInLibrary
                                  ? "Remove library"
                                  : "Add library"
                            }
                            aria-label={
                              importingThis
                                ? "Processing..."
                                : alreadyInLibrary
                                  ? "Remove library"
                                  : "Add library"
                            }
                            className={`absolute right-3 bottom-3 inline-flex items-center justify-center h-9 w-9 rounded-full border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                              alreadyInLibrary
                                ? "border-rose-300 dark:border-rose-800 text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/20 hover:bg-rose-100 dark:hover:bg-rose-900/40 hover:text-rose-800 dark:hover:text-rose-300"
                                : "border-indigo-300 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
                            }`}
                          >
                            {importingThis ? (
                              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
                                <path d="M21 12a9 9 0 1 1-2.64-6.36"></path>
                                <polyline points="21 3 21 9 15 9"></polyline>
                              </svg>
                            ) : alreadyInLibrary ? (
                              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="5" y1="12" x2="19" y2="12"></line>
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
                  closeAndDiscardDraft();
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
            latestElementsRawRef.current = elements as readonly unknown[];
            latestAppStateRawRef.current = appState as unknown as Record<string, unknown>;
            latestFilesRawRef.current = files as unknown as Record<string, unknown>;
            scheduleLatestChangeCommit();
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
