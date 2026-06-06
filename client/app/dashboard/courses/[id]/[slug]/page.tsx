"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { notFound } from "next/navigation";
import { Redo2, Trash2, Undo2 } from "lucide-react";
import AppNavbar from "@/components/edu-viewer/AppNavbar";
import CourseDetailToc from "@/components/edu-viewer/CourseDetailToc";
import UserMenu from "@/components/edu-viewer/UserMenu";
import TopicDrawingPad from "@/components/edu-viewer/TopicDrawingPad";
import {
  getAuthToken,
  clearAuthToken,
  getProgress,
  getUser,
  resetCourseProgress,
  getViewerCourseSettings,
  updateViewerCourseSettings,
} from "@/utils/authClient";
import type {
  CourseResetScope,
  ProgressData,
  CourseViewerSettings,
  ViewerCourseNote,
  ViewerDrawingScene,
  ViewerHighlight,
  ViewerTopicNote,
} from "@/utils/authClient";
import { getBackendApiBase } from "@/utils/runtime-config";
import { readDrawingDrawerOpen, writeDrawingDrawerOpen } from "@/utils/drawingDrawerState";

const BACKEND = getBackendApiBase();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const inflightFetches = new Map<string, Promise<any>>();

function safeFromPath(path: string | null): string | null {
  if (!path) return null;
  if (!path.startsWith("/") || path.startsWith("//")) return null;
  return path;
}

function getLastVisitedStorageKey(courseId: number): string {
  return `ev:last-visited-topic:${courseId}`;
}

function readLastVisitedTopicFromStorage(courseId: number): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(getLastVisitedStorageKey(courseId));
    if (raw == null || raw.trim() === "") return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  } catch {
    return null;
  }
}

function clearLastVisitedTopicFromStorage(courseId: number): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(getLastVisitedStorageKey(courseId));
  } catch {
    // ignore storage errors
  }
}

type ReaderPanelMode = "bookmarks" | "highlightNotes" | "drawing";
const READER_PANEL_ANIM_MS = 220;
function deferEffectState(callback: () => void): () => void {
  const frameId = window.requestAnimationFrame(callback);
  return () => window.cancelAnimationFrame(frameId);
}
const RESET_SCOPE_OPTIONS: Array<{ key: CourseResetScope; label: string; description: string }> = [
  { key: "progress", label: "Progress", description: "Completed topics and course progress." },
  { key: "bookmarks", label: "Bookmarks", description: "All bookmarks saved in this course." },
  { key: "highlights", label: "Highlights", description: "All highlighted text and attached notes." },
  { key: "notes", label: "Notes", description: "Topic notes and course-level notes." },
  { key: "drawing", label: "Drawing Board", description: "Saved drawing board canvas for this course." },
];

type NoteHistoryEntry = {
  undo: () => Promise<boolean>;
  redo: () => Promise<boolean>;
};
type BookmarkHistoryEntry = NoteHistoryEntry;

function buildTopicHref(
  courseId: number,
  slug: string,
  topicIndex: number,
  topicSlug: string,
  fromPath?: string | null
): string {
  const base = `/dashboard/courses/${courseId}/${slug}/topics/${topicIndex}/${topicSlug}`;
  if (!fromPath || !fromPath.startsWith("/") || fromPath.startsWith("//")) return base;
  return `${base}?from=${encodeURIComponent(fromPath)}`;
}

