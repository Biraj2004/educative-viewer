"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { serializeAsJSON } from "@excalidraw/excalidraw";
import type {
  ExcalidrawImperativeAPI,
  ExcalidrawInitialDataState,
} from "@excalidraw/excalidraw/types";
import type { ViewerDrawingScene } from "@/utils/authClient";

const Excalidraw = dynamic(
  async () => (await import("@excalidraw/excalidraw")).Excalidraw,
  { ssr: false }
);

interface Props {
  topicTitle: string;
  initialScene: ViewerDrawingScene | null;
  saveBusy: boolean;
  onSave: (scene: ViewerDrawingScene) => Promise<void>;
  onClose: () => void;
}

function toSerializableScene(scene: ViewerDrawingScene): ViewerDrawingScene {
  return JSON.parse(JSON.stringify(scene)) as ViewerDrawingScene;
}

function serializeForDatabase(
  elements: readonly unknown[],
  appState: Record<string, unknown>,
  files: Record<string, unknown>,
): string {
  return serializeAsJSON(
    elements as never[],
    appState as never,
    files as never,
    "database",
  );
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

function contentSignatureFromSerialized(serialized: string): string {
  try {
    const parsed = JSON.parse(serialized) as {
      elements?: readonly unknown[];
      files?: Record<string, unknown>;
    };
    return buildContentSignature(
      Array.isArray(parsed.elements) ? parsed.elements : [],
      parsed.files && typeof parsed.files === "object" ? parsed.files : {},
    );
  } catch {
    return "";
  }
}

function buildCurrentContentKey(
  api: ExcalidrawImperativeAPI | null,
  fallbackElements: readonly unknown[],
  fallbackAppState: Record<string, unknown>,
  fallbackFiles: Record<string, unknown>,
): string {
  try {
    if (api) {
      const serialized = serializeForDatabase(
        api.getSceneElements() as readonly unknown[],
        api.getAppState() as unknown as Record<string, unknown>,
        api.getFiles() as unknown as Record<string, unknown>,
      );
      return contentSignatureFromSerialized(serialized);
    }
    const serialized = serializeForDatabase(
      fallbackElements,
      fallbackAppState,
      fallbackFiles,
    );
    return contentSignatureFromSerialized(serialized);
  } catch {
    return "";
  }
}

export default function TopicDrawingPad({
  topicTitle,
  initialScene,
  saveBusy,
  onSave,
  onClose,
}: Props) {
  const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null);
  const [dirty, setDirty] = useState(false);
  const [localSaveBusy, setLocalSaveBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);
  const lastSavedContentKeyRef = useRef<string>("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const w = window as Window & { EXCALIDRAW_ASSET_PATH?: string };
      if (!w.EXCALIDRAW_ASSET_PATH) {
        w.EXCALIDRAW_ASSET_PATH = "/";
      }
    }
  }, []);

  const initialData = useMemo<ExcalidrawInitialDataState | undefined>(() => {
    if (!initialScene) return undefined;
    const rawAppState =
      initialScene.appState && typeof initialScene.appState === "object"
        ? { ...initialScene.appState }
        : {};
    // These collaboration-specific fields are Map/Set in runtime and break
    // when rehydrated from plain JSON.
    delete (rawAppState as Record<string, unknown>).collaborators;
    delete (rawAppState as Record<string, unknown>).followedBy;
    delete (rawAppState as Record<string, unknown>).userToFollow;
    return {
      elements: Array.isArray(initialScene.elements) ? (initialScene.elements as never[]) : [],
      appState: rawAppState as ExcalidrawInitialDataState["appState"],
      files: (initialScene.files ?? {}) as ExcalidrawInitialDataState["files"],
    };
  }, [initialScene]);

  useEffect(() => {
    if (!initialData) {
      lastSavedContentKeyRef.current = "";
      return;
    }
    try {
      const serialized = serializeForDatabase(
        (initialData.elements ?? []) as readonly unknown[],
        (initialData.appState ?? {}) as Record<string, unknown>,
        (initialData.files ?? {}) as Record<string, unknown>,
      );
      lastSavedContentKeyRef.current = contentSignatureFromSerialized(serialized);
    } catch {
      lastSavedContentKeyRef.current = "";
    }
  }, [initialData]);

  useEffect(() => {
    setDirty(false);
    setSaveError(null);
    setConfirmCloseOpen(false);
  }, [initialData]);

  const handleSave = useCallback(async (): Promise<boolean> => {
    if (!api) return false;
    setLocalSaveBusy(true);
    setSaveError(null);
    try {
      const serialized = serializeForDatabase(
        api.getSceneElements() as readonly unknown[],
        api.getAppState() as unknown as Record<string, unknown>,
        api.getFiles() as unknown as Record<string, unknown>,
      );
      const parsed = JSON.parse(serialized) as {
        elements?: readonly unknown[];
        appState?: Record<string, unknown>;
        files?: Record<string, unknown>;
      };
      const nextScene = toSerializableScene({
        elements: Array.isArray(parsed.elements) ? parsed.elements : [],
        appState: parsed.appState && typeof parsed.appState === "object" ? parsed.appState : {},
        files: parsed.files && typeof parsed.files === "object" ? parsed.files : {},
      });
      await onSave(nextScene);
      lastSavedContentKeyRef.current = contentSignatureFromSerialized(serialized);
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

  const busy = saveBusy || localSaveBusy;

  return (
    <div className="fixed inset-0 z-50 bg-white dark:bg-gray-950 flex flex-col">
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
            <span className="text-[11px] px-2 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
              Unsaved
            </span>
          )}
          <button
            type="button"
            onClick={() => { void handleSave(); }}
            disabled={busy || !api}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-sky-300 dark:border-sky-700 text-sky-700 dark:text-sky-300 hover:bg-sky-50 dark:hover:bg-sky-900/30 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-semibold transition-colors cursor-pointer"
          >
            Save
          </button>
          <button
            type="button"
            onClick={handleClose}
            disabled={busy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-semibold transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>

      {saveError && (
        <div className="px-4 py-2 text-xs text-red-600 dark:text-red-400 border-b border-red-100 dark:border-red-900/40 bg-red-50 dark:bg-red-900/20">
          {saveError}
        </div>
      )}

      {confirmCloseOpen && (
        <div className="fixed inset-0 z-[70] bg-black/45 flex items-center justify-center px-4">
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

      <div className="flex-1 min-h-0">
        <Excalidraw
          excalidrawAPI={(editorApi) => setApi(editorApi)}
          initialData={initialData}
          onChange={(elements, appState, files) => {
            const currentKey = buildCurrentContentKey(
              api,
              elements as readonly unknown[],
              appState as unknown as Record<string, unknown>,
              files as unknown as Record<string, unknown>,
            );
            if (!lastSavedContentKeyRef.current) {
              lastSavedContentKeyRef.current = currentKey;
              setDirty(false);
              return;
            }
            setDirty(currentKey !== lastSavedContentKeyRef.current);
            if (saveError) setSaveError(null);
          }}
        />
      </div>
    </div>
  );
}
