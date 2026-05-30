"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type {
  ExcalidrawImperativeAPI,
  ExcalidrawInitialDataState,
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

export default function TopicDrawingPad({
  topicTitle,
  initialScene,
  saveBusy,
  onSave,
  onDelete,
  onClose,
}: Props) {
  const ensureLibraryWindowName = useCallback(() => {
    if (typeof window === "undefined") return;
    const key = "edu_viewer_window_name";
    let name = "";
    try {
      name = sessionStorage.getItem(key) ?? "";
    } catch {
      // ignore storage errors
    }
    if (!name) {
      const suffix = typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2);
      name = `edu-viewer-${suffix}`;
      try {
        sessionStorage.setItem(key, name);
      } catch {
        // ignore storage errors
      }
    }
    if (name && window.name !== name) {
      window.name = name;
    }
  }, []);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null);
  const [dirty, setDirty] = useState(false);
  const [localSaveBusy, setLocalSaveBusy] = useState(false);
  const [localDeleteBusy, setLocalDeleteBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
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

  useEffect(() => {
    if (typeof window !== "undefined") {
      const w = window as Window & { EXCALIDRAW_ASSET_PATH?: string };
      if (!w.EXCALIDRAW_ASSET_PATH) {
        w.EXCALIDRAW_ASSET_PATH = "/";
      }
    }
    ensureLibraryWindowName();
  }, [ensureLibraryWindowName]);

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
      const appState = api.getAppState();
      const isDrawing = isDrawingArea(e.target);
      const isPenActive = appState ? !!appState.penMode : false;

      if (e.pointerType === "touch" && isDrawing && isPenActive) {
        blockedPointerIdsRef.current.add(e.pointerId);
        e.preventDefault();
        e.stopImmediatePropagation();
        addLog(`BLOCKED ptr↓ touch id=${e.pointerId}`);
        syncDebug(e);
        return;
      }

      activePointersRef.current.set(e.pointerId, e);
      addLog(`ptr↓ ${e.pointerType} id=${e.pointerId}`);
      syncDebug(e);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (blockedPointerIdsRef.current.has(e.pointerId)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        return;
      }

      if (e.pointerType === "touch" && isDrawingArea(e.target)) {
        const appState = api.getAppState();
        const isPenActive = appState ? !!appState.penMode : false;
        if (isPenActive) {
          blockedPointerIdsRef.current.add(e.pointerId);
          e.preventDefault();
          e.stopImmediatePropagation();
          return;
        }
      }

      activePointersRef.current.set(e.pointerId, e);

      // Block touch pointer movement from propagating if we are pinch-zooming
      if (e.pointerType === "touch" && isPinchingRef.current) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (blockedPointerIdsRef.current.has(e.pointerId)) {
        blockedPointerIdsRef.current.delete(e.pointerId);
        e.preventDefault();
        e.stopImmediatePropagation();
        addLog(`BLOCKED ptr↑ touch id=${e.pointerId}`);
        syncDebug(e);
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
        e.stopImmediatePropagation();
        addLog(`BLOCKED ptr✗ touch id=${e.pointerId}`);
        syncDebug(e);
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
      const appState = api.getAppState();
      const stylusPresent = hasStylus(e.touches);

      // Count finger-only touches
      let fingerCount = 0;
      for (let i = 0; i < e.touches.length; i++) {
        if ((e.touches[i] as any).touchType !== "stylus") fingerCount++;
      }

      addLog(`ts n=${e.touches.length} stylus=${stylusPresent} fingers=${fingerCount} pen=${appState ? appState.penMode : false}`);
      syncDebug(e);

      // Pinch zoom when exactly 2 finger touches (allow even in pen mode for zoom)
      if (e.touches.length === 2) {
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
      } else if (e.touches.length < 2) {
        isPinchingRef.current = false;
        initialPinchDistance = 0;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      const appState = api.getAppState();
      syncDebug(e);

      if (e.touches.length === 2 && initialPinchDistance > 0) {
        if (appState && appState.penMode) {
          e.preventDefault();
          e.stopPropagation();

          const currentDistance = getPinchDistance(e.touches);
          const scale = currentDistance / initialPinchDistance;

          const MIN_ZOOM = 0.1;
          const MAX_ZOOM = 30;
          const newZoomValue = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, initialZoom * scale));
          const zoomRatio = newZoomValue / initialZoom;

          const rect = root.getBoundingClientRect();
          const currentMidpointX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
          const currentMidpointY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;

          const dx = currentMidpointX - initialMidpoint.x;
          const dy = currentMidpointY - initialMidpoint.y;

          const scrollX = initialMidpoint.x - (initialMidpoint.x - initialScrollX) * zoomRatio + dx;
          const scrollY = initialMidpoint.y - (initialMidpoint.y - initialScrollY) * zoomRatio + dy;

          api.updateScene({
            appState: {
              ...appState,
              zoom: { value: newZoomValue },
              scrollX,
              scrollY,
            } as any,
          });
          syncDebug(e);
        }
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      addLog(`te n=${e.touches.length}`);
      syncDebug(e);
      if (e.touches.length < 2) {
        isPinchingRef.current = false;
        initialPinchDistance = 0;
      }
    };

    root.addEventListener("gesturestart", preventDefault, { passive: false });
    root.addEventListener("gesturechange", preventDefault, { passive: false });

    // Pointer events: capture phase for blocking/filtering
    window.addEventListener("pointerdown", onPointerDown, { capture: true });
    window.addEventListener("pointerup", onPointerUp, { capture: true });
    window.addEventListener("pointercancel", onPointerCancel, { capture: true });
    window.addEventListener("pointermove", onPointerMove, { capture: true, passive: false });

    // Touch events: capture phase for tracking pinch-zoom
    root.addEventListener("touchstart", onTouchStart, { capture: true, passive: false });
    root.addEventListener("touchmove", onTouchMove, { capture: true, passive: false });
    root.addEventListener("touchend", onTouchEnd, { capture: true, passive: false });
    root.addEventListener("touchcancel", onTouchEnd, { capture: true, passive: false });

    return () => {
      root.removeEventListener("gesturestart", preventDefault);
      root.removeEventListener("gesturechange", preventDefault);
      window.removeEventListener("pointerdown", onPointerDown, { capture: true });
      window.removeEventListener("pointerup", onPointerUp, { capture: true });
      window.removeEventListener("pointercancel", onPointerCancel, { capture: true });
      window.removeEventListener("pointermove", onPointerMove, { capture: true });
      root.removeEventListener("touchstart", onTouchStart, { capture: true });
      root.removeEventListener("touchmove", onTouchMove, { capture: true });
      root.removeEventListener("touchend", onTouchEnd, { capture: true });
      root.removeEventListener("touchcancel", onTouchEnd, { capture: true });
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

  return (
    <div ref={rootRef} className="h-full bg-white dark:bg-gray-950 flex flex-col" style={{ touchAction: "none" }}>
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
          {/* Debug Toggle Button */}
          <button
            type="button"
            onClick={() => setShowDebug(!showDebug)}
            title={showDebug ? "Hide Debug Box" : "Show Debug Box"}
            className={`inline-flex items-center justify-center p-2 rounded-lg border transition-all cursor-pointer ${
              showDebug 
                ? "bg-green-50/80 dark:bg-green-950/20 border-green-300 dark:border-green-800 text-green-700 dark:text-green-400" 
                : "bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
            }`}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="10" rx="2"></rect>
              <path d="M12 2v9M8 5a4 4 0 0 1 8 0M3 13h18M6 22V11M18 22V11"></path>
            </svg>
          </button>

          {dirty && (
            <span className="text-[10px] px-2 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 font-medium">
              Unsaved
            </span>
          )}

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