export default function CourseDetailPage() {
  const params = useParams<{ id: string; slug: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const routeId = params?.id ?? "";
  const routeSlug = params?.slug ?? "";
  const courseId = Number(routeId);
  const fromPath = safeFromPath(searchParams.get("from"));
  const fromPathsPage = Boolean(fromPath?.startsWith("/dashboard/paths"));
  const fromProjectsPage = Boolean(fromPath?.startsWith("/dashboard/projects"));
  const sectionCrumb = fromPathsPage
    ? { label: "Paths", href: fromPath ?? "/dashboard/paths" }
    : fromProjectsPage
      ? { label: "Projects", href: fromPath ?? "/dashboard/projects" }
      : { label: "Courses", href: "/dashboard/courses" };
  const backHref = fromPathsPage
    ? (fromPath ?? "/dashboard/paths")
    : fromProjectsPage
      ? (fromPath ?? "/dashboard/projects")
      : "/dashboard/courses";
  const backLabel = fromPathsPage ? "Paths" : fromProjectsPage ? "Projects" : "Courses";
  const isInvalidCourseId = Number.isNaN(courseId);

  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [progress, setProgress] = useState<ProgressData>({ course_order: [], completed: {} });
  const [lastVisitedTopicIndex, setLastVisitedTopicIndex] = useState<number | null>(null);
  const [bookmarkedTopicIndices, setBookmarkedTopicIndices] = useState<Set<number>>(new Set());
  const [selectedBookmarkIndices, setSelectedBookmarkIndices] = useState<Set<number>>(new Set());
  const [bookmarksEnabled, setBookmarksEnabled] = useState(true);
  const [highlightsEnabled, setHighlightsEnabled] = useState(true);
  const [notesEnabled, setNotesEnabled] = useState(true);
  const [drawingsEnabled, setDrawingsEnabled] = useState(true);
  const [searchEnabled, setSearchEnabled] = useState(true);
  const [viewerCourseState, setViewerCourseState] = useState<CourseViewerSettings>({});
  const [readerPanelMounted, setReaderPanelMounted] = useState(false);
  const [readerPanelVisible, setReaderPanelVisible] = useState(false);
  const [readerPanelMode, setReaderPanelMode] = useState<ReaderPanelMode>("bookmarks");
  const [readerPanelWidth, setReaderPanelWidth] = useState(() => {
    if (typeof window === "undefined") return 960;
    const max = Math.max(520, window.innerWidth - 24);
    const min = Math.min(420, max);
    return Math.max(min, Math.min(window.innerWidth * 0.6, max));
  });
  const [readerBusy, setReaderBusy] = useState(false);
  const [bookmarkHistoryBusy, setBookmarkHistoryBusy] = useState(false);
  const [bookmarkUndoStack, setBookmarkUndoStack] = useState<BookmarkHistoryEntry[]>([]);
  const [bookmarkRedoStack, setBookmarkRedoStack] = useState<BookmarkHistoryEntry[]>([]);
  const [noteHistoryBusy, setNoteHistoryBusy] = useState(false);
  const [noteUndoStack, setNoteUndoStack] = useState<NoteHistoryEntry[]>([]);
  const [noteRedoStack, setNoteRedoStack] = useState<NoteHistoryEntry[]>([]);
  const [courseDrawingSaveBusy, setCourseDrawingSaveBusy] = useState(false);
  const [topicAddOpenByTopic, setTopicAddOpenByTopic] = useState<Record<string, boolean>>({});
  const [topicAddDraftByTopic, setTopicAddDraftByTopic] = useState<Record<string, string>>({});
  const [topicNoteDrafts, setTopicNoteDrafts] = useState<Record<string, string>>({});
  const [topicNoteEditOpen, setTopicNoteEditOpen] = useState<Record<string, boolean>>({});
  const [highlightNoteDrafts, setHighlightNoteDrafts] = useState<Record<string, string>>({});
  const [highlightNoteEditOpen, setHighlightNoteEditOpen] = useState<Record<string, boolean>>({});
  const [courseAddOpen, setCourseAddOpen] = useState(false);
  const [courseAddDraft, setCourseAddDraft] = useState("");
  const [courseNoteDrafts, setCourseNoteDrafts] = useState<Record<string, string>>({});
  const [courseNoteEditOpen, setCourseNoteEditOpen] = useState<Record<string, boolean>>({});
  const [bookmarkDeleteDraft, setBookmarkDeleteDraft] = useState<number[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [resetScopeSelection, setResetScopeSelection] = useState<Record<CourseResetScope, boolean>>({
    progress: true,
    bookmarks: true,
    highlights: true,
    notes: true,
    drawing: true,
  });
  const panelCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const readerResizeStateRef = useRef<{ active: boolean; startX: number; startWidth: number }>({
    active: false,
    startX: 0,
    startWidth: 960,
  });
  const isLoading = !isInvalidCourseId && loading;
  const isMissing = isInvalidCourseId || missing;

  useEffect(() => {
    return () => {
      if (panelCloseTimerRef.current) {
        clearTimeout(panelCloseTimerRef.current);
        panelCloseTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (isInvalidCourseId) return;
    let cancelled = false;
    const basePath = `/dashboard/courses/${routeId}/${routeSlug}`;
    const nextPath = fromPath ? `${basePath}?from=${encodeURIComponent(fromPath)}` : basePath;
    const hadToken = Boolean(getAuthToken());

    getUser()
      .then(() => {
        if (cancelled) return;

        const token = getAuthToken();
        if (!token) {
          router.replace(`/auth?next=${nextPath}`);
          return;
        }

        const fetchKey = `course-details-${courseId}`;
        let coursePromise = inflightFetches.get(fetchKey);
        if (!coursePromise) {
          coursePromise = fetch(`${BACKEND}/api/course-details`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ course_id: courseId }),
          }).then(async (r) => {
            if (r.status === 401) throw Object.assign(new Error("Unauthorized"), { status: 401 });
            if (r.status === 404) return null;
            if (!r.ok) throw new Error(`Failed to load course (${r.status})`);
            return r.json() as Promise<CourseDetail>;
          }).finally(() => setTimeout(() => inflightFetches.delete(fetchKey), 50));
          inflightFetches.set(fetchKey, coursePromise);
        }

        Promise.all([coursePromise, getProgress(), getViewerCourseSettings(courseId)])
          .then(([data, prog, viewerCoursePayload]) => {
            if (cancelled) return;
            if (!data) { setMissing(true); setLoading(false); return; }
            setCourse(data);
            setProgress(prog);
            const viewerCourse = viewerCoursePayload.course;
            const canUseBookmarks = viewerCoursePayload.features.bookmarks_enabled !== false;
            setBookmarksEnabled(canUseBookmarks);
            setHighlightsEnabled(viewerCoursePayload.features.highlights_enabled !== false);
            setNotesEnabled(viewerCoursePayload.features.notes_enabled !== false);
            setDrawingsEnabled(viewerCoursePayload.features.drawings_enabled !== false);
            setSearchEnabled(viewerCoursePayload.features.search_enabled !== false);
            setViewerCourseState(viewerCourse && typeof viewerCourse === "object" ? viewerCourse : {});
            setLastVisitedTopicIndex(readLastVisitedTopicFromStorage(courseId));
            const rawBookmarks = viewerCourse?.bookmarks;
            setBookmarkedTopicIndices(
              new Set(
                canUseBookmarks && Array.isArray(rawBookmarks)
                  ? rawBookmarks.filter((v): v is number => typeof v === "number" && Number.isFinite(v))
                  : []
              )
            );
            setLoading(false);
          })
          .catch((err: unknown) => {
            if (cancelled) return;
            if (err && (err as { status?: number }).status === 401) {
              clearAuthToken();
              window.location.replace("/auth?reason=session_expired");
              return;
            }
            setMissing(true);
            setLoading(false);
          });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const status = (err as { status?: number })?.status;

        if (status === 401 && hadToken) {
          // authClient already redirected to /auth?reason=session_expired.
          return;
        }

        router.replace(`/auth?next=${nextPath}`);
      });

    return () => {
      cancelled = true;
    };
  }, [courseId, routeId, routeSlug, router, fromPath, isInvalidCourseId]);

  const clampReaderPanelWidth = useCallback((next: number) => {
    if (typeof window === "undefined") return 960;
    const max = Math.max(520, window.innerWidth - 24);
    const min = Math.min(420, max);
    return Math.max(min, Math.min(next, max));
  }, []);

  useEffect(() => {
    if (!readerPanelMounted) return;
    const onResize = () => {
      setReaderPanelWidth((prev) => clampReaderPanelWidth(prev));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [clampReaderPanelWidth, readerPanelMounted]);

  useEffect(() => {
    const onPointerMove = (e: PointerEvent) => {
      const state = readerResizeStateRef.current;
      if (!state.active) return;
      const delta = state.startX - e.clientX;
      setReaderPanelWidth(clampReaderPanelWidth(state.startWidth + delta));
    };
    const onPointerUp = () => {
      readerResizeStateRef.current.active = false;
    };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [clampReaderPanelWidth]);

  useEffect(() => {
    if (!drawingsEnabled || isLoading || isMissing) {
      if (!drawingsEnabled) writeDrawingDrawerOpen(courseId, false);
      return;
    }
    if (!readDrawingDrawerOpen(courseId)) return;
    if (readerPanelMounted && readerPanelMode === "drawing") return;
    return deferEffectState(() => {
      setReaderPanelMode("drawing");
      setSelectedBookmarkIndices(new Set());
      setReaderPanelWidth(clampReaderPanelWidth(window.innerWidth * 0.6));
      if (panelCloseTimerRef.current) {
        clearTimeout(panelCloseTimerRef.current);
        panelCloseTimerRef.current = null;
      }
      setReaderPanelMounted(true);
      requestAnimationFrame(() => setReaderPanelVisible(true));
    });
  }, [
    clampReaderPanelWidth,
    courseId,
    drawingsEnabled,
    isLoading,
    isMissing,
    readerPanelMode,
    readerPanelMounted,
  ]);

  if (isLoading) {
    return (
      <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
        <AppNavbar
          crumbs={[
            { label: "Dashboard", href: "/dashboard" },
            sectionCrumb,
            { label: "…" }
          ]}
          backHref={backHref}
          backLabel={backLabel}
          actions={<UserMenu />}
        />
        <div className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <div className="max-w-5xl mx-auto px-6 py-5 space-y-2.5">
            <div className="h-5 w-14 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
            <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" style={{ width: "55%" }} />
            <div className="h-4 w-36 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          </div>
        </div>
        <div className="max-w-5xl mx-auto px-6 py-8 space-y-7">
          {([3,5,2,4] as const).map((count, i) => (
            <div key={i}>
              <div className="h-4 w-40 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-3" />
              <div className="space-y-2">
                {Array.from({ length: count }).map((_, j) => (
                  <div key={j} className="h-12 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 animate-pulse" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </main>
    );
  }

  if (isMissing || !course) return notFound();

  const completedIds: number[] = progress.completed[String(courseId)] ?? [];
  const completedTopicIndices = new Set(completedIds);
  const totalTopics = course.toc.reduce(
    (acc, entry) => acc + ("topics" in entry ? entry.topics.length : 1),
    0
  );
  const topicMetaByIndex = new Map<number, { title: string; slug: string }>();
  for (const entry of course.toc) {
    if ("topics" in entry) {
      for (const topic of entry.topics) {
        topicMetaByIndex.set(topic.topic_index, { title: topic.title, slug: topic.slug });
      }
    } else {
      topicMetaByIndex.set(entry.topic_index, { title: entry.title, slug: entry.slug });
    }
  }
  const selectedBookmarkCount = selectedBookmarkIndices.size;
  const bookmarkCount = bookmarkedTopicIndices.size;
  const bookmarkDeleteSelectionLabel =
    selectedBookmarkCount === 0
      ? null
      : selectedBookmarkCount === bookmarkCount
        ? "All"
        : String(selectedBookmarkCount);

  const applyViewerCourseState = (next: CourseViewerSettings | null) => {
    const safe = next && typeof next === "object" ? next : {};
    setViewerCourseState(safe);
    const rawBookmarks = safe.bookmarks;
    setBookmarkedTopicIndices(
      new Set(
        bookmarksEnabled && Array.isArray(rawBookmarks)
          ? rawBookmarks.filter((v): v is number => typeof v === "number" && Number.isFinite(v))
          : []
      )
    );
    setLastVisitedTopicIndex(readLastVisitedTopicFromStorage(courseId));
  };

  const mutateViewerCourse = async (payload: Parameters<typeof updateViewerCourseSettings>[0]) => {
    setReaderBusy(true);
    try {
      const next = await updateViewerCourseSettings(payload);
      applyViewerCourseState(next);
      return next;
    } finally {
      setReaderBusy(false);
    }
  };

  const pushNoteHistory = (entry: NoteHistoryEntry) => {
    setNoteUndoStack((prev) => [...prev.slice(-24), entry]);
    setNoteRedoStack([]);
  };

  const applyBookmarkTopics = async (topicIndices: number[], bookmarked: boolean) => {
    const uniqueTopicIndices = [...new Set(topicIndices)].sort((a, b) => a - b);
    if (uniqueTopicIndices.length === 0) return false;
    if (!bookmarked) {
      const next = await updateViewerCourseSettings({
        course_id: courseId,
        remove_bookmark_topic_indices: uniqueTopicIndices,
      });
      applyViewerCourseState(next);
      setSelectedBookmarkIndices((prev) => {
        const nextSet = new Set(prev);
        uniqueTopicIndices.forEach((idx) => nextSet.delete(idx));
        return nextSet;
      });
      return true;
    }

    let nextState: CourseViewerSettings | null = null;
    for (const topicIndex of uniqueTopicIndices) {
      nextState = await updateViewerCourseSettings({
        course_id: courseId,
        bookmark_topic_index: topicIndex,
        bookmarked: true,
      });
    }
    applyViewerCourseState(nextState);
    return true;
  };

  const pushBookmarkHistory = (entry: BookmarkHistoryEntry) => {
    setBookmarkUndoStack((prev) => [...prev.slice(-24), entry]);
    setBookmarkRedoStack([]);
  };

  const handleUndoBookmarkAction = async () => {
    if (bookmarkHistoryBusy || bookmarkUndoStack.length === 0) return;
    const entry = bookmarkUndoStack[bookmarkUndoStack.length - 1];
    setBookmarkHistoryBusy(true);
    setReaderBusy(true);
    try {
      const applied = await entry.undo();
      if (!applied) return;
      setBookmarkUndoStack((prev) => prev.slice(0, -1));
      setBookmarkRedoStack((prev) => [...prev, entry]);
    } finally {
      setReaderBusy(false);
      setBookmarkHistoryBusy(false);
    }
  };

  const handleRedoBookmarkAction = async () => {
    if (bookmarkHistoryBusy || bookmarkRedoStack.length === 0) return;
    const entry = bookmarkRedoStack[bookmarkRedoStack.length - 1];
    setBookmarkHistoryBusy(true);
    setReaderBusy(true);
    try {
      const applied = await entry.redo();
      if (!applied) return;
      setBookmarkRedoStack((prev) => prev.slice(0, -1));
      setBookmarkUndoStack((prev) => [...prev, entry]);
    } finally {
      setReaderBusy(false);
      setBookmarkHistoryBusy(false);
    }
  };

  const handleUndoNoteAction = async () => {
    if (noteHistoryBusy || noteUndoStack.length === 0) return;
    const entry = noteUndoStack[noteUndoStack.length - 1];
    setNoteHistoryBusy(true);
    try {
      const applied = await entry.undo();
      if (!applied) return;
      setNoteUndoStack((prev) => prev.slice(0, -1));
      setNoteRedoStack((prev) => [...prev, entry]);
    } finally {
      setNoteHistoryBusy(false);
    }
  };

  const handleRedoNoteAction = async () => {
    if (noteHistoryBusy || noteRedoStack.length === 0) return;
    const entry = noteRedoStack[noteRedoStack.length - 1];
    setNoteHistoryBusy(true);
    try {
      const applied = await entry.redo();
      if (!applied) return;
      setNoteRedoStack((prev) => prev.slice(0, -1));
      setNoteUndoStack((prev) => [...prev, entry]);
    } finally {
      setNoteHistoryBusy(false);
    }
  };

  const handleResetProgress = async () => {
    const selectedScopes = RESET_SCOPE_OPTIONS
      .filter(({ key }) => resetScopeSelection[key])
      .map(({ key }) => key);
    if (selectedScopes.length === 0) return;
    setResetting(true);
    try {
      await resetCourseProgress(courseId, selectedScopes);
      if (selectedScopes.includes("progress")) {
        setProgress(p => {
          const next = { ...p.completed };
          delete next[String(courseId)];
          return { ...p, completed: next };
        });
        setLastVisitedTopicIndex(null);
        clearLastVisitedTopicFromStorage(courseId);
      }
      if (selectedScopes.some((scope) => ["bookmarks", "highlights", "notes", "drawing"].includes(scope))) {
        setViewerCourseState((prev) => {
          const next = { ...(prev ?? {}) };
          if (selectedScopes.includes("bookmarks")) next.bookmarks = [];
          if (selectedScopes.includes("highlights")) next.highlights = {};
          if (selectedScopes.includes("notes")) {
            next.topic_notes = {};
            next.course_notes = [];
          }
          if (selectedScopes.includes("drawing")) delete next.drawing_note;
          return next;
        });
      }
      if (selectedScopes.includes("bookmarks")) {
        setBookmarkedTopicIndices(new Set<number>());
        setSelectedBookmarkIndices(new Set<number>());
        setBookmarkUndoStack([]);
        setBookmarkRedoStack([]);
      }
      if (selectedScopes.includes("notes")) {
        setCourseAddOpen(false);
        setCourseAddDraft("");
        setTopicAddOpenByTopic({});
        setTopicAddDraftByTopic({});
        setTopicNoteDrafts({});
        setTopicNoteEditOpen({});
        setCourseNoteDrafts({});
        setCourseNoteEditOpen({});
      }
      if (selectedScopes.includes("highlights")) {
        setHighlightNoteDrafts({});
        setHighlightNoteEditOpen({});
      }
      if (selectedScopes.includes("notes") || selectedScopes.includes("highlights")) {
        setNoteUndoStack([]);
        setNoteRedoStack([]);
      }
      setShowResetDialog(false);
    } catch (err) {
      console.error("Failed to reset progress", err);
    } finally {
      setResetting(false);
    }
  };

  const openReaderPanel = (mode: ReaderPanelMode) => {
    setReaderPanelMode(mode);
    writeDrawingDrawerOpen(courseId, mode === "drawing");
    if (mode !== "bookmarks") {
      setSelectedBookmarkIndices(new Set());
    }
    if (typeof window !== "undefined") {
      const targetRatio = mode === "drawing" ? 0.6 : 0.3;
      setReaderPanelWidth(clampReaderPanelWidth(window.innerWidth * targetRatio));
    }
    if (panelCloseTimerRef.current) {
      clearTimeout(panelCloseTimerRef.current);
      panelCloseTimerRef.current = null;
    }
    setReaderPanelMounted(true);
    requestAnimationFrame(() => setReaderPanelVisible(true));
  };

  const closeReaderPanel = () => {
    writeDrawingDrawerOpen(courseId, false);
    setSelectedBookmarkIndices(new Set());
    if (panelCloseTimerRef.current) {
      clearTimeout(panelCloseTimerRef.current);
    }
    setReaderPanelVisible(false);
    panelCloseTimerRef.current = setTimeout(() => {
      setReaderPanelMounted(false);
      panelCloseTimerRef.current = null;
    }, READER_PANEL_ANIM_MS);
  };

  const handleStartReaderResize = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    readerResizeStateRef.current = {
      active: true,
      startX: e.clientX,
      startWidth: readerPanelWidth,
    };
  };

  const handleSaveCourseDrawing = async (scene: ViewerDrawingScene) => {
    setCourseDrawingSaveBusy(true);
    try {
      await updateViewerCourseSettings({
        course_id: courseId,
        upsert_course_drawing_note: { scene },
      }, { includeCourse: false });
      setViewerCourseState((prev) => ({
        ...prev,
        drawing_note: {
          scene,
          updated_at: new Date().toISOString(),
        },
      }));
    } finally {
      setCourseDrawingSaveBusy(false);
    }
  };

  const handleDeleteCourseDrawing = async () => {
    setCourseDrawingSaveBusy(true);
    try {
      await updateViewerCourseSettings({
        course_id: courseId,
        remove_course_drawing_note: {},
      }, { includeCourse: false });
      setViewerCourseState((prev) => {
        const next = { ...prev };
        delete next.drawing_note;
        return next;
      });
    } finally {
      setCourseDrawingSaveBusy(false);
    }
  };

  const handleRemoveBookmarks = async (topicIndices: number[]) => {
    const removedTopicIndices = [...new Set(topicIndices)]
      .filter((topicIndex) => bookmarkedTopicIndices.has(topicIndex))
      .sort((a, b) => a - b);
    if (readerBusy || removedTopicIndices.length === 0) return;
    setReaderBusy(true);
    try {
      const next = await updateViewerCourseSettings({
        course_id: courseId,
        remove_bookmark_topic_indices: removedTopicIndices,
      });
      applyViewerCourseState(next);
      setSelectedBookmarkIndices((prev) => {
        const nextSet = new Set(prev);
        removedTopicIndices.forEach((idx) => nextSet.delete(idx));
        return nextSet;
      });
      pushBookmarkHistory({
        undo: async () => applyBookmarkTopics(removedTopicIndices, true),
        redo: async () => applyBookmarkTopics(removedTopicIndices, false),
      });
    } catch (err) {
      console.error("Failed to remove bookmarks", err);
    } finally {
      setReaderBusy(false);
    }
  };

  const getTopicNotesFromState = (state: CourseViewerSettings | null, topicIndex: number): ViewerTopicNote[] => {
    const rows = state?.topic_notes?.[String(topicIndex)];
    return Array.isArray(rows) ? rows : [];
  };

  const getHighlightsFromState = (state: CourseViewerSettings | null, topicIndex: number): ViewerHighlight[] => {
    const rows = state?.highlights?.[String(topicIndex)];
    return Array.isArray(rows) ? rows : [];
  };

  const getCourseNotesFromState = (state: CourseViewerSettings | null): ViewerCourseNote[] => {
    return Array.isArray(state?.course_notes) ? state.course_notes : [];
  };

  const handleAddTopicNote = async (topicKey: string, topicIndex: number, text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const beforeRows = getTopicNotesFromState(viewerCourseState, topicIndex);
    const next = await mutateViewerCourse({
      course_id: courseId,
      add_topic_note: { topic_index: topicIndex, text: trimmed },
    });
    const afterRows = getTopicNotesFromState(next, topicIndex);
    const existingIds = new Set(beforeRows.map((row) => row.id));
    const added = afterRows.find((row) => !existingIds.has(row.id));
    if (!added) return;
    const noteRef = { id: added.id };
    pushNoteHistory({
      undo: async () => {
        if (!noteRef.id) return false;
        await mutateViewerCourse({
          course_id: courseId,
          remove_topic_note: { topic_index: topicIndex, note_id: noteRef.id },
        });
        return true;
      },
      redo: async () => {
        const redoNext = await mutateViewerCourse({
          course_id: courseId,
          add_topic_note: { topic_index: topicIndex, text: trimmed },
        });
        const redoRows = getTopicNotesFromState(redoNext, topicIndex);
        const refreshed = redoRows.find((row) => !beforeRows.some((old) => old.id === row.id) && row.text.trim() === trimmed);
        noteRef.id = refreshed?.id ?? noteRef.id;
        return true;
      },
    });
    setTopicAddDraftByTopic((prev) => ({ ...prev, [topicKey]: "" }));
    setTopicAddOpenByTopic((prev) => ({ ...prev, [topicKey]: false }));
  };

  const handleUpdateTopicNote = async (topicIndex: number, noteId: string, beforeText: string, nextText: string, draftKey: string) => {
    const trimmed = nextText.trim();
    if (!trimmed) return;
    await mutateViewerCourse({
      course_id: courseId,
      update_topic_note: { topic_index: topicIndex, note_id: noteId, text: trimmed },
    });
    pushNoteHistory({
      undo: async () => {
        await mutateViewerCourse({
          course_id: courseId,
          update_topic_note: { topic_index: topicIndex, note_id: noteId, text: beforeText },
        });
        return true;
      },
      redo: async () => {
        await mutateViewerCourse({
          course_id: courseId,
          update_topic_note: { topic_index: topicIndex, note_id: noteId, text: trimmed },
        });
        return true;
      },
    });
    setTopicNoteEditOpen((prev) => ({ ...prev, [draftKey]: false }));
  };

  const handleRemoveTopicNote = async (topicIndex: number, note: ViewerTopicNote) => {
    await mutateViewerCourse({
      course_id: courseId,
      remove_topic_note: { topic_index: topicIndex, note_id: note.id },
    });
    const noteRef = { id: note.id };
    pushNoteHistory({
      undo: async () => {
        const next = await mutateViewerCourse({
          course_id: courseId,
          add_topic_note: { topic_index: topicIndex, text: note.text },
        });
        const rows = getTopicNotesFromState(next, topicIndex);
        const restored = rows.find((row) => row.text.trim() === note.text.trim() && row.id !== note.id);
        noteRef.id = restored?.id ?? noteRef.id;
        return true;
      },
      redo: async () => {
        if (!noteRef.id) return false;
        await mutateViewerCourse({
          course_id: courseId,
          remove_topic_note: { topic_index: topicIndex, note_id: noteRef.id },
        });
        return true;
      },
    });
  };

  const handleAddCourseNote = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const beforeRows = getCourseNotesFromState(viewerCourseState);
    const next = await mutateViewerCourse({
      course_id: courseId,
      add_course_note: { text: trimmed },
    });
    const afterRows = getCourseNotesFromState(next);
    const existingIds = new Set(beforeRows.map((row) => row.id));
    const added = afterRows.find((row) => !existingIds.has(row.id));
    if (!added) return;
    const noteRef = { id: added.id };
    pushNoteHistory({
      undo: async () => {
        await mutateViewerCourse({
          course_id: courseId,
          remove_course_note: { note_id: noteRef.id },
        });
        return true;
      },
      redo: async () => {
        const redoNext = await mutateViewerCourse({
          course_id: courseId,
          add_course_note: { text: trimmed },
        });
        const rows = getCourseNotesFromState(redoNext);
        const refreshed = rows.find((row) => !beforeRows.some((old) => old.id === row.id) && row.text.trim() === trimmed);
        noteRef.id = refreshed?.id ?? noteRef.id;
        return true;
      },
    });
    setCourseAddDraft("");
    setCourseAddOpen(false);
  };

  const handleUpdateCourseNote = async (noteId: string, beforeText: string, nextText: string) => {
    const trimmed = nextText.trim();
    if (!trimmed) return;
    await mutateViewerCourse({
      course_id: courseId,
      update_course_note: { note_id: noteId, text: trimmed },
    });
    pushNoteHistory({
      undo: async () => {
        await mutateViewerCourse({
          course_id: courseId,
          update_course_note: { note_id: noteId, text: beforeText },
        });
        return true;
      },
      redo: async () => {
        await mutateViewerCourse({
          course_id: courseId,
          update_course_note: { note_id: noteId, text: trimmed },
        });
        return true;
      },
    });
    setCourseNoteEditOpen((prev) => ({ ...prev, [noteId]: false }));
  };

  const handleRemoveCourseNote = async (note: ViewerCourseNote) => {
    await mutateViewerCourse({
      course_id: courseId,
      remove_course_note: { note_id: note.id },
    });
    const noteRef = { id: note.id };
    pushNoteHistory({
      undo: async () => {
        const next = await mutateViewerCourse({
          course_id: courseId,
          add_course_note: { text: note.text },
        });
        const rows = getCourseNotesFromState(next);
        const restored = rows.find((row) => row.text.trim() === note.text.trim() && row.id !== note.id);
        noteRef.id = restored?.id ?? noteRef.id;
        return true;
      },
      redo: async () => {
        await mutateViewerCourse({
          course_id: courseId,
          remove_course_note: { note_id: noteRef.id },
        });
        return true;
      },
    });
  };

  const handleUpdateHighlightNote = async (topicIndex: number, row: ViewerHighlight, nextNote: string, draftKey: string) => {
    const before = row.note ?? "";
    const trimmed = nextNote.trim();
    await mutateViewerCourse({
      course_id: courseId,
      update_highlight_note: {
        topic_index: topicIndex,
        highlight_id: row.id,
        note: trimmed,
      },
    });
    pushNoteHistory({
      undo: async () => {
        await mutateViewerCourse({
          course_id: courseId,
          update_highlight_note: {
            topic_index: topicIndex,
            highlight_id: row.id,
            note: before,
          },
        });
        return true;
      },
      redo: async () => {
        await mutateViewerCourse({
          course_id: courseId,
          update_highlight_note: {
            topic_index: topicIndex,
            highlight_id: row.id,
            note: trimmed,
          },
        });
        return true;
      },
    });
    setHighlightNoteEditOpen((prev) => ({ ...prev, [draftKey]: false }));
  };

  const handleRemoveHighlight = async (topicIndex: number, row: ViewerHighlight) => {
    await mutateViewerCourse({
      course_id: courseId,
      remove_highlight: {
        topic_index: topicIndex,
        highlight_id: row.id,
      },
    });
    const highlightRef = { id: row.id };
    const startOffset = row.start_offset;
    const endOffset = row.end_offset;
    const componentIndex = row.component_index;
    if (
      typeof startOffset !== "number"
      || typeof endOffset !== "number"
      || typeof componentIndex !== "number"
    ) {
      return;
    }
    pushNoteHistory({
      undo: async () => {
        const next = await mutateViewerCourse({
          course_id: courseId,
          add_highlight: {
            topic_index: topicIndex,
            text: row.text,
            context: row.context,
            quote_prefix: row.quote_prefix,
            quote_suffix: row.quote_suffix,
            note: row.note,
            color: row.color,
            start_offset: startOffset,
            end_offset: endOffset,
            component_index: componentIndex,
          },
        });
        const rows = getHighlightsFromState(next, topicIndex);
        const restored = rows.find((item) => (
          item.id !== highlightRef.id
          && item.text.trim() === row.text.trim()
          && item.start_offset === startOffset
          && item.end_offset === endOffset
          && item.component_index === componentIndex
        ));
        highlightRef.id = restored?.id ?? highlightRef.id;
        return true;
      },
      redo: async () => {
        if (!highlightRef.id) return false;
        await mutateViewerCourse({
          course_id: courseId,
          remove_highlight: {
            topic_index: topicIndex,
            highlight_id: highlightRef.id,
          },
        });
        return true;
      },
    });
  };

  const handleClearAllTopicNotes = async () => {
    const operations = topicNotesEntries.flatMap(({ topicIndex, notes }) =>
      notes.map((note) => ({ topicIndex, noteId: note.id }))
    );
    if (operations.length === 0) return;
    setNoteUndoStack([]);
    setNoteRedoStack([]);
    for (const op of operations) {
      await mutateViewerCourse({
        course_id: courseId,
        remove_topic_note: { topic_index: op.topicIndex, note_id: op.noteId },
      });
    }
    setTopicAddOpenByTopic({});
    setTopicAddDraftByTopic({});
    setTopicNoteEditOpen({});
    setTopicNoteDrafts({});
  };

  const handleClearAllCourseNotes = async () => {
    if (courseNotes.length === 0) return;
    setNoteUndoStack([]);
    setNoteRedoStack([]);
    for (const note of courseNotes) {
      await mutateViewerCourse({
        course_id: courseId,
        remove_course_note: { note_id: note.id },
      });
    }
    setCourseAddOpen(false);
    setCourseAddDraft("");
    setCourseNoteEditOpen({});
    setCourseNoteDrafts({});
  };

  const handleClearAllHighlights = async () => {
    const operations = highlightEntries
      .filter((entry) => entry.rows.length > 0)
      .map((entry) => entry.topicIndex);
    if (operations.length === 0) return;
    setNoteUndoStack([]);
    setNoteRedoStack([]);
    for (const topicIndex of operations) {
      await mutateViewerCourse({
        course_id: courseId,
        clear_highlights_topic_index: topicIndex,
      });
    }
    setHighlightNoteEditOpen({});
    setHighlightNoteDrafts({});
  };

  const topicNotesEntries = Object.entries(viewerCourseState.topic_notes ?? {})
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([topicKey, notes]) => ({
      topicKey,
      topicIndex: Number(topicKey),
      notes: Array.isArray(notes) ? notes : [],
    }));
  const highlightEntries = Object.entries(viewerCourseState.highlights ?? {})
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([topicKey, rows]) => ({
      topicKey,
      topicIndex: Number(topicKey),
      rows: Array.isArray(rows) ? rows : [],
    }));
  const courseNotes = Array.isArray(viewerCourseState.course_notes)
    ? viewerCourseState.course_notes
    : [];
  const topicNotesCount = topicNotesEntries.reduce((sum, entry) => sum + entry.notes.length, 0);
  const highlightsCount = highlightEntries.reduce((sum, entry) => sum + entry.rows.length, 0);
  const topicNotesByKey = new Map(topicNotesEntries.map((entry) => [entry.topicKey, entry.notes] as const));
  const highlightRowsByKey = new Map(highlightEntries.map((entry) => [entry.topicKey, entry.rows] as const));
  const groupedTopicEntries = Array.from(
    new Set([
      ...topicNotesEntries.map((entry) => entry.topicKey),
      ...highlightEntries.map((entry) => entry.topicKey),
    ])
  )
    .sort((a, b) => Number(a) - Number(b))
    .map((topicKey) => ({
      topicKey,
      topicIndex: Number(topicKey),
      notes: topicNotesByKey.get(topicKey) ?? [],
      rows: highlightRowsByKey.get(topicKey) ?? [],
    }));
  const notesDrawerEnabled = highlightsEnabled || notesEnabled;
  const selectedResetScopeCount = RESET_SCOPE_OPTIONS.reduce(
    (count, option) => count + (resetScopeSelection[option.key] ? 1 : 0),
    0,
  );
  const readerContentShiftStyle = readerPanelMounted
    ? { marginRight: `${readerPanelWidth}px` }
    : undefined;

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <AppNavbar
        crumbs={[
          { label: "Dashboard", href: "/dashboard" },
          sectionCrumb,
          { label: course.title },
        ]}
        backHref={backHref}
        backLabel={backLabel}
        actions={<UserMenu />}
      />
      <div className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 transition-[margin-right] duration-200" style={readerContentShiftStyle}>
        <div className="max-w-5xl mx-auto px-6 py-5 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              {course.type && (
                <span className="text-[10px] font-semibold uppercase tracking-wider bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 px-2.5 py-0.5 rounded-full border border-indigo-100 dark:border-indigo-800">
                  {course.type}
                </span>
              )}
            </div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white leading-snug">{course.title}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {totalTopics} lesson{totalTopics !== 1 ? "s" : ""} &middot;{" "}
              {course.toc.length} chapter{course.toc.length !== 1 ? "s" : ""}
            </p>
          </div>
          
          {/* Header actions moved to floating rail/buttons to avoid small-screen collisions */}
          <div className="hidden">
            {bookmarksEnabled && (
              <button
                onClick={() => openReaderPanel("bookmarks")}
                className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer"
              >
                Bookmarks
              </button>
            )}
            {notesDrawerEnabled && (
              <button
                onClick={() => openReaderPanel("highlightNotes")}
                className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer"
              >
                Highlights+Notes
              </button>
            )}
            {drawingsEnabled && (
              <button
                onClick={() => openReaderPanel("drawing")}
                className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-sky-300 dark:border-sky-700 bg-sky-50 dark:bg-sky-900/20 text-xs font-semibold text-sky-700 dark:text-sky-300 hover:bg-sky-100 dark:hover:bg-sky-900/30 transition-colors cursor-pointer"
              >
                Drawing Board
              </button>
            )}
            <button
              onClick={() => setShowResetDialog(true)}
              disabled={resetting}
              className="shrink-0 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-red-300 dark:border-red-700 bg-red-50/70 dark:bg-red-900/20 text-xs font-semibold text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {resetting ? (
                <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              )}
              Reset Data
            </button>
          </div>
        </div>
      </div>
      {!readerPanelMounted && (
      <div className="hidden lg:flex fixed right-0 top-1/2 -translate-y-1/2 z-40 flex-col items-end gap-1.5 transition-[margin-right] duration-200" style={readerContentShiftStyle}>
        <button
          onClick={() => setShowResetDialog(true)}
          disabled={resetting}
          className="flex flex-col items-center gap-1 bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 border-r-0 rounded-l-xl px-2 py-3 shadow-md text-red-600 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/35 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          title="Reset Course Data"
        >
          {resetting ? (
            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          )}
          <span className="text-[9px] font-semibold uppercase tracking-wide [writing-mode:vertical-rl] rotate-180">RESET</span>
        </button>
        {bookmarksEnabled && (
          <button
            onClick={() => openReaderPanel("bookmarks")}
            className="flex flex-col items-center gap-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 border-r-0 rounded-l-xl px-2 py-3 shadow-md text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
            title="Bookmarks"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 20 20" stroke="currentColor" strokeWidth={1.6}>
              <path d="M5 2a2 2 0 0 0-2 2v14l7-3 7 3V4a2 2 0 0 0-2-2H5Z" />
            </svg>
            <span className="text-[9px] font-semibold uppercase tracking-wide [writing-mode:vertical-rl] rotate-180">BOOK</span>
          </button>
        )}
        {notesDrawerEnabled && (
          <button
            onClick={() => openReaderPanel("highlightNotes")}
            className="flex flex-col items-center gap-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 border-r-0 rounded-l-xl px-2 py-3 shadow-md text-gray-500 hover:text-amber-600 dark:hover:text-amber-300 transition-colors cursor-pointer"
            title="Highlights+Notes"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M15 4H6a2 2 0 0 0-2 2v14l5-2 5 2V6a2 2 0 0 0-2-2Z" />
            </svg>
            <span className="text-[9px] font-semibold uppercase tracking-wide [writing-mode:vertical-rl] rotate-180">H&N</span>
          </button>
        )}
        {drawingsEnabled && (
          <button
            onClick={() => openReaderPanel("drawing")}
            className="flex flex-col items-center gap-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 border-r-0 rounded-l-xl px-2 py-3 shadow-md text-gray-500 hover:text-sky-600 dark:hover:text-sky-300 transition-colors cursor-pointer"
            title="Drawing Board"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M12 20h9" />
              <path d="m16.5 3.5 4 4L7 21H3v-4L16.5 3.5Z" />
            </svg>
            <span className="text-[9px] font-semibold uppercase tracking-wide [writing-mode:vertical-rl] rotate-180">DRAW</span>
          </button>
        )}
      </div>
      )}
      {!readerPanelMounted && (
        <div className="lg:hidden fixed right-3 bottom-4 z-40 flex flex-col items-end gap-2">
          <button
            onClick={() => setShowResetDialog(true)}
            disabled={resetting}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-full border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20 shadow-md text-xs font-semibold text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/35 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {resetting ? (
              <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            )}
            <span>Reset Data</span>
          </button>
          {bookmarksEnabled && (
            <button
              onClick={() => openReaderPanel("bookmarks")}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-md text-xs font-semibold text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 20 20" stroke="currentColor" strokeWidth={1.6}>
                <path d="M5 2a2 2 0 0 0-2 2v14l7-3 7 3V4a2 2 0 0 0-2-2H5Z" />
              </svg>
              <span>Bookmarks</span>
            </button>
          )}
          {notesDrawerEnabled && (
            <button
              onClick={() => openReaderPanel("highlightNotes")}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-md text-xs font-semibold text-gray-600 dark:text-gray-300 hover:text-amber-600 dark:hover:text-amber-300 transition-colors cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M15 4H6a2 2 0 0 0-2 2v14l5-2 5 2V6a2 2 0 0 0-2-2Z" />
              </svg>
              <span>H+N</span>
            </button>
          )}
          {drawingsEnabled && (
            <button
              onClick={() => openReaderPanel("drawing")}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-md text-xs font-semibold text-gray-600 dark:text-gray-300 hover:text-sky-700 dark:hover:text-sky-300 transition-colors cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M12 20h9" />
                <path d="m16.5 3.5 4 4L7 21H3v-4L16.5 3.5Z" />
              </svg>
              <span>Draw</span>
            </button>
          )}
        </div>
      )}
      <div className="max-w-5xl mx-auto px-6 py-8 transition-[margin-right] duration-200" style={readerContentShiftStyle}>
        <CourseDetailToc
          toc={course.toc}
          courseId={courseId}
          slug={course.slug}
          fromPath={fromPath}
          completedTopicIndices={completedTopicIndices}
          bookmarkedTopicIndices={bookmarksEnabled ? bookmarkedTopicIndices : new Set<number>()}
          lastVisitedTopicIndex={lastVisitedTopicIndex}
          searchEnabled={searchEnabled}
        />
      </div>

      {showResetDialog && (
        <div className="fixed inset-0 z-70 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => !resetting && setShowResetDialog(false)} />
          <div className="relative w-full max-w-xl rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-2xl">
            <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-gray-200 dark:border-gray-800">
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Reset Course Data</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Choose what to clear for this course.
                </p>
              </div>
              <button
                onClick={() => setShowResetDialog(false)}
                disabled={resetting}
                className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-45 cursor-pointer"
                aria-label="Close reset dialog"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-5 py-4 space-y-2">
              {RESET_SCOPE_OPTIONS.map((option) => (
                <label
                  key={option.key}
                  className="flex items-start gap-3 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-950/50 px-3 py-2.5 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={resetScopeSelection[option.key]}
                    onChange={() => {
                      setResetScopeSelection((prev) => ({
                        ...prev,
                        [option.key]: !prev[option.key],
                      }));
                    }}
                    className="mt-0.5 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>
                    <span className="block text-sm font-medium text-gray-900 dark:text-gray-100">{option.label}</span>
                    <span className="block text-xs text-gray-500 dark:text-gray-400">{option.description}</span>
                  </span>
                </label>
              ))}
            </div>
            <div className="px-5 py-4 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between gap-2">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {selectedResetScopeCount} item{selectedResetScopeCount === 1 ? "" : "s"} selected
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowResetDialog(false)}
                  disabled={resetting}
                  className="inline-flex items-center px-3 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-45 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleResetProgress}
                  disabled={resetting || selectedResetScopeCount === 0}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-red-400 dark:border-red-700 bg-red-50 dark:bg-red-900/30 text-xs font-semibold text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/40 disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer"
                >
                  {resetting && <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />}
                  Reset Selected
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {readerPanelMounted && (
        <div
          className={`fixed inset-x-0 bottom-0 z-50 transition-opacity duration-200 ${
            readerPanelVisible
              ? (readerPanelMode === "drawing" ? "pointer-events-none" : "pointer-events-auto")
              : "pointer-events-none"
          }`}
          style={{ top: "var(--ev-navbar-offset, 56px)" }}
        >
          <div
            className={`absolute inset-0 bg-black/40 transition-opacity duration-200 ${
              readerPanelVisible
                ? (readerPanelMode === "drawing" ? "opacity-0 pointer-events-none" : "opacity-100")
                : "opacity-0"
            }`}
            onClick={closeReaderPanel}
          />
          <div
            className="absolute top-0 bottom-0 right-0 bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 shadow-2xl flex flex-col will-change-[opacity] transition-opacity duration-220 ease-out pointer-events-auto"
            style={{
              width: `${readerPanelWidth}px`,
              opacity: readerPanelVisible ? 1 : 0,
            }}
          >
            {readerPanelMode === "bookmarks" && bookmarkDeleteDraft && bookmarkDeleteDraft.length > 0 && (
              <div className="absolute inset-0 z-70 flex items-center justify-center bg-black/60 px-4">
                <div
                  className="absolute inset-0"
                  onClick={() => !readerBusy && setBookmarkDeleteDraft(null)}
                />
                <div className="relative w-full max-w-md rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5 shadow-2xl">
                  <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Delete bookmarks?</h3>
                  <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                    This will remove {bookmarkDeleteDraft.length} selected bookmark{bookmarkDeleteDraft.length === 1 ? "" : "s"}{" "}
                    from this course.
                  </p>
                  <div className="mt-6 flex items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setBookmarkDeleteDraft(null)}
                      disabled={readerBusy}
                      className="inline-flex items-center rounded-md border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const pending = [...bookmarkDeleteDraft];
                        setBookmarkDeleteDraft(null);
                        void handleRemoveBookmarks(pending);
                      }}
                      disabled={readerBusy}
                      className="inline-flex items-center rounded-md border border-red-400 px-4 py-2 text-sm font-semibold text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-700 dark:text-red-300 dark:hover:bg-red-900/30 cursor-pointer"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            )}
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize drawer panel"
              onPointerDown={handleStartReaderResize}
              className="absolute left-0 top-0 h-full w-6 -translate-x-1/2 cursor-col-resize bg-transparent z-20 touch-none"
              title="Drag to resize drawer panel"
            >
              <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-10 w-10 rounded-full border border-gray-300/90 dark:border-gray-700/90 bg-white/95 dark:bg-gray-900/95 shadow-lg flex items-center justify-center">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-600 dark:text-gray-300">
                  <path d="M9 7 5 12l4 5" />
                  <path d="M15 7l4 5-4 5" />
                  <line x1="12" y1="6" x2="12" y2="18" />
                </svg>
              </div>
            </div>
            {readerPanelMode === "drawing" ? (
              <TopicDrawingPad
                topicTitle={course.title}
                initialScene={viewerCourseState.drawing_note?.scene ?? null}
                draftStorageKey={`ev:drawing-draft:v1:${courseId}`}
                saveBusy={courseDrawingSaveBusy}
                onSave={handleSaveCourseDrawing}
                onDelete={handleDeleteCourseDrawing}
                onClose={closeReaderPanel}
              />
            ) : (
              <>
                <div className="flex items-center justify-between gap-2 px-5 py-4 border-b border-gray-200 dark:border-gray-800">
                  <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider">
                    {readerPanelMode === "bookmarks" && "Bookmarks"}
                    {readerPanelMode === "highlightNotes" && "Highlights+Notes"}
                  </h2>
                  <div className="flex items-center gap-2">
                    {readerPanelMode === "bookmarks" && (
                      <>
                        <button
                          type="button"
                          onClick={() => void handleUndoBookmarkAction()}
                          disabled={readerBusy || bookmarkHistoryBusy || bookmarkUndoStack.length === 0}
                          aria-label="Undo bookmark action"
                          title="Undo"
                          className="inline-flex h-8 w-8 items-center justify-center rounded border border-gray-200 text-gray-600 transition-colors hover:border-indigo-300 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-45 dark:border-gray-700 dark:text-gray-300 dark:hover:border-indigo-700 dark:hover:text-indigo-300 cursor-pointer"
                        >
                          <Undo2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleRedoBookmarkAction()}
                          disabled={readerBusy || bookmarkHistoryBusy || bookmarkRedoStack.length === 0}
                          aria-label="Redo bookmark action"
                          title="Redo"
                          className="inline-flex h-8 w-8 items-center justify-center rounded border border-gray-200 text-gray-600 transition-colors hover:border-indigo-300 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-45 dark:border-gray-700 dark:text-gray-300 dark:hover:border-indigo-700 dark:hover:text-indigo-300 cursor-pointer"
                        >
                          <Redo2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (selectedBookmarkCount === 0) return;
                            setBookmarkDeleteDraft([...selectedBookmarkIndices]);
                          }}
                          disabled={readerBusy || selectedBookmarkCount === 0}
                          aria-label="Delete selected bookmarks"
                          title="Delete selected"
                          className="inline-flex h-8 items-center gap-1.5 rounded border border-red-300 bg-red-50 px-2.5 text-[11px] font-semibold text-red-600 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-45 dark:border-red-700 dark:bg-red-950 dark:text-red-400 dark:hover:bg-red-900/30 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          {bookmarkDeleteSelectionLabel && (
                            <span className="ml-0.5 rounded-sm bg-red-100 px-1.5 py-0.5 text-[10px] leading-none text-red-700 dark:bg-red-900/50 dark:text-red-200">
                              {bookmarkDeleteSelectionLabel}
                            </span>
                          )}
                        </button>
                      </>
                    )}
                    {readerPanelMode === "highlightNotes" && (
                      <>
                        <button
                          type="button"
                          onClick={() => void handleUndoNoteAction()}
                          disabled={readerBusy || noteHistoryBusy || noteUndoStack.length === 0}
                          aria-label="Undo note action"
                          title="Undo"
                          className="inline-flex h-8 w-8 items-center justify-center rounded border border-gray-200 text-gray-600 transition-colors hover:border-indigo-300 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-45 dark:border-gray-700 dark:text-gray-300 dark:hover:border-indigo-700 dark:hover:text-indigo-300 cursor-pointer"
                        >
                          <Undo2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleRedoNoteAction()}
                          disabled={readerBusy || noteHistoryBusy || noteRedoStack.length === 0}
                          aria-label="Redo note action"
                          title="Redo"
                          className="inline-flex h-8 w-8 items-center justify-center rounded border border-gray-200 text-gray-600 transition-colors hover:border-indigo-300 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-45 dark:border-gray-700 dark:text-gray-300 dark:hover:border-indigo-700 dark:hover:text-indigo-300 cursor-pointer"
                        >
                          <Redo2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </>
                    )}
                    <button
                      onClick={closeReaderPanel}
                      className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 cursor-pointer"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                  {readerPanelMode === "bookmarks" && (
                    <>
                      {[...bookmarkedTopicIndices].sort((a, b) => a - b).length === 0 ? (
                        <p className="text-sm text-gray-500 dark:text-gray-400">No bookmarks yet.</p>
                      ) : (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800/60">
                            <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-gray-500 dark:text-gray-400 select-none">
                              <input
                                type="checkbox"
                                checked={[...bookmarkedTopicIndices].length > 0 && selectedBookmarkIndices.size === bookmarkedTopicIndices.size}
                                onChange={() => {
                                  const allIndices = [...bookmarkedTopicIndices];
                                  if (selectedBookmarkIndices.size === allIndices.length) {
                                    setSelectedBookmarkIndices(new Set());
                                  } else {
                                    setSelectedBookmarkIndices(new Set(allIndices));
                                  }
                                }}
                                className="hidden"
                              />
                              <div className={`w-4 h-4 shrink-0 rounded flex items-center justify-center border transition-all duration-150 ${
                                [...bookmarkedTopicIndices].length > 0 && selectedBookmarkIndices.size === bookmarkedTopicIndices.size
                                  ? 'bg-indigo-600 border-indigo-600 dark:bg-indigo-500 dark:border-indigo-500 text-white shadow-sm'
                                  : 'bg-white dark:bg-gray-950 border-gray-300 dark:border-gray-700'
                              }`}>
                                {([...bookmarkedTopicIndices].length > 0 && selectedBookmarkIndices.size === bookmarkedTopicIndices.size) && (
                                  <svg className="w-2.5 h-2.5 stroke-current stroke-2" fill="none" viewBox="0 0 24 24">
                                    <polyline points="20 6 9 17 4 12" />
                                  </svg>
                                )}
                              </div>
                              <span>Select All</span>
                            </label>
                          </div>

                          <ul className="space-y-2">
                            {[...bookmarkedTopicIndices].sort((a, b) => a - b).map((topicIndex) => {
                              const topicMeta = topicMetaByIndex.get(topicIndex);
                              const href = topicMeta
                                ? buildTopicHref(courseId, routeSlug, topicIndex, topicMeta.slug, fromPath)
                                : "#";
                              const isChecked = selectedBookmarkIndices.has(topicIndex);
                              return (
                                <li key={topicIndex} className={`rounded-lg border px-3 py-3 transition-colors ${
                                  isChecked
                                    ? "border-indigo-300 dark:border-indigo-800 bg-indigo-50/20 dark:bg-indigo-950/10"
                                    : "border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-900/40"
                                }`}>
                                  <div className="flex items-center gap-3">
                                    <label className="flex items-center cursor-pointer select-none">
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => {
                                          setSelectedBookmarkIndices((prev) => {
                                            const next = new Set(prev);
                                            if (next.has(topicIndex)) {
                                              next.delete(topicIndex);
                                            } else {
                                              next.add(topicIndex);
                                            }
                                            return next;
                                          });
                                        }}
                                        className="hidden"
                                      />
                                      <div className={`w-4 h-4 shrink-0 rounded flex items-center justify-center border transition-all duration-150 ${
                                        isChecked
                                          ? 'bg-indigo-600 border-indigo-600 dark:bg-indigo-500 dark:border-indigo-500 text-white shadow-sm'
                                          : 'bg-white dark:bg-gray-950 border-gray-300 dark:border-gray-700'
                                      }`}>
                                        {isChecked && (
                                          <svg className="w-2.5 h-2.5 stroke-current stroke-2" fill="none" viewBox="0 0 24 24">
                                            <polyline points="20 6 9 17 4 12" />
                                          </svg>
                                        )}
                                      </div>
                                    </label>
                                    <div className="flex-1 min-w-0">
                                      <a href={href} className="group flex max-w-full items-baseline gap-2 text-sm font-medium leading-6 text-indigo-600 hover:underline dark:text-indigo-300">
                                        <span className="shrink-0 font-medium text-gray-500 dark:text-gray-400">
                                          {topicIndex + 1}
                                        </span>
                                        <span className="min-w-0 flex-1 wrap-break-word">
                                          {topicMeta?.title ?? `Topic ${topicIndex + 1}`}
                                        </span>
                                      </a>
                                    </div>
                                  </div>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      )}
                    </>
                  )}

                  {readerPanelMode === "highlightNotes" && (
                    <>
                      <section className="space-y-3 rounded-lg border border-sky-200 dark:border-sky-900 bg-sky-50/40 dark:bg-sky-950/20 p-3">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                            Course Notes
                          </p>
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => setCourseAddOpen((prev) => !prev)}
                              className="text-xs text-indigo-600 dark:text-indigo-300 hover:underline cursor-pointer"
                            >
                              Add Note
                            </button>
                            <button
                              onClick={() => void handleClearAllCourseNotes()}
                              disabled={readerBusy || noteHistoryBusy || courseNotes.length === 0}
                              className="inline-flex items-center px-2 py-1 text-[11px] rounded border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer"
                            >
                              Clear All
                            </button>
                          </div>
                        </div>
                        {courseAddOpen && (
                          <div className="space-y-2 rounded border border-gray-200 dark:border-gray-800 p-2">
                            <textarea
                              value={courseAddDraft}
                              onChange={(e) => setCourseAddDraft(e.target.value.slice(0, 1200))}
                              rows={3}
                              className="w-full rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1.5 text-xs text-gray-700 dark:text-gray-200 outline-none focus:ring-2 focus:ring-indigo-500/30"
                              placeholder="Type course note..."
                            />
                            <button
                              disabled={readerBusy || noteHistoryBusy || !courseAddDraft.trim()}
                              onClick={() => void handleAddCourseNote(courseAddDraft)}
                              className="inline-flex items-center px-2.5 py-1 text-xs rounded border border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                            >
                              Save
                            </button>
                          </div>
                        )}
                        {courseNotes.length === 0 ? (
                          <p className="text-sm text-gray-500 dark:text-gray-400">No standalone course notes yet.</p>
                        ) : (
                          <ul className="space-y-2">
                            {courseNotes.map((note: ViewerCourseNote) => {
                              const isEditing = !!courseNoteEditOpen[note.id];
                              const draft = courseNoteDrafts[note.id] ?? note.text;
                              return (
                                <li key={note.id} className="rounded border border-sky-200 dark:border-sky-900 bg-white/80 dark:bg-sky-950/30 px-2 py-1.5 space-y-1.5">
                                  {isEditing ? (
                                    <textarea
                                      value={draft}
                                      onChange={(e) => setCourseNoteDrafts((prev) => ({ ...prev, [note.id]: e.target.value.slice(0, 1200) }))}
                                      rows={3}
                                      className="w-full rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1.5 text-xs text-gray-700 dark:text-gray-200 outline-none focus:ring-2 focus:ring-indigo-500/30"
                                    />
                                  ) : (
                                    <p className="text-xs text-gray-700 dark:text-gray-200 whitespace-pre-wrap">{note.text}</p>
                                  )}
                                  <div className="flex items-center gap-2">
                                    {isEditing ? (
                                      <>
                                        <button
                                          disabled={readerBusy || noteHistoryBusy || !draft.trim()}
                                          onClick={() => void handleUpdateCourseNote(note.id, note.text, draft)}
                                          className="text-xs text-indigo-600 dark:text-indigo-300 hover:underline cursor-pointer disabled:opacity-50"
                                        >
                                          Save
                                        </button>
                                        <button
                                          disabled={readerBusy || noteHistoryBusy}
                                          onClick={() => setCourseNoteEditOpen((prev) => ({ ...prev, [note.id]: false }))}
                                          className="text-xs text-gray-500 dark:text-gray-400 hover:underline cursor-pointer disabled:opacity-50"
                                        >
                                          Cancel
                                        </button>
                                      </>
                                    ) : (
                                      <button
                                        onClick={() => {
                                          setCourseNoteDrafts((prev) => ({ ...prev, [note.id]: note.text }));
                                          setCourseNoteEditOpen((prev) => ({ ...prev, [note.id]: true }));
                                        }}
                                        className="text-xs text-indigo-600 dark:text-indigo-300 hover:underline cursor-pointer"
                                      >
                                        Edit
                                      </button>
                                    )}
                                    <button
                                      disabled={readerBusy || noteHistoryBusy}
                                      onClick={() => void handleRemoveCourseNote(note)}
                                      className="text-xs text-red-600 dark:text-red-400 hover:underline cursor-pointer disabled:opacity-50"
                                    >
                                      Remove
                                    </button>
                                  </div>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </section>

                      <section className="space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                            By Topic (Highlights + Notes)
                          </p>
                          <div className="flex items-center gap-2">
                            {notesEnabled && (
                              <button
                                onClick={() => void handleClearAllTopicNotes()}
                                disabled={readerBusy || noteHistoryBusy || topicNotesCount === 0}
                                className="inline-flex items-center px-2 py-1 text-[11px] rounded border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer"
                              >
                                Clear Notes
                              </button>
                            )}
                            {highlightsEnabled && (
                              <button
                                onClick={() => void handleClearAllHighlights()}
                                disabled={readerBusy || noteHistoryBusy || highlightsCount === 0}
                                className="inline-flex items-center px-2 py-1 text-[11px] rounded border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer"
                              >
                                Clear Highlights
                              </button>
                            )}
                          </div>
                        </div>
                        {groupedTopicEntries.length === 0 ? (
                          <p className="text-sm text-gray-500 dark:text-gray-400">No topic highlights or notes yet.</p>
                        ) : (
                          groupedTopicEntries.map(({ topicKey, topicIndex, notes, rows }) => {
                            const topicMeta = topicMetaByIndex.get(topicIndex);
                            const topicHref = topicMeta
                              ? buildTopicHref(courseId, routeSlug, topicIndex, topicMeta.slug, fromPath)
                              : null;
                            return (
                              <section key={topicKey} className="rounded-lg border border-gray-200 dark:border-gray-800 p-3 bg-white dark:bg-gray-900/50 space-y-2">
                                <div className="flex items-center justify-between">
                                  {topicHref ? (
                                    <a href={topicHref} className="text-xs font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-300 hover:underline">
                                      {topicMeta?.title ?? `Topic ${topicIndex + 1}`}
                                    </a>
                                  ) : (
                                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                      {topicMeta?.title ?? `Topic ${topicIndex + 1}`}
                                    </p>
                                  )}
                                  {notesEnabled && (
                                    <button
                                      onClick={() => setTopicAddOpenByTopic((prev) => ({ ...prev, [topicKey]: !prev[topicKey] }))}
                                      className="text-xs text-indigo-600 dark:text-indigo-300 hover:underline cursor-pointer"
                                    >
                                      {topicAddOpenByTopic[topicKey] ? "Cancel" : "Add Note"}
                                    </button>
                                  )}
                                </div>
                                {notesEnabled && topicAddOpenByTopic[topicKey] && (
                                  <div className="space-y-2">
                                    <textarea
                                      value={topicAddDraftByTopic[topicKey] ?? ""}
                                      onChange={(e) => setTopicAddDraftByTopic((prev) => ({ ...prev, [topicKey]: e.target.value.slice(0, 1200) }))}
                                      rows={3}
                                      placeholder="Type note..."
                                      className="w-full rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1.5 text-xs text-gray-700 dark:text-gray-200 outline-none focus:ring-2 focus:ring-indigo-500/30"
                                    />
                                    <button
                                      disabled={readerBusy || noteHistoryBusy || !(topicAddDraftByTopic[topicKey] ?? "").trim()}
                                      onClick={() => void handleAddTopicNote(topicKey, topicIndex, topicAddDraftByTopic[topicKey] ?? "")}
                                      className="inline-flex items-center px-2.5 py-1 text-xs rounded border border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                    >
                                      Save
                                    </button>
                                  </div>
                                )}
                                {notesEnabled && notes.length > 0 && (
                                  <div className="space-y-1.5">
                                    <p className="text-[11px] uppercase tracking-wide font-semibold text-gray-500 dark:text-gray-400">
                                      Notes
                                    </p>
                                    <ul className="space-y-1.5">
                                      {notes.map((note: ViewerTopicNote) => {
                                        const draftKey = `${topicKey}:${note.id}`;
                                        const isEditing = !!topicNoteEditOpen[draftKey];
                                        const draft = topicNoteDrafts[draftKey] ?? note.text;
                                        return (
                                          <li key={note.id} className="rounded border border-sky-200 dark:border-sky-900 bg-sky-50/50 dark:bg-sky-950/20 px-2 py-1.5 space-y-1.5">
                                            {isEditing ? (
                                              <textarea
                                                value={draft}
                                                onChange={(e) => setTopicNoteDrafts((prev) => ({ ...prev, [draftKey]: e.target.value.slice(0, 1200) }))}
                                                rows={3}
                                                className="w-full rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1.5 text-xs text-gray-700 dark:text-gray-200 outline-none focus:ring-2 focus:ring-indigo-500/30"
                                              />
                                            ) : (
                                              <p className="text-xs text-gray-700 dark:text-gray-200 whitespace-pre-wrap">{note.text}</p>
                                            )}
                                            <div className="flex items-center gap-2">
                                              {isEditing ? (
                                                <>
                                                  <button
                                                    disabled={readerBusy || noteHistoryBusy || !draft.trim()}
                                                    onClick={() => void handleUpdateTopicNote(topicIndex, note.id, note.text, draft, draftKey)}
                                                    className="text-xs text-indigo-600 dark:text-indigo-300 hover:underline cursor-pointer disabled:opacity-50"
                                                  >
                                                    Save
                                                  </button>
                                                  <button
                                                    disabled={readerBusy || noteHistoryBusy}
                                                    onClick={() => setTopicNoteEditOpen((prev) => ({ ...prev, [draftKey]: false }))}
                                                    className="text-xs text-gray-500 dark:text-gray-400 hover:underline cursor-pointer disabled:opacity-50"
                                                  >
                                                    Cancel
                                                  </button>
                                                </>
                                              ) : (
                                                <button
                                                  onClick={() => {
                                                    setTopicNoteDrafts((prev) => ({ ...prev, [draftKey]: note.text }));
                                                    setTopicNoteEditOpen((prev) => ({ ...prev, [draftKey]: true }));
                                                  }}
                                                  className="text-xs text-indigo-600 dark:text-indigo-300 hover:underline cursor-pointer"
                                                >
                                                  Edit
                                                </button>
                                              )}
                                              <button
                                                disabled={readerBusy || noteHistoryBusy}
                                                onClick={() => void handleRemoveTopicNote(topicIndex, note)}
                                                className="text-xs text-red-600 dark:text-red-400 hover:underline cursor-pointer disabled:opacity-50"
                                              >
                                                Remove
                                              </button>
                                            </div>
                                          </li>
                                        );
                                      })}
                                    </ul>
                                  </div>
                                )}

                                {highlightsEnabled && rows.length > 0 && (
                                  <div className="space-y-2">
                                    <p className="text-[11px] uppercase tracking-wide font-semibold text-gray-500 dark:text-gray-400">
                                      Highlights
                                    </p>
                                    <ul className="space-y-2">
                                      {rows.map((row: ViewerHighlight) => {
                                        const draftKey = `${topicKey}:${row.id}`;
                                        const isEditing = !!highlightNoteEditOpen[draftKey];
                                        const hasNote = Boolean((row.note ?? "").trim());
                                        const draft = highlightNoteDrafts[draftKey] ?? row.note ?? "";
                                        return (
                                          <li key={row.id} className="rounded border border-amber-300 dark:border-amber-800 bg-amber-50/80 dark:bg-amber-950/30 p-2 space-y-1.5">
                                            <div className="flex items-start justify-between gap-2">
                                              <p className="text-xs text-gray-800 dark:text-gray-100">{row.text}</p>
                                              <button
                                                disabled={readerBusy || noteHistoryBusy}
                                                onClick={() => void handleRemoveHighlight(topicIndex, row)}
                                                className="text-xs text-red-600 dark:text-red-400 hover:underline cursor-pointer disabled:opacity-50 shrink-0"
                                              >
                                                Delete
                                              </button>
                                            </div>
                                            {(hasNote || isEditing) && (
                                              <>
                                                {isEditing ? (
                                                  <div className="space-y-1">
                                                    <p className="text-[10px] uppercase tracking-wide font-semibold text-sky-700 dark:text-sky-300">
                                                      Note
                                                    </p>
                                                    <textarea
                                                      value={draft}
                                                      onChange={(e) => setHighlightNoteDrafts((prev) => ({ ...prev, [draftKey]: e.target.value.slice(0, 800) }))}
                                                      rows={3}
                                                      className="w-full rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1.5 text-xs text-gray-700 dark:text-gray-200 outline-none focus:ring-2 focus:ring-amber-500/30"
                                                    />
                                                  </div>
                                                ) : (
                                                  <div className="rounded-md border border-sky-200 dark:border-sky-900 bg-sky-50/80 dark:bg-sky-950/30 px-2 py-1.5">
                                                    <p className="mb-1 text-[10px] uppercase tracking-wide font-semibold text-sky-700 dark:text-sky-300">
                                                      Note
                                                    </p>
                                                    <p className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{row.note}</p>
                                                  </div>
                                                )}
                                              </>
                                            )}
                                            <div className="flex items-center gap-2">
                                              {isEditing ? (
                                                <>
                                                  <button
                                                    disabled={readerBusy || noteHistoryBusy}
                                                    onClick={() => void handleUpdateHighlightNote(topicIndex, row, draft, draftKey)}
                                                    className="text-xs text-indigo-600 dark:text-indigo-300 hover:underline cursor-pointer disabled:opacity-50"
                                                  >
                                                    Save
                                                  </button>
                                                  <button
                                                    disabled={readerBusy || noteHistoryBusy}
                                                    onClick={() => setHighlightNoteEditOpen((prev) => ({ ...prev, [draftKey]: false }))}
                                                    className="text-xs text-gray-500 dark:text-gray-400 hover:underline cursor-pointer disabled:opacity-50"
                                                  >
                                                    Cancel
                                                  </button>
                                                  <button
                                                    disabled={readerBusy || noteHistoryBusy}
                                                    onClick={() => void handleUpdateHighlightNote(topicIndex, row, "", draftKey)}
                                                    className="text-xs text-red-600 dark:text-red-400 hover:underline cursor-pointer disabled:opacity-50"
                                                  >
                                                    Delete Note
                                                  </button>
                                                </>
                                              ) : (
                                                <button
                                                  onClick={() => {
                                                    setHighlightNoteDrafts((prev) => ({ ...prev, [draftKey]: row.note ?? "" }));
                                                    setHighlightNoteEditOpen((prev) => ({ ...prev, [draftKey]: true }));
                                                  }}
                                                  className="text-xs text-indigo-600 dark:text-indigo-300 hover:underline cursor-pointer"
                                                >
                                                  {hasNote ? "Edit Note" : "Add Note"}
                                                </button>
                                              )}
                                            </div>
                                          </li>
                                        );
                                      })}
                                    </ul>
                                  </div>
                                )}

                                {notes.length === 0 && rows.length === 0 && (
                                  <p className="text-xs text-gray-500 dark:text-gray-400">No notes or highlights for this topic.</p>
                                )}
                              </section>
                            );
                          })
                        )}
                      </section>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
}


interface Topic {
  api_url: string;
  course_id: number;
  slug: string;
  title: string;
  topic_index: number;
}

interface Category {
  category: string;
  topics: Topic[];
}

type TocEntry = Category | Topic;

interface CourseDetail {
  id: number;
  slug: string;
  title: string;
  toc: TocEntry[];
  type: string;
}
