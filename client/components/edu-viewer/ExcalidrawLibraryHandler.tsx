"use client";

import { useHandleLibrary } from "@excalidraw/excalidraw";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import { useMemo } from "react";

// ─── IndexedDB-backed persistence adapter ────────────────────────────────────
// Uses IndexedDB instead of localStorage to avoid the ~5 MB quota limit.
// IndexedDB typically allows hundreds of MB, so users can store as many
// library items (shapes) as they want without losing older ones.

const IDB_DB_NAME = "ev_excalidraw_library";
const IDB_DB_VERSION = 1;
const IDB_STORE_NAME = "library";
const IDB_KEY = "items";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IDB_DB_NAME, IDB_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(IDB_STORE_NAME)) {
        db.createObjectStore(IDB_STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function idbGet<T>(db: IDBDatabase, key: string): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE_NAME, "readonly");
    const store = tx.objectStore(IDB_STORE_NAME);
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

function idbPut<T>(db: IDBDatabase, key: string, value: T): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE_NAME, "readwrite");
    const store = tx.objectStore(IDB_STORE_NAME);
    const req = store.put(value, key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// We define the adapter shape inline to avoid deep import path issues
// with @excalidraw/excalidraw package types. The useHandleLibrary hook
// uses structural typing, so this is fully compatible.
interface LibraryAdapterData {
  libraryItems: unknown[];
}

interface LibraryAdapter {
  load(metadata: { source: "load" | "save" }): Promise<LibraryAdapterData | null>;
  save(libraryData: LibraryAdapterData): Promise<void>;
}

/**
 * Creates an IndexedDB-backed LibraryPersistenceAdapter.
 *
 * This replaces the default in-memory-only behaviour of useHandleLibrary,
 * ensuring that any shapes the user adds to the Excalidraw library panel
 * persist across page reloads and browser sessions with no size cap issues.
 */
function createIndexedDBAdapter(): LibraryAdapter {
  return {
    async load() {
      try {
        const db = await openDB();
        const data = await idbGet<LibraryAdapterData>(db, IDB_KEY);
        db.close();
        return data ?? null;
      } catch {
        // If IndexedDB is unavailable (e.g. private browsing on some
        // older browsers) gracefully return null so the library starts empty.
        return null;
      }
    },
    async save(libraryData: LibraryAdapterData) {
      try {
        const db = await openDB();
        await idbPut(db, IDB_KEY, libraryData);
        db.close();
      } catch {
        // Best-effort: if saving fails, the library still works in-memory
        // for the current session.
        console.warn("[ExcalidrawLibrary] Failed to persist library to IndexedDB");
      }
    },
  };
}

interface Props {
  excalidrawAPI: ExcalidrawImperativeAPI | null;
}

export default function ExcalidrawLibraryHandler({ excalidrawAPI }: Props) {
  // Memoize so we don't re-create the adapter on every render.
  const adapter = useMemo(() => createIndexedDBAdapter(), []);

  useHandleLibrary({
    excalidrawAPI,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    adapter: adapter as any,
  });
  return null;
}
