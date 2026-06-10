"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import TopicSidebar from "@/components/edu-viewer/TopicSidebar";
import AppNavbar from "@/components/edu-viewer/AppNavbar";
import UserMenu from "@/components/edu-viewer/UserMenu";
import { getRenderer, UnknownRenderer } from "@/utils/component-registry";
import ComponentBadge from "@/components/edu-viewer/ComponentBadge";
import CourseChatbot from "@/components/edu-viewer/CourseChatbot";
import ComponentErrorBoundary from "@/components/edu-viewer/ComponentErrorBoundary";
import { FontInjector } from "@/components/edu-viewer/FontManager";
import {
  recordTopicVisit,
  getAuthToken,
  clearAuthToken,
  updateViewerCourseSettings,
  type ViewerDrawingNote,
  type ViewerDrawingScene,
  type ViewerHighlight,
  type ViewerTopicNote,
} from "@/utils/authClient";
import { getBackendApiBase } from "@/utils/runtime-config";
import { readDrawingDrawerOpen, writeDrawingDrawerOpen } from "@/utils/drawingDrawerState";
import TopicDrawingPad from "@/components/edu-viewer/TopicDrawingPad";
import {
  Undo2,
  Redo2,
  Trash2,
  X,
  Plus,
  StickyNote,
  Star,
  Sparkles,
  Edit2,
  Compass,
  Eye,
  EyeOff,
} from "lucide-react";

const BACKEND = getBackendApiBase();

// ─── Heavy component types that benefit from deferred mounting ────────────────
// These involve Monaco, iframes, canvas, or large SVG libraries.
// Lightweight types (MarkdownEditor, SlateHTML, Latex, Code, Table...) render eagerly.
const HEAVY_COMPONENT_TYPES = new Set([
  "EditorCode",
  "CodeTest",
  "Sandpack",
  "WebpackBin",
  "Android",
  "RunJS",
  "CanvasAnimation",
  "Video",
  "DrawIOWidget",
  "MxGraphWidget",
  "Graphviz",
  "D2Diagram",
  "Mermaid",
  "MarkMap",
  "SequenceDiagrams",
  "UML",
  "WorkPreview",
  "CanvasAnimation",
  "ChartComponent",
  "Chart",
  "InstaCalc",
  "MatchTheAnswers",
  "Sketch",
]);

// ─── LazyComponent ────────────────────────────────────────────────────────────
// Renders a skeleton until the element is within 400px of the viewport,
// then mounts the real component and never unmounts it again.
function LazyComponent({ children, estimatedHeight = 300 }: { children: React.ReactNode; estimatedHeight?: number }) {
  const [mounted, setMounted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (mounted) return;
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setMounted(true);
          observer.disconnect();
        }
      },
      { rootMargin: "400px" } // start mounting 400px before entering viewport
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [mounted]);

  if (mounted) return <>{children}</>;

  return (
    <div
      ref={ref}
      style={{ minHeight: estimatedHeight }}
      className="rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse"
    />
  );
}

interface Component {
  type: string;
  content: Record<string, unknown>;
  index: number;
  width?: string;
}

interface TopicDetail {
  api_url: string;
  components: Component[];
  course_id: number;
  status: string;
  topic_index: number;
  topic_name: string;
  topic_slug: string;
  topic_url: string;
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

interface Props {
  courseId: number;
  slug: string;
  fromPath?: string | null;
  course: CourseDetail | null;
  topic: TopicDetail;
  /** topic_index values that the user has already completed */
  initialCompleted?: number[];
  initialBookmarked?: number[];
  initialHighlights?: Record<string, ViewerHighlight[]>;
  initialTopicNotes?: Record<string, ViewerTopicNote[]>;
  initialDrawingNote?: ViewerDrawingNote | null;
  initialHighlightColor?: HighlightColor;
  highlightsEnabled?: boolean;
  bookmarksEnabled?: boolean;
  notesEnabled?: boolean;
  drawingsEnabled?: boolean;
}

type HighlightColor = "yellow" | "blue" | "green" | "pink" | "orange";
type ViewerHistoryCommand =
  | { type: "add"; row: ViewerHighlight }
  | { type: "remove"; highlightId?: string; row?: ViewerHighlight }
  | { type: "add_note"; row: ViewerTopicNote }
  | { type: "remove_note"; noteId?: string; row?: ViewerTopicNote };

type ViewerHistoryEntry = {
  topicKey: string;
  topicIndex: number;
  undo: ViewerHistoryCommand[];
  redo: ViewerHistoryCommand[];
};
const DRAWER_ANIM_MS = 300;

const HIGHLIGHT_COLORS: ReadonlyArray<HighlightColor> = [
  "yellow",
  "blue",
  "green",
  "pink",
  "orange",
];

const HIGHLIGHT_MARK_CLASS: Record<HighlightColor, string> = {
  yellow: "bg-yellow-200/80 dark:bg-yellow-500/35",
  blue: "bg-blue-200/75 dark:bg-blue-500/35",
  green: "bg-emerald-200/75 dark:bg-emerald-500/35",
  pink: "bg-pink-200/75 dark:bg-pink-500/35",
  orange: "bg-orange-200/80 dark:bg-orange-500/35",
};

const HIGHLIGHT_SWATCH_CLASS: Record<HighlightColor, string> = {
  yellow: "bg-yellow-400",
  blue: "bg-blue-500",
  green: "bg-emerald-500",
  pink: "bg-pink-500",
  orange: "bg-orange-500",
};

const HIGHLIGHT_CARD_CLASS: Record<HighlightColor, string> = {
  yellow: "border-yellow-200/60 dark:border-yellow-500/25 bg-yellow-50/20 dark:bg-yellow-950/10",
  blue: "border-blue-200/60 dark:border-blue-500/25 bg-blue-50/20 dark:bg-blue-950/10",
  green: "border-emerald-200/60 dark:border-emerald-500/25 bg-emerald-50/20 dark:bg-emerald-950/10",
  pink: "border-pink-200/60 dark:border-pink-500/25 bg-pink-50/20 dark:bg-pink-950/10",
  orange: "border-orange-200/60 dark:border-orange-500/25 bg-orange-50/20 dark:bg-orange-950/10",
};

const HIGHLIGHT_CARD_TEXT_COLOR: Record<HighlightColor, string> = {
  yellow: "text-yellow-700 dark:text-yellow-400",
  blue: "text-blue-700 dark:text-blue-400",
  green: "text-emerald-700 dark:text-emerald-400",
  pink: "text-pink-700 dark:text-pink-400",
  orange: "text-orange-700 dark:text-orange-400",
};

function deferEffectState(callback: () => void): () => void {
  const frameId = window.requestAnimationFrame(callback);
  return () => window.cancelAnimationFrame(frameId);
}

function normalizeHighlightColor(color: unknown): HighlightColor {
  const normalized = String(color || "").trim().toLowerCase();
  if (normalized === "yellow" || normalized === "blue" || normalized === "green" || normalized === "pink" || normalized === "orange") {
    return normalized;
  }
  return "yellow";
}

function normalizeHighlightTextKey(text: unknown): string {
  return String(text || "").trim().replace(/\s+/g, " ").toLowerCase();
}

const TopicComponentsList = React.memo(function TopicComponentsList({
  currentComponents,
  topicIndex,
}: {
  currentComponents: Component[];
  topicIndex: number;
}) {
  return (
    <>
      {currentComponents.map((comp, i) => {
        const renderer = getRenderer(comp.type);
        const subType =
          typeof comp.content?.type === "string" ? comp.content.type : undefined;
        const componentLabel = `<${comp.type}-${i}>`;
        const isHeavy = HEAVY_COMPONENT_TYPES.has(comp.type);

        return (
          <div key={`${topicIndex}-${i}`} className="relative" data-topic-component-index={i}>
            <ComponentErrorBoundary label={componentLabel}>
              <div data-highlight-scope="1">
                {isHeavy ? (
                  <LazyComponent>
                    {renderer ? renderer(comp.content) : <UnknownRenderer type={comp.type} />}
                  </LazyComponent>
                ) : (
                  renderer ? renderer(comp.content) : <UnknownRenderer type={comp.type} />
                )}
              </div>
            </ComponentErrorBoundary>
            <div data-component-badge>
              <ComponentBadge componentName={componentLabel} subType={subType} />
            </div>
          </div>
        );
      })}
    </>
  );
});

export default function TopicLayoutClient({
  courseId,
  slug,
  fromPath,
  course,
  topic,
  initialCompleted = [],
  initialBookmarked = [],
  initialHighlights = {},
  initialTopicNotes = {},
  initialDrawingNote = null,
  initialHighlightColor = "yellow",
  highlightsEnabled = true,
  bookmarksEnabled = true,
  notesEnabled = true,
  drawingsEnabled = true,
}: Props) {
  const USER_HIGHLIGHT_ATTR = "data-user-highlight";
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [tocDrawerOpen, setTocDrawerOpen] = useState(false);
  const [highlightDrawerOpen, setHighlightDrawerOpen] = useState(false);
  const [showHighlightsOnText, setShowHighlightsOnText] = useState(true);
  const [drawingPadOpen, setDrawingPadOpen] = useState(false);
  const [tocDrawerMounted, setTocDrawerMounted] = useState(false);
  const [tocDrawerVisible, setTocDrawerVisible] = useState(false);
  const [highlightDrawerMounted, setHighlightDrawerMounted] = useState(false);
  const [highlightDrawerVisible, setHighlightDrawerVisible] = useState(false);
  const [highlightPanelWidth, setHighlightPanelWidth] = useState(() => {
    if (typeof window === "undefined") return 420;
    return Math.max(340, Math.floor(window.innerWidth * 0.3));
  });
  const [drawingPanelVisible, setDrawingPanelVisible] = useState(false);
  const [drawingPanelWidth, setDrawingPanelWidth] = useState(() => {
    if (typeof window === "undefined") return 560;
    return Math.max(360, Math.floor(window.innerWidth * 0.5));
  });
  const [desktopSidebarCollapsed, setDesktopSidebarCollapsed] = useState(false);
  const [headings, setHeadings] = useState<{ idx: number; text: string; level: number }[]>([]);
  const [activeHeadingIdx, setActiveHeadingIdx] = useState<number>(0);
  const contentRef = useRef<HTMLDivElement>(null);
  const drawingResizeStateRef = useRef<{ active: boolean; startX: number; startWidth: number }>({
    active: false,
    startX: 0,
    startWidth: 560,
  });
  const highlightResizeStateRef = useRef<{ active: boolean; startX: number; startWidth: number }>({
    active: false,
    startX: 0,
    startWidth: 640,
  });

  const [currentTopic, setCurrentTopic] = useState<TopicDetail>(topic);
  const [topicChanging, setTopicChanging] = useState(false);
  const [completed, setCompleted] = useState<Set<number>>(() => new Set(initialCompleted));
  const [bookmarked, setBookmarked] = useState<Set<number>>(() => new Set(initialBookmarked));
  const [highlightsByTopic, setHighlightsByTopic] = useState<Record<string, ViewerHighlight[]>>(
    () => initialHighlights
  );
  const [topicNotesByTopic, setTopicNotesByTopic] = useState<Record<string, ViewerTopicNote[]>>(
    () => initialTopicNotes
  );
  const [courseDrawingNote, setCourseDrawingNote] = useState<ViewerDrawingNote | null>(
    () => initialDrawingNote
  );
  const [drawingSaveBusy, setDrawingSaveBusy] = useState(false);
  const [selectedText, setSelectedText] = useState("");
  const [selectedColor, setSelectedColor] = useState<HighlightColor>(() => normalizeHighlightColor(initialHighlightColor));
  const [selectionColorPaletteOpen, setSelectionColorPaletteOpen] = useState(false);
  const [newHighlightNote, setNewHighlightNote] = useState("");
  const [newTopicNote, setNewTopicNote] = useState("");
  const [noteDraftById, setNoteDraftById] = useState<Record<string, string>>({});
  const [topicNoteComposerOpen, setTopicNoteComposerOpen] = useState(false);
  const [topicNoteEditOpenById, setTopicNoteEditOpenById] = useState<Record<string, boolean>>({});
  const [topicNoteEditDraftById, setTopicNoteEditDraftById] = useState<Record<string, string>>({});
  const [highlightNoteEditorOpenById, setHighlightNoteEditorOpenById] = useState<Record<string, boolean>>({});
  const [savingNoteById, setSavingNoteById] = useState<Record<string, boolean>>({});
  const [highlightUndoStack, setHighlightUndoStack] = useState<ViewerHistoryEntry[]>([]);
  const [highlightRedoStack, setHighlightRedoStack] = useState<ViewerHistoryEntry[]>([]);
  const [highlightHistoryBusy, setHighlightHistoryBusy] = useState(false);
  const [highlightMutationBusy, setHighlightMutationBusy] = useState(false);
  const selectedTextRef = useRef("");
  const selectedOffsetsRef = useRef<{ start: number; end: number; componentIndex: number } | null>(null);
  const selectedQuoteContextRef = useRef<{ prefix: string; suffix: string } | null>(null);
  const inFlightHighlightKeyRef = useRef<string | null>(null);
  const highlightMutationQueueRef = useRef<Promise<unknown>>(Promise.resolve());
  const pendingHighlightMutationsRef = useRef(0);
  const [selectionAction, setSelectionAction] = useState<{
    visible: boolean;
    x: number;
    y: number;
    placement: "above" | "below";
  }>({ visible: false, x: 0, y: 0, placement: "below" });
  const [isCompleted, setIsCompleted] = useState(() => new Set(initialCompleted).has(topic.topic_index));
  const progressFillRef = useRef<HTMLDivElement | null>(null);
  const scrollProgressRef = useRef(0);
  const navigatingRef = useRef(false);
  const completedRef = useRef<Set<number>>(new Set(initialCompleted));
  const validFromPath = fromPath && fromPath.startsWith("/") && !fromPath.startsWith("//") ? fromPath : null;
  const fromPathsPage = Boolean(validFromPath?.startsWith("/dashboard/paths"));
  const fromProjectsPage = Boolean(validFromPath?.startsWith("/dashboard/projects"));
  const fromCloudlabsPage = Boolean(validFromPath?.startsWith("/dashboard/cloudlabs"));
  const currentComponents = React.useMemo(
    () => (Array.isArray(currentTopic.components) ? currentTopic.components : []),
    [currentTopic.components]
  );
  const isBookmarked = bookmarked.has(currentTopic.topic_index);
  const currentTopicKey = String(currentTopic.topic_index);
  const currentTopicHighlights = React.useMemo(
    () => highlightsByTopic[currentTopicKey] ?? [],
    [currentTopicKey, highlightsByTopic]
  );
  const currentTopicNotes = React.useMemo(
    () => topicNotesByTopic[currentTopicKey] ?? [],
    [currentTopicKey, topicNotesByTopic]
  );
  const currentCourseDrawing = React.useMemo(
    () => courseDrawingNote,
    [courseDrawingNote]
  );
  const notesDrawerEnabled = highlightsEnabled || notesEnabled;
  const highlightsByTopicRef = useRef(highlightsByTopic);
  const topicNotesByTopicRef = useRef(topicNotesByTopic);

  const cloneHighlights = useCallback((rows: ViewerHighlight[]): ViewerHighlight[] => (
    rows.map((item) => ({ ...item }))
  ), []);
  const cloneTopicNotes = useCallback((rows: ViewerTopicNote[]): ViewerTopicNote[] => (
    rows.map((item) => ({ ...item }))
  ), []);
  useEffect(() => {
    highlightsByTopicRef.current = highlightsByTopic;
  }, [highlightsByTopic]);
  useEffect(() => {
    topicNotesByTopicRef.current = topicNotesByTopic;
  }, [topicNotesByTopic]);

  useEffect(() => {
    if (currentTopic?.topic_name) {
      document.title = `${currentTopic.topic_name} · Edu-Viewer PRO`;
    } else {
      document.title = "Topic · Edu-Viewer PRO";
    }
  }, [currentTopic?.topic_name]);

  const isSameHighlightAnchor = useCallback((a: ViewerHighlight, b: ViewerHighlight): boolean => {
    const aStart = typeof a.start_offset === "number" ? a.start_offset : null;
    const aEnd = typeof a.end_offset === "number" ? a.end_offset : null;
    const aComponent = typeof a.component_index === "number" ? a.component_index : null;
    const bStart = typeof b.start_offset === "number" ? b.start_offset : null;
    const bEnd = typeof b.end_offset === "number" ? b.end_offset : null;
    const bComponent = typeof b.component_index === "number" ? b.component_index : null;
    return (
      aStart !== null
      && aEnd !== null
      && aComponent !== null
      && bStart !== null
      && bEnd !== null
      && bComponent !== null
      && aStart === bStart
      && aEnd === bEnd
      && aComponent === bComponent
      && normalizeHighlightTextKey(a.text) === normalizeHighlightTextKey(b.text)
    );
  }, []);

  const resolveHighlightIdByRow = useCallback((topicKey: string, row: ViewerHighlight): string | null => {
    const rows = highlightsByTopicRef.current[topicKey] ?? [];
    const matched = rows.find((item) => isSameHighlightAnchor(item, row));
    return matched?.id ?? null;
  }, [isSameHighlightAnchor]);

  const resolveTopicNoteIdByRow = useCallback((topicKey: string, row: ViewerTopicNote): string | null => {
    const rows = topicNotesByTopicRef.current[topicKey] ?? [];
    const normalized = normalizeHighlightTextKey(row.text);
    const matched = rows.find((item) => (
      normalizeHighlightTextKey(item.text) === normalized
      || (item.created_at && row.created_at && item.created_at === row.created_at)
    ));
    return matched?.id ?? null;
  }, []);

  const pushHighlightHistory = useCallback((entry: ViewerHistoryEntry) => {
    setHighlightUndoStack((prev) => [...prev.slice(-24), entry]);
    setHighlightRedoStack([]);
  }, []);

  const enqueueHighlightMutation = useCallback(<T,>(task: () => Promise<T>): Promise<T> => {
    pendingHighlightMutationsRef.current += 1;
    setHighlightMutationBusy(true);
    const run = highlightMutationQueueRef.current.then(task, task);
    highlightMutationQueueRef.current = run.then(
      () => undefined,
      () => undefined,
    );
    run.finally(() => {
      pendingHighlightMutationsRef.current = Math.max(0, pendingHighlightMutationsRef.current - 1);
      if (pendingHighlightMutationsRef.current === 0) {
        setHighlightMutationBusy(false);
      }
    });
    return run;
  }, []);

  const applyViewerCourseState = useCallback((courseState: Awaited<ReturnType<typeof updateViewerCourseSettings>>) => {
    const highlights = courseState?.highlights;
    if (highlights && typeof highlights === "object") {
      setHighlightsByTopic(highlights);
    }
    const topicNotes = courseState?.topic_notes;
    if (topicNotes && typeof topicNotes === "object") {
      setTopicNotesByTopic(topicNotes);
    }
    const drawingNote = courseState?.drawing_note;
    if (drawingNote && typeof drawingNote === "object") {
      setCourseDrawingNote(drawingNote);
    }
  }, []);

  const runHistoryCommand = useCallback(async (
    topicIndex: number,
    topicKey: string,
    command: ViewerHistoryCommand,
  ) => {
    if (command.type === "remove_note") {
      let noteId = command.noteId;
      if (!noteId && command.row) {
        noteId = resolveTopicNoteIdByRow(topicKey, command.row) ?? undefined;
      }
      if (!noteId) return null;
      return enqueueHighlightMutation(() => updateViewerCourseSettings({
        course_id: courseId,
        remove_topic_note: {
          topic_index: topicIndex,
          note_id: noteId,
        },
      }));
    }
    if (command.type === "add_note") {
      const text = String(command.row.text || "").trim();
      if (!text) return null;
      return enqueueHighlightMutation(() => updateViewerCourseSettings({
        course_id: courseId,
        add_topic_note: {
          topic_index: topicIndex,
          text,
        },
      }));
    }
    if (command.type === "remove") {
      let highlightId = command.highlightId;
      if (!highlightId && command.row) {
        highlightId = resolveHighlightIdByRow(topicKey, command.row) ?? undefined;
      }
      if (!highlightId) return null;
      return enqueueHighlightMutation(() => updateViewerCourseSettings({
        course_id: courseId,
        remove_highlight: {
          topic_index: topicIndex,
          highlight_id: highlightId,
        },
      }));
    }
    const row = command.row;
    const startOffset = row.start_offset;
    const endOffset = row.end_offset;
    const componentIndex = row.component_index;
    if (
      typeof startOffset !== "number"
      || typeof endOffset !== "number"
      || endOffset <= startOffset
      || typeof componentIndex !== "number"
    ) {
      return null;
    }
    return enqueueHighlightMutation(() => updateViewerCourseSettings({
      course_id: courseId,
      add_highlight: {
        topic_index: topicIndex,
        text: String(row.text || "").slice(0, 280),
        color: normalizeHighlightColor(row.color),
        ...(row.note ? { note: String(row.note).slice(0, 800) } : {}),
        ...(row.quote_prefix ? { quote_prefix: String(row.quote_prefix).slice(0, 80) } : {}),
        ...(row.quote_suffix ? { quote_suffix: String(row.quote_suffix).slice(0, 80) } : {}),
        start_offset: startOffset,
        end_offset: endOffset,
        component_index: componentIndex,
      },
    }));
  }, [courseId, enqueueHighlightMutation, resolveHighlightIdByRow, resolveTopicNoteIdByRow]);

  const applyHistoryEntry = useCallback(async (
    entry: ViewerHistoryEntry,
    direction: "undo" | "redo",
  ): Promise<{ applied: boolean; entry: ViewerHistoryEntry }> => {
    const commands = direction === "undo" ? entry.undo : entry.redo;
    if (commands.length === 0) return { applied: false, entry };
    const nextEntry: ViewerHistoryEntry = {
      ...entry,
      undo: entry.undo.map((cmd) => ({ ...cmd })),
      redo: entry.redo.map((cmd) => ({ ...cmd })),
    };
    let lastCourseState: Awaited<ReturnType<typeof updateViewerCourseSettings>> = null;
    for (const command of commands) {
      // Single-action inverse calls only; no replay of unrelated highlights.
      lastCourseState = await runHistoryCommand(entry.topicIndex, entry.topicKey, command);
      if (command.type === "add") {
        const topicRows = lastCourseState?.highlights?.[entry.topicKey] ?? [];
        const resolved = topicRows.find((row) => (
          typeof row.start_offset === "number"
          && typeof row.end_offset === "number"
          && typeof row.component_index === "number"
          && typeof command.row.start_offset === "number"
          && typeof command.row.end_offset === "number"
          && typeof command.row.component_index === "number"
          && row.start_offset === command.row.start_offset
          && row.end_offset === command.row.end_offset
          && row.component_index === command.row.component_index
          && normalizeHighlightTextKey(row.text) === normalizeHighlightTextKey(command.row.text)
        ));
        const resolvedId = resolved?.id;
        if (!resolvedId) continue;
        if (direction === "undo") {
          nextEntry.redo = nextEntry.redo.map((cmd) => {
            if (cmd.type !== "remove" || !cmd.row) return cmd;
            return isSameHighlightAnchor(cmd.row, command.row)
              ? { ...cmd, highlightId: resolvedId }
              : cmd;
          });
        } else {
          nextEntry.undo = nextEntry.undo.map((cmd) => {
            if (cmd.type !== "remove" || !cmd.row) return cmd;
            return isSameHighlightAnchor(cmd.row, command.row)
              ? { ...cmd, highlightId: resolvedId }
              : cmd;
          });
        }
      }
      if (command.type === "add_note") {
        const topicRows = lastCourseState?.topic_notes?.[entry.topicKey] ?? [];
        const normalized = normalizeHighlightTextKey(command.row.text);
        const resolved = topicRows.find((row) => normalizeHighlightTextKey(row.text) === normalized);
        const resolvedId = resolved?.id;
        if (!resolvedId) continue;
        if (direction === "undo") {
          nextEntry.redo = nextEntry.redo.map((cmd) => (
            cmd.type === "remove_note" ? { ...cmd, noteId: resolvedId } : cmd
          ));
        } else {
          nextEntry.undo = nextEntry.undo.map((cmd) => (
            cmd.type === "remove_note" ? { ...cmd, noteId: resolvedId } : cmd
          ));
        }
      }
    }
    const highlights = lastCourseState?.highlights;
    const topicNotes = lastCourseState?.topic_notes;
    if (highlights && typeof highlights === "object") {
      setHighlightsByTopic(highlights);
    }
    if (topicNotes && typeof topicNotes === "object") {
      setTopicNotesByTopic(topicNotes);
    }
    const applied = Boolean(
      (highlights && typeof highlights === "object")
      || (topicNotes && typeof topicNotes === "object")
    );
    return { applied, entry: nextEntry };
  }, [isSameHighlightAnchor, runHistoryCommand]);

  const handleUndoHighlightChange = useCallback(async () => {
    if (highlightHistoryBusy || highlightMutationBusy) return;
    const entry = highlightUndoStack[highlightUndoStack.length - 1];
    if (!entry || entry.topicKey !== currentTopicKey) return;
    setHighlightHistoryBusy(true);
    try {
      const result = await applyHistoryEntry(entry, "undo");
      if (!result.applied) return;
      setHighlightUndoStack((prev) => prev.slice(0, -1));
      setHighlightRedoStack((prev) => [...prev.slice(-24), result.entry]);
    } finally {
      setHighlightHistoryBusy(false);
    }
  }, [applyHistoryEntry, currentTopicKey, highlightHistoryBusy, highlightMutationBusy, highlightUndoStack]);

  const handleRedoHighlightChange = useCallback(async () => {
    if (highlightHistoryBusy || highlightMutationBusy) return;
    const entry = highlightRedoStack[highlightRedoStack.length - 1];
    if (!entry || entry.topicKey !== currentTopicKey) return;
    setHighlightHistoryBusy(true);
    try {
      const result = await applyHistoryEntry(entry, "redo");
      if (!result.applied) return;
      setHighlightRedoStack((prev) => prev.slice(0, -1));
      setHighlightUndoStack((prev) => [...prev.slice(-24), result.entry]);
    } finally {
      setHighlightHistoryBusy(false);
    }
  }, [applyHistoryEntry, currentTopicKey, highlightHistoryBusy, highlightMutationBusy, highlightRedoStack]);
  
  // Calculate estimated reading time
  const estimatedTime = React.useMemo(() => {
    let wordCount = 0;
    let interactiveCount = 0;
    currentComponents.forEach(c => {
      if (c.type === "SlateHTML" || c.type === "Markdown" || c.type === "MarkdownEditor") {
        const text = typeof c.content?.html === "string" ? c.content.html.replace(/<[^>]+>/g, '') : JSON.stringify(c.content || {});
        wordCount += text.split(/\s+/).length;
      }
      if (HEAVY_COMPONENT_TYPES.has(c.type)) interactiveCount++;
    });
    const wordsPerMinute = 200;
    const readingTime = Math.ceil(wordCount / wordsPerMinute);
    const interactiveTime = interactiveCount * 2; // ~2 mins per heavy component
    return Math.max(1, readingTime + interactiveTime);
  }, [currentComponents]);

  const sectionCrumb = fromPathsPage
    ? { label: "Paths", href: validFromPath ?? "/dashboard/paths" }
    : fromProjectsPage
      ? { label: "Projects", href: validFromPath ?? "/dashboard/projects" }
      : fromCloudlabsPage
        ? { label: "Cloudlabs", href: validFromPath ?? "/dashboard/cloudlabs" }
        : { label: "Courses", href: "/dashboard/courses" };
  const courseBaseHref = `/dashboard/courses/${courseId}/${slug}`;
  const courseHref = validFromPath
    ? `${courseBaseHref}?from=${encodeURIComponent(validFromPath)}`
    : courseBaseHref;

  useEffect(() => {
    // Ensure each topic opens from the top even when the browser tries to restore scroll.
    const rafA = window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "auto" }));
    const rafB = window.requestAnimationFrame(() => window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "auto" })));
    return () => {
      window.cancelAnimationFrame(rafA);
      window.cancelAnimationFrame(rafB);
    };
  }, [currentTopic.topic_index]);

  // Keep completedRef current (also updated synchronously below when mutating state)
  useEffect(() => { completedRef.current = completed; }, [completed]);
  useEffect(() => { selectedTextRef.current = selectedText; }, [selectedText]);
  useEffect(() => {
    return deferEffectState(() => {
      const next: Record<string, string> = {};
      currentTopicHighlights.forEach((item) => {
        if (item.id) next[item.id] = item.note ?? "";
      });
      setNoteDraftById(next);
    });
  }, [currentTopicHighlights, currentTopic.topic_index]);

  // Signal the global NavProgressBar for in-page topic fetches
  // Extract h1/h2/h3 headings from content — store index for reliable click-time lookup
  useEffect(() => {
    const extractHeadings = () => {
      const container = contentRef.current;
      if (!container) return;
      const els = Array.from(
        container.querySelectorAll("h1, h2, h3")
      ).filter((el) => !el.closest("[data-component-badge]"));
      if (els.length === 0) return;
      setHeadings(els.map((el, idx) => ({
        idx,
        text: el.textContent?.trim() || "",
        level: parseInt(el.tagName[1]),
      })));
    };
    const t1 = setTimeout(extractHeadings, 600);
    const t2 = setTimeout(extractHeadings, 2500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [currentTopic.topic_index]);

  // Track active heading on scroll using fresh DOM query
  useEffect(() => {
    const handleScroll = () => {
      const container = contentRef.current;
      if (!container || !headings.length) return;
      const els = Array.from(
        container.querySelectorAll("h1, h2, h3")
      ).filter((el) => !el.closest("[data-component-badge]"));
      const scrollY = window.scrollY + 130;
      let active = 0;
      els.forEach((el, i) => {
        const top = (el as HTMLElement).getBoundingClientRect().top + window.scrollY;
        if (scrollY >= top) active = i;
      });
      setActiveHeadingIdx(active);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [headings]);

  const topicChangingRef = useRef(false);
  useEffect(() => {
    if (topicChanging) {
      topicChangingRef.current = true;
      window.dispatchEvent(new Event("navprogress:start"));
    } else if (topicChangingRef.current) {
      topicChangingRef.current = false;
      window.dispatchEvent(new Event("navprogress:done"));
    }
  }, [topicChanging]);

  const allTopics = course
    ? (Array.isArray(course.toc) ? course.toc : []).flatMap((entry) =>
      "topics" in entry ? (Array.isArray(entry.topics) ? entry.topics : []) : [entry as Topic]
    )
    : [];
  const currentPos = allTopics.findIndex((t) => t.topic_index === currentTopic.topic_index);
  const prev = currentPos > 0 ? allTopics[currentPos - 1] : null;
  const next = currentPos < allTopics.length - 1 ? allTopics[currentPos + 1] : null;

  const buildTopicHref = useCallback((topicIndex: number, topicSlug: string) => {
    const base = `/dashboard/courses/${courseId}/${slug}/topics/${topicIndex}/${topicSlug}`;
    return validFromPath ? `${base}?from=${encodeURIComponent(validFromPath)}` : base;
  }, [courseId, slug, validFromPath]);

  // Extract topic context for the AI Chatbot
  const topicContext = typeof window !== "undefined"
    ? JSON.stringify(currentTopic.components, (key, value) => {
      // Omit huge binary/unhelpful keys if needed, but for now just raw content is fine
      if (key === "versions" || key === "images") return undefined;
      return value;
    }).substring(0, 50000) // limit to ~50k characters to be safe
    : "";

  // Mark this topic as visited on every topic change (best-effort, don't block UI)
  // (Removed per user request: only mark complete on explicit interaction)

  // Fetch fresh progress so sidebar stays in sync after navigation
  // (Removed: progress is now strictly maintained locally in the state below to prevent 
  // race conditions where the server returns stale data right after we optimistically mark complete)

  const handleToggleComplete = useCallback(async () => {
    const next = !isCompleted;
    setIsCompleted(next);
    setCompleted((prev) => {
      const s = new Set(prev);
      if (next) s.add(currentTopic.topic_index); else s.delete(currentTopic.topic_index);
      completedRef.current = s;
      return s;
    });
    recordTopicVisit(courseId, currentTopic.topic_index, next).catch(() => { });
  }, [isCompleted, courseId, currentTopic.topic_index]);

  const handleToggleBookmark = useCallback(() => {
    if (!bookmarksEnabled) return;
    const topicIndex = currentTopic.topic_index;
    const nextBookmarked = !bookmarked.has(topicIndex);
    setBookmarked((prev) => {
      const next = new Set(prev);
      if (nextBookmarked) next.add(topicIndex);
      else next.delete(topicIndex);
      return next;
    });
    updateViewerCourseSettings({
      course_id: courseId,
      bookmark_topic_index: topicIndex,
      bookmarked: nextBookmarked,
    }).catch(() => { });
  }, [bookmarked, bookmarksEnabled, courseId, currentTopic.topic_index]);

  const unwrapUserHighlights = useCallback((container: HTMLElement) => {
    const highlights = Array.from(
      container.querySelectorAll(`mark[${USER_HIGHLIGHT_ATTR}="1"]`)
    ) as HTMLElement[];
    highlights.forEach((mark) => {
      const parent = mark.parentNode;
      if (!parent) return;
      while (mark.firstChild) {
        parent.insertBefore(mark.firstChild, mark);
      }
      parent.removeChild(mark);
      parent.normalize();
    });
  }, [USER_HIGHLIGHT_ATTR]);

  const isSelectableTextNode = useCallback((node: Node): node is Text => {
    if (node.nodeType !== Node.TEXT_NODE) return false;
    const textNode = node as Text;
    const parentEl = textNode.parentElement;
    if (!parentEl) return false;
    if (parentEl.closest("[data-component-badge], script, style")) {
      return false;
    }
    if (parentEl.closest("[hidden], [aria-hidden='true']")) {
      return false;
    }
    const style = window.getComputedStyle(parentEl);
    if (style.display === "none" || style.visibility === "hidden") {
      return false;
    }
    return true;
  }, []);

  const isMarkableTextNode = useCallback((node: Node): node is Text => {
    if (!isSelectableTextNode(node)) return false;
    const textNode = node as Text;
    const value = textNode.nodeValue ?? "";
    if (!value.trim()) return false;
    const parentEl = textNode.parentElement;
    if (!parentEl) return false;
    if (parentEl.closest(`[${USER_HIGHLIGHT_ATTR}="1"]`)) {
      return false;
    }
    return true;
  }, [USER_HIGHLIGHT_ATTR, isSelectableTextNode]);

  const getSelectableTextNodes = useCallback((container: HTMLElement): Text[] => {
    const nodes: Text[] = [];
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        return isSelectableTextNode(node)
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_REJECT;
      },
    });
    let current = walker.nextNode();
    while (current) {
      nodes.push(current as Text);
      current = walker.nextNode();
    }
    return nodes;
  }, [isSelectableTextNode]);

  const wrapTextSegment = useCallback((
    textNode: Text,
    startOffset: number,
    endOffset: number,
    highlightId: string,
    color: HighlightColor,
  ) => {
    const text = textNode.nodeValue ?? "";
    const safeStart = Math.max(0, Math.min(startOffset, text.length));
    const safeEnd = Math.max(safeStart, Math.min(endOffset, text.length));
    if (safeEnd <= safeStart) return;
    const before = text.slice(0, safeStart);
    const middle = text.slice(safeStart, safeEnd);
    const after = text.slice(safeEnd);
    const parent = textNode.parentNode;
    if (!parent || !middle) return;

    const frag = document.createDocumentFragment();
    if (before) frag.appendChild(document.createTextNode(before));
    const mark = document.createElement("mark");
    mark.setAttribute(USER_HIGHLIGHT_ATTR, "1");
    mark.setAttribute("data-highlight-id", highlightId);
    mark.setAttribute("data-highlight-color", color);
    mark.className = `${HIGHLIGHT_MARK_CLASS[color]} text-inherit rounded px-0.5`;
    mark.textContent = middle;
    frag.appendChild(mark);
    if (after) frag.appendChild(document.createTextNode(after));
    parent.replaceChild(frag, textNode);
  }, [USER_HIGHLIGHT_ATTR]);

  const addMarkByOffsets = useCallback((
    container: HTMLElement,
    start: number,
    end: number,
    highlightId: string,
    color: HighlightColor,
  ) => {
    if (start < 0 || end <= start) return false;
    const nodes = getSelectableTextNodes(container);
    if (nodes.length === 0) return false;

    let traversed = 0;
    let applied = false;
    for (const node of nodes) {
      const len = node.nodeValue?.length ?? 0;
      const nodeStart = traversed;
      const nodeEnd = traversed + len;
      const overlapStart = Math.max(start, nodeStart);
      const overlapEnd = Math.min(end, nodeEnd);
      if (overlapEnd > overlapStart) {
        if (isMarkableTextNode(node)) {
          wrapTextSegment(node, overlapStart - nodeStart, overlapEnd - nodeStart, highlightId, color);
          applied = true;
        }
      }
      traversed = nodeEnd;
      if (traversed >= end) break;
    }
    return applied;
  }, [getSelectableTextNodes, isMarkableTextNode, wrapTextSegment]);

  const getComponentScopeByIndex = useCallback((componentIndex: number): HTMLElement | null => {
    const container = contentRef.current;
    if (!container) return null;
    const host = container.querySelector(`[data-topic-component-index='${componentIndex}']`) as HTMLElement | null;
    if (!host) return null;
    return (host.querySelector("[data-highlight-scope='1']") as HTMLElement | null) ?? host;
  }, []);

  const getRangeOffsetsWithinContainer = useCallback((container: HTMLElement, range: Range) => {
    if (range.collapsed) return null;
    if (!container.contains(range.startContainer) || !container.contains(range.endContainer)) {
      return null;
    }
    const textNodes = getSelectableTextNodes(container);
    if (textNodes.length === 0) return null;

    const nodeBaseOffsets = new Map<Text, number>();
    let traversed = 0;
    textNodes.forEach((node) => {
      nodeBaseOffsets.set(node, traversed);
      traversed += node.nodeValue?.length ?? 0;
    });

    const boundaryToOffset = (boundaryNode: Node, boundaryOffset: number) => {
      if (boundaryNode.nodeType === Node.TEXT_NODE) {
        const textNode = boundaryNode as Text;
        const base = nodeBaseOffsets.get(textNode);
        if (base !== undefined) {
          const len = textNode.nodeValue?.length ?? 0;
          const local = Math.max(0, Math.min(boundaryOffset, len));
          return base + local;
        }
      }

      try {
        const pointRange = document.createRange();
        pointRange.setStart(boundaryNode, boundaryOffset);
        pointRange.collapse(true);
        let count = 0;
        for (const node of textNodes) {
          const len = node.nodeValue?.length ?? 0;
          if (len <= 0) continue;
          const endRelation = pointRange.comparePoint(node, len);
          if (endRelation <= 0) {
            count += len;
            continue;
          }
          const startRelation = pointRange.comparePoint(node, 0);
          if (startRelation >= 0) {
            return count;
          }
          let lo = 0;
          let hi = len;
          while (lo < hi) {
            const mid = Math.floor((lo + hi + 1) / 2);
            const relMid = pointRange.comparePoint(node, mid);
            if (relMid <= 0) lo = mid;
            else hi = mid - 1;
          }
          return count + lo;
        }
        return count;
      } catch {
        return null;
      }
    };

    try {
      const start = boundaryToOffset(range.startContainer, range.startOffset);
      const end = boundaryToOffset(range.endContainer, range.endOffset);
      if (start === null || end === null) return null;
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
      return { start, end };
    } catch {
      return null;
    }
  }, [getSelectableTextNodes]);

  const getTextByOffsetsWithinContainer = useCallback((
    container: HTMLElement,
    start: number,
    end: number,
  ): string => {
    if (start < 0 || end <= start) return "";
    const nodes = getSelectableTextNodes(container);
    if (nodes.length === 0) return "";
    let traversed = 0;
    let out = "";
    for (const node of nodes) {
      const value = node.nodeValue ?? "";
      const len = value.length;
      const nodeStart = traversed;
      const nodeEnd = traversed + len;
      const overlapStart = Math.max(start, nodeStart);
      const overlapEnd = Math.min(end, nodeEnd);
      if (overlapEnd > overlapStart) {
        out += value.slice(overlapStart - nodeStart, overlapEnd - nodeStart);
      }
      traversed = nodeEnd;
      if (traversed >= end) break;
    }
    return out.trim();
  }, [getSelectableTextNodes]);

  const getQuoteContextByOffsets = useCallback((
    container: HTMLElement,
    start: number,
    end: number,
  ): { prefix: string; suffix: string } => {
    if (start < 0 || end <= start) return { prefix: "", suffix: "" };
    const nodes = getSelectableTextNodes(container);
    if (nodes.length === 0) return { prefix: "", suffix: "" };
    const fullText = nodes.map((node) => node.nodeValue ?? "").join("");
    const prefixWindow = 48;
    const suffixWindow = 48;
    return {
      prefix: fullText.slice(Math.max(0, start - prefixWindow), start),
      suffix: fullText.slice(end, Math.min(fullText.length, end + suffixWindow)),
    };
  }, [getSelectableTextNodes]);

  const findOffsetsByQuote = useCallback((
    container: HTMLElement,
    highlight: ViewerHighlight,
  ): { start: number; end: number } | null => {
    const exactRaw = String(highlight.text || "");
    const exact = exactRaw.trim();
    if (!exact) return null;
    const nodes = getSelectableTextNodes(container);
    if (nodes.length === 0) return null;
    const haystack = nodes.map((node) => node.nodeValue ?? "").join("");
    if (!haystack) return null;
    const prefix = String(highlight.quote_prefix || "");
    const suffix = String(highlight.quote_suffix || "");
    const hint = typeof highlight.start_offset === "number" ? highlight.start_offset : null;
    const candidates: number[] = [];

    let from = 0;
    while (from <= haystack.length) {
      const idx = haystack.indexOf(exact, from);
      if (idx < 0) break;
      candidates.push(idx);
      from = idx + 1;
    }
    if (candidates.length === 0) {
      const lowerHaystack = haystack.toLowerCase();
      const lowerExact = exact.toLowerCase();
      from = 0;
      while (from <= lowerHaystack.length) {
        const idx = lowerHaystack.indexOf(lowerExact, from);
        if (idx < 0) break;
        candidates.push(idx);
        from = idx + 1;
      }
    }
    if (candidates.length === 0) return null;

    let bestIdx: number | null = null;
    let bestScore = Number.NEGATIVE_INFINITY;
    const exactLen = exact.length;
    candidates.forEach((idx) => {
      let score = 0;
      if (prefix) {
        const start = Math.max(0, idx - prefix.length);
        const candidatePrefix = haystack.slice(start, idx);
        if (candidatePrefix === prefix) score += 6;
      }
      if (suffix) {
        const candidateSuffix = haystack.slice(idx + exactLen, idx + exactLen + suffix.length);
        if (candidateSuffix === suffix) score += 6;
      }
      if (hint !== null) {
        const distance = Math.abs(idx - hint);
        score += Math.max(0, 3 - Math.min(3, distance / 250));
      }
      if (score > bestScore) {
        bestScore = score;
        bestIdx = idx;
      }
    });

    if (bestIdx === null) return null;
    return { start: bestIdx, end: bestIdx + exactLen };
  }, [getSelectableTextNodes]);

  const applyHighlightByText = useCallback((
    container: HTMLElement,
    text: string,
    highlightId: string,
    color: HighlightColor,
  ) => {
    const target = text.trim();
    if (!target) return false;

    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        return isMarkableTextNode(node)
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_REJECT;
      },
    });

    let current: Node | null = walker.nextNode();
    while (current) {
      const node = current as Text;
      const original = node.nodeValue ?? "";
      const idx = original.indexOf(target);
      const insensitiveIdx = idx >= 0 ? idx : original.toLowerCase().indexOf(target.toLowerCase());
      const matchIdx = idx >= 0 ? idx : insensitiveIdx;
      if (matchIdx >= 0 && node.parentNode) {
        const end = matchIdx + target.length;
        const safeStart = Math.max(0, Math.min(matchIdx, original.length));
        const safeEnd = Math.max(safeStart, Math.min(end, original.length));
        wrapTextSegment(node, safeStart, safeEnd, highlightId, color);
        return true;
      }
      current = walker.nextNode();
    }
    return false;
  }, [isMarkableTextNode, wrapTextSegment]);

  const captureSelectionFromTopicContent = useCallback((): string => {
    if (!highlightsEnabled) return "";
    const rootContainer = contentRef.current;
    if (!rootContainer) {
      setSelectedText("");
      selectedOffsetsRef.current = null;
      selectedQuoteContextRef.current = null;
      setSelectionAction((prev) => ({ ...prev, visible: false }));
      setSelectionColorPaletteOpen(false);
      return "";
    }

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      setSelectedText("");
      selectedOffsetsRef.current = null;
      selectedQuoteContextRef.current = null;
      setSelectionAction((prev) => ({ ...prev, visible: false }));
      setSelectionColorPaletteOpen(false);
      return "";
    }

    const range = selection.getRangeAt(0);
    const startNodeForScope = (
      range.startContainer.nodeType === Node.TEXT_NODE
        ? range.startContainer.parentNode
        : range.startContainer
    ) as Node | null;
    const endNodeForScope = (
      range.endContainer.nodeType === Node.TEXT_NODE
        ? range.endContainer.parentNode
        : range.endContainer
    ) as Node | null;
    const isInsideTopicContent = Boolean(startNodeForScope && endNodeForScope)
      && rootContainer.contains(startNodeForScope)
      && rootContainer.contains(endNodeForScope);
    if (!isInsideTopicContent) {
      setSelectedText("");
      selectedOffsetsRef.current = null;
      selectedQuoteContextRef.current = null;
      setSelectionAction((prev) => ({ ...prev, visible: false }));
      setSelectionColorPaletteOpen(false);
      return "";
    }

    const text = selection.toString().trim().slice(0, 280);
    if (!text) {
      setSelectedText("");
      selectedOffsetsRef.current = null;
      selectedQuoteContextRef.current = null;
      setSelectionAction((prev) => ({ ...prev, visible: false }));
      setSelectionColorPaletteOpen(false);
      return "";
    }
    const globalOffsets = getRangeOffsetsWithinContainer(rootContainer, range);
    if (globalOffsets) {
      selectedOffsetsRef.current = { ...globalOffsets, componentIndex: -1 };
      selectedQuoteContextRef.current = getQuoteContextByOffsets(rootContainer, globalOffsets.start, globalOffsets.end);
    } else {
      selectedOffsetsRef.current = null;
      selectedQuoteContextRef.current = null;
    }
    if (!selectedOffsetsRef.current) {
      setSelectedText("");
      setSelectionAction((prev) => ({ ...prev, visible: false }));
      setSelectionColorPaletteOpen(false);
      return "";
    }
    setSelectedText(text);
    setSelectionColorPaletteOpen(false);
    const rect = range.getBoundingClientRect();
    const nextX = Math.min(window.innerWidth - 20, Math.max(20, rect.left + 12));
    const nextY = Math.max(72, rect.top - 12);
    setSelectionAction({
      visible: true,
      x: nextX,
      y: nextY,
      placement: "above",
    });
    return text;
  }, [getQuoteContextByOffsets, getRangeOffsetsWithinContainer, highlightsEnabled]);

  const handleAddHighlight = useCallback((overrideColor?: HighlightColor) => {
    if (!highlightsEnabled || highlightMutationBusy) return;
    const text = (selectedTextRef.current || captureSelectionFromTopicContent()).trim();
    if (!text) return;
    const topicKey = String(currentTopic.topic_index);
    const selectedOffsets = selectedOffsetsRef.current;
    if (!selectedOffsets) {
      setSelectedText("");
      setSelectionAction((prev) => ({ ...prev, visible: false }));
      setSelectionColorPaletteOpen(false);
      return;
    }
    const note = notesEnabled ? newHighlightNote.trim().slice(0, 800) : "";
    const color = normalizeHighlightColor(overrideColor ?? selectedColor);
    const existing = currentTopicHighlights;
    const overlaps: ViewerHighlight[] = [];
    let mergedStart = selectedOffsets.start;
    let mergedEnd = selectedOffsets.end;
    let mergedComponentIndex = selectedOffsets.componentIndex;

    const containsExisting = existing.some((item) => {
      const itemStart = typeof item.start_offset === "number" ? item.start_offset : null;
      const itemEnd = typeof item.end_offset === "number" ? item.end_offset : null;
      const itemComponentIndex = typeof item.component_index === "number" ? item.component_index : null;
      if (
        itemStart === null
        || itemEnd === null
        || itemComponentIndex === null
        || itemComponentIndex !== selectedOffsets.componentIndex
      ) {
        return false;
      }
      return itemStart <= selectedOffsets.start && itemEnd >= selectedOffsets.end;
    });
    if (containsExisting) {
      setSelectedText("");
      setNewHighlightNote("");
      selectedOffsetsRef.current = null;
      selectedQuoteContextRef.current = null;
      setSelectionColorPaletteOpen(false);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      setSelectionAction((prev) => ({ ...prev, visible: false }));
      return;
    }
    existing.forEach((item) => {
      const itemStart = typeof item.start_offset === "number" ? item.start_offset : null;
      const itemEnd = typeof item.end_offset === "number" ? item.end_offset : null;
      const itemComponentIndex = typeof item.component_index === "number" ? item.component_index : null;
      if (
        itemStart === null
        || itemEnd === null
        || itemComponentIndex === null
        || itemComponentIndex !== selectedOffsets.componentIndex
      ) {
        return;
      }
      const hasOverlap = itemStart < selectedOffsets.end && itemEnd > selectedOffsets.start;
      if (!hasOverlap) return;
      overlaps.push(item);
      mergedStart = Math.min(mergedStart, itemStart);
      mergedEnd = Math.max(mergedEnd, itemEnd);
      mergedComponentIndex = itemComponentIndex;
    });

    let mergedText = text;
    {
      const scope = (
        mergedComponentIndex === -1
          ? contentRef.current
          : getComponentScopeByIndex(mergedComponentIndex)
      );
      if (scope) {
        const textFromOffsets = getTextByOffsetsWithinContainer(scope, mergedStart, mergedEnd);
        if (textFromOffsets) {
          mergedText = textFromOffsets;
        }
      }
    }

    const normalizedText = normalizeHighlightTextKey(mergedText);
    const hasDuplicateAlready = existing.some((item) => {
      const itemStart = typeof item.start_offset === "number" ? item.start_offset : null;
      const itemEnd = typeof item.end_offset === "number" ? item.end_offset : null;
      const itemComponentIndex = typeof item.component_index === "number" ? item.component_index : null;
      if (itemStart === null || itemEnd === null || itemComponentIndex === null) {
        return false;
      }
      return itemStart === mergedStart && itemEnd === mergedEnd && itemComponentIndex === mergedComponentIndex;
    });
    if (hasDuplicateAlready) {
      setSelectedText("");
      setNewHighlightNote("");
      selectedOffsetsRef.current = null;
      selectedQuoteContextRef.current = null;
      setSelectionColorPaletteOpen(false);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      setSelectionAction((prev) => ({ ...prev, visible: false }));
      return;
    }

    const inFlightKey = [
      String(currentTopic.topic_index),
      String(mergedComponentIndex),
      String(mergedStart),
      String(mergedEnd),
      normalizedText,
      color,
    ].join("|");
    if (inFlightHighlightKeyRef.current === inFlightKey) {
      return;
    }
    inFlightHighlightKeyRef.current = inFlightKey;

    const optimisticId = `local-${Date.now()}`;
    const quoteContext = (() => {
      const scope = (
        mergedComponentIndex === -1
          ? contentRef.current
          : getComponentScopeByIndex(mergedComponentIndex)
      );
      if (!scope) return selectedQuoteContextRef.current ?? { prefix: "", suffix: "" };
      return getQuoteContextByOffsets(scope, mergedStart, mergedEnd);
    })();
    const optimistic: ViewerHighlight = {
      id: optimisticId,
      text: mergedText,
      note,
      color,
      start_offset: mergedStart,
      end_offset: mergedEnd,
      component_index: mergedComponentIndex,
      quote_prefix: quoteContext.prefix,
      quote_suffix: quoteContext.suffix,
    };
    const overlapIds = new Set(overlaps.map((item) => item.id));
    const nextTopicHighlights = existing
      .filter((item) => !overlapIds.has(item.id))
      .concat(optimistic);
    const beforeSnapshot = cloneHighlights(existing);
    const optimisticSnapshot = cloneHighlights(nextTopicHighlights);

    setHighlightsByTopic((prev) => ({ ...prev, [topicKey]: nextTopicHighlights }));
    setSelectedText("");
    setNewHighlightNote("");
    selectedOffsetsRef.current = null;
    selectedQuoteContextRef.current = null;
    setSelectionColorPaletteOpen(false);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    setSelectionAction((prev) => ({ ...prev, visible: false }));

    enqueueHighlightMutation(() => updateViewerCourseSettings({
      course_id: courseId,
      last_highlight_color: color,
      add_highlight: {
        topic_index: currentTopic.topic_index,
        text: mergedText,
        color,
        ...(quoteContext.prefix ? { quote_prefix: quoteContext.prefix } : {}),
        ...(quoteContext.suffix ? { quote_suffix: quoteContext.suffix } : {}),
        ...(note ? { note } : {}),
        start_offset: mergedStart,
        end_offset: mergedEnd,
        component_index: mergedComponentIndex,
      },
    })).then((courseState) => {
      const serverRows = ((courseState?.highlights?.[topicKey] ?? optimisticSnapshot) as ViewerHighlight[]);
      applyViewerCourseState(courseState);
      const beforeIds = new Set(beforeSnapshot.map((row) => row.id));
      const addedRows = serverRows.filter((row) => !beforeIds.has(row.id));
      if (addedRows.length === 1 && overlaps.length === 0) {
        const added = { ...addedRows[0] };
        pushHighlightHistory({
          topicKey,
          topicIndex: currentTopic.topic_index,
          undo: [{ type: "remove", highlightId: added.id, row: { ...added } }],
          redo: [{ type: "add", row: added }],
        });
      } else if (addedRows.length === 1 && overlaps.length > 0) {
        const merged = { ...addedRows[0] };
        const overlapSnapshots = overlaps.map((row) => ({ ...row }));
        const undoCommands: ViewerHistoryCommand[] = [
          { type: "remove", highlightId: merged.id, row: { ...merged } },
          ...overlapSnapshots.map((row): ViewerHistoryCommand => ({ type: "add", row })),
        ];
        const redoCommands: ViewerHistoryCommand[] = [
          ...overlapSnapshots.map((row): ViewerHistoryCommand => ({ type: "remove", highlightId: row.id, row })),
          { type: "add", row: merged },
        ];
        pushHighlightHistory({
          topicKey,
          topicIndex: currentTopic.topic_index,
          undo: undoCommands,
          redo: redoCommands,
        });
      }
    }).catch(() => {
      setHighlightsByTopic((prev) => ({ ...prev, [topicKey]: beforeSnapshot }));
    }).finally(() => {
      inFlightHighlightKeyRef.current = null;
    });
  }, [
    cloneHighlights,
    captureSelectionFromTopicContent,
    courseId,
    currentTopicHighlights,
    currentTopic.topic_index,
    getComponentScopeByIndex,
    getQuoteContextByOffsets,
    getTextByOffsetsWithinContainer,
    highlightsEnabled,
    notesEnabled,
    newHighlightNote,
    selectedColor,
    setSelectionColorPaletteOpen,
    pushHighlightHistory,
    enqueueHighlightMutation,
    highlightMutationBusy,
    applyViewerCourseState,
  ]);

  const handleRemoveHighlight = useCallback((highlightId: string) => {
    if (highlightMutationBusy) return;
    if (!window.confirm("Are you sure you want to delete this highlight?")) {
      return;
    }
    const topicKey = String(currentTopic.topic_index);
    const beforeRows = cloneHighlights(highlightsByTopic[topicKey] ?? []);
    setHighlightsByTopic((prev) => {
      const nextTopicHighlights = (prev[topicKey] ?? []).filter((item) => item.id !== highlightId);
      return { ...prev, [topicKey]: nextTopicHighlights };
    });
    enqueueHighlightMutation(() => updateViewerCourseSettings({
      course_id: courseId,
      remove_highlight: {
        topic_index: currentTopic.topic_index,
        highlight_id: highlightId,
      },
    })).then((courseState) => {
      applyViewerCourseState(courseState);
      const removedRow = beforeRows.find((item) => item.id === highlightId);
      if (removedRow) {
        pushHighlightHistory({
          topicKey,
          topicIndex: currentTopic.topic_index,
          undo: [{ type: "add", row: { ...removedRow } }],
          redo: [{ type: "remove", highlightId, row: { ...removedRow } }],
        });
      }
    }).catch(() => {
      setHighlightsByTopic((prev) => ({ ...prev, [topicKey]: beforeRows }));
    });
  }, [cloneHighlights, courseId, currentTopic.topic_index, highlightsByTopic, pushHighlightHistory, enqueueHighlightMutation, highlightMutationBusy, applyViewerCourseState]);

  const handleSaveHighlightNote = useCallback((highlightId: string) => {
    if (!notesEnabled || highlightMutationBusy) return;
    const note = (noteDraftById[highlightId] ?? "").slice(0, 800);
    setSavingNoteById((prev) => ({ ...prev, [highlightId]: true }));
    enqueueHighlightMutation(() => updateViewerCourseSettings({
      course_id: courseId,
      update_highlight_note: {
        topic_index: currentTopic.topic_index,
        highlight_id: highlightId,
        note,
      },
    })).then((courseState) => {
      applyViewerCourseState(courseState);
      setHighlightNoteEditorOpenById((prev) => ({ ...prev, [highlightId]: false }));
    }).catch(() => { }).finally(() => {
      setSavingNoteById((prev) => ({ ...prev, [highlightId]: false }));
    });
  }, [courseId, currentTopic.topic_index, noteDraftById, notesEnabled, enqueueHighlightMutation, highlightMutationBusy, applyViewerCourseState]);

  const persistLastHighlightColor = useCallback((color: HighlightColor) => {
    updateViewerCourseSettings({
      course_id: courseId,
      last_highlight_color: normalizeHighlightColor(color),
    }).catch(() => { });
  }, [courseId]);

  const handleSaveHighlightColor = useCallback((highlightId: string, color: HighlightColor) => {
    if (highlightMutationBusy) return;
    const topicKey = String(currentTopic.topic_index);
    const normalizedColor = normalizeHighlightColor(color);
    setSelectedColor(normalizedColor);
    setHighlightsByTopic((prev) => {
      const rows = prev[topicKey] ?? [];
      return {
        ...prev,
        [topicKey]: rows.map((item) => (
          item.id === highlightId ? { ...item, color: normalizedColor } : item
        )),
      };
    });
    enqueueHighlightMutation(() => updateViewerCourseSettings({
      course_id: courseId,
      last_highlight_color: normalizedColor,
      update_highlight_color: {
        topic_index: currentTopic.topic_index,
        highlight_id: highlightId,
        color: normalizedColor,
      },
    })).then((courseState) => {
      applyViewerCourseState(courseState);
    }).catch(() => { });
  }, [courseId, currentTopic.topic_index, enqueueHighlightMutation, highlightMutationBusy, applyViewerCourseState]);

  const handleSelectionColorPick = useCallback((color: HighlightColor) => {
    const normalizedColor = normalizeHighlightColor(color);
    setSelectedColor(normalizedColor);
    setSelectionColorPaletteOpen(false);
    persistLastHighlightColor(normalizedColor);
    handleAddHighlight(normalizedColor);
  }, [handleAddHighlight, persistLastHighlightColor]);

  const handleClearTopicData = useCallback(() => {
    if (highlightMutationBusy || highlightHistoryBusy) return;
    const topicKey = String(currentTopic.topic_index);
    const beforeRows = cloneHighlights(highlightsByTopic[topicKey] ?? []);
    const beforeNotes = cloneTopicNotes(topicNotesByTopic[topicKey] ?? []);
    const noteIds = beforeNotes.map((row) => row.id).filter(Boolean);
    if (beforeRows.length === 0 && noteIds.length === 0) return;
    if (!window.confirm("Are you sure you want to clear all highlights and notes for this topic?")) {
      return;
    }
    const prevUndo = [...highlightUndoStack];
    const prevRedo = [...highlightRedoStack];
    setHighlightsByTopic((prev) => {
      const next = { ...prev };
      delete next[topicKey];
      return next;
    });
    setTopicNotesByTopic((prev) => {
      const next = { ...prev };
      delete next[topicKey];
      return next;
    });
    const container = contentRef.current;
    if (container) {
      unwrapUserHighlights(container);
    }
    const run = async () => {
      let lastCourseState: Awaited<ReturnType<typeof updateViewerCourseSettings>> = null;
      if (beforeRows.length > 0) {
        lastCourseState = await enqueueHighlightMutation(() => updateViewerCourseSettings({
          course_id: courseId,
          clear_highlights_topic_index: currentTopic.topic_index,
        }));
      }
      for (const noteId of noteIds) {
        lastCourseState = await enqueueHighlightMutation(() => updateViewerCourseSettings({
          course_id: courseId,
          remove_topic_note: {
            topic_index: currentTopic.topic_index,
            note_id: noteId,
          },
        }));
      }
      applyViewerCourseState(lastCourseState);
      // Clear is a destructive bulk boundary: reset local undo/redo history for this topic.
      setHighlightUndoStack([]);
      setHighlightRedoStack([]);
    };
    run().catch(() => {
      setHighlightsByTopic((prev) => ({ ...prev, [topicKey]: beforeRows }));
      setTopicNotesByTopic((prev) => ({ ...prev, [topicKey]: beforeNotes }));
      setHighlightUndoStack(prevUndo);
      setHighlightRedoStack(prevRedo);
    });
  }, [
    applyViewerCourseState,
    cloneTopicNotes,
    cloneHighlights,
    courseId,
    currentTopic.topic_index,
    highlightsByTopic,
    topicNotesByTopic,
    unwrapUserHighlights,
    enqueueHighlightMutation,
    highlightMutationBusy,
    highlightHistoryBusy,
    highlightUndoStack,
    highlightRedoStack,
  ]);

  const handleAddTopicNote = useCallback(() => {
    if (!notesEnabled || highlightMutationBusy) return;
    const topicKey = String(currentTopic.topic_index);
    const text = newTopicNote.trim().slice(0, 1200);
    if (!text) return;
    const beforeRows = cloneTopicNotes(topicNotesByTopic[topicKey] ?? []);
    const normalized = normalizeHighlightTextKey(text);
    if (beforeRows.some((row) => normalizeHighlightTextKey(row.text) === normalized)) {
      setNewTopicNote("");
      setTopicNoteComposerOpen(false);
      return;
    }
    const optimistic: ViewerTopicNote = {
      id: `local-note-${Date.now()}`,
      text,
      created_at: new Date().toISOString(),
    };
    setTopicNotesByTopic((prev) => ({
      ...prev,
      [topicKey]: [...(prev[topicKey] ?? []), optimistic],
    }));
    setNewTopicNote("");
    setTopicNoteComposerOpen(false);
    enqueueHighlightMutation(() => updateViewerCourseSettings({
      course_id: courseId,
      add_topic_note: {
        topic_index: currentTopic.topic_index,
        text,
      },
    })).then((courseState) => {
      applyViewerCourseState(courseState);
      const rows = ((courseState?.topic_notes?.[topicKey] ?? []) as ViewerTopicNote[]);
      const added = rows.find((row) => normalizeHighlightTextKey(row.text) === normalized);
      if (!added) return;
      pushHighlightHistory({
        topicKey,
        topicIndex: currentTopic.topic_index,
        undo: [{ type: "remove_note", noteId: added.id, row: { ...added } }],
        redo: [{ type: "add_note", row: { ...added } }],
      });
    }).catch(() => {
      setTopicNotesByTopic((prev) => ({ ...prev, [topicKey]: beforeRows }));
    });
  }, [
    applyViewerCourseState,
    cloneTopicNotes,
    courseId,
    currentTopic.topic_index,
    enqueueHighlightMutation,
    highlightMutationBusy,
    newTopicNote,
    notesEnabled,
    pushHighlightHistory,
    topicNotesByTopic,
  ]);

  const handleRemoveTopicNote = useCallback((noteId: string) => {
    if (!notesEnabled || highlightMutationBusy) return;
    if (!window.confirm("Are you sure you want to delete this note?")) {
      return;
    }
    const topicKey = String(currentTopic.topic_index);
    const beforeRows = cloneTopicNotes(topicNotesByTopic[topicKey] ?? []);
    const removedRow = beforeRows.find((row) => row.id === noteId);
    setTopicNotesByTopic((prev) => ({
      ...prev,
      [topicKey]: (prev[topicKey] ?? []).filter((row) => row.id !== noteId),
    }));
    enqueueHighlightMutation(() => updateViewerCourseSettings({
      course_id: courseId,
      remove_topic_note: {
        topic_index: currentTopic.topic_index,
        note_id: noteId,
      },
    })).then((courseState) => {
      applyViewerCourseState(courseState);
      if (!removedRow) return;
      pushHighlightHistory({
        topicKey,
        topicIndex: currentTopic.topic_index,
        undo: [{ type: "add_note", row: { ...removedRow } }],
        redo: [{ type: "remove_note", noteId, row: { ...removedRow } }],
      });
    }).catch(() => {
      setTopicNotesByTopic((prev) => ({ ...prev, [topicKey]: beforeRows }));
    });
  }, [
    applyViewerCourseState,
    cloneTopicNotes,
    courseId,
    currentTopic.topic_index,
    enqueueHighlightMutation,
    highlightMutationBusy,
    notesEnabled,
    pushHighlightHistory,
    topicNotesByTopic,
  ]);

  const handleUpdateTopicNote = useCallback((noteId: string) => {
    if (!notesEnabled || highlightMutationBusy) return;
    const topicKey = String(currentTopic.topic_index);
    const draft = (topicNoteEditDraftById[noteId] ?? "").trim().slice(0, 1200);
    if (!draft) return;
    const beforeRows = cloneTopicNotes(topicNotesByTopic[topicKey] ?? []);
    const targetRow = beforeRows.find((row) => row.id === noteId);
    if (!targetRow) return;
    if (targetRow.text.trim() === draft.trim()) {
      setTopicNoteEditOpenById((prev) => ({ ...prev, [noteId]: false }));
      return;
    }
    setTopicNotesByTopic((prev) => ({
      ...prev,
      [topicKey]: (prev[topicKey] ?? []).map((row) => (
        row.id === noteId ? { ...row, text: draft } : row
      )),
    }));
    setTopicNoteEditOpenById((prev) => ({ ...prev, [noteId]: false }));
    enqueueHighlightMutation(() => updateViewerCourseSettings({
      course_id: courseId,
      update_topic_note: {
        topic_index: currentTopic.topic_index,
        note_id: noteId,
        text: draft,
      },
    })).then((courseState) => {
      applyViewerCourseState(courseState);
    }).catch(() => {
      setTopicNotesByTopic((prev) => ({ ...prev, [topicKey]: beforeRows }));
    });
  }, [
    applyViewerCourseState,
    cloneTopicNotes,
    courseId,
    currentTopic.topic_index,
    enqueueHighlightMutation,
    highlightMutationBusy,
    notesEnabled,
    topicNoteEditDraftById,
    topicNotesByTopic,
  ]);

  const handleJumpToHighlight = useCallback((item: ViewerHighlight) => {
    const container = contentRef.current;
    const highlightId = String(item.id || "").trim();
    const color = normalizeHighlightColor(item.color);
    if (!container || !highlightId) return;

    const findMark = () => {
      const marks = Array.from(
        container.querySelectorAll(`mark[${USER_HIGHLIGHT_ATTR}="1"]`)
      ) as HTMLElement[];
      return (
        marks.find(
          (mark) => String(mark.getAttribute("data-highlight-id") || "").trim() === highlightId
        ) ?? null
      );
    };

    let mark = findMark();
    if (!mark) {
      const componentIndex = typeof item.component_index === "number" ? item.component_index : null;
      const scopedContainer = (
        componentIndex !== null && Number.isFinite(componentIndex)
          ? getComponentScopeByIndex(componentIndex)
          : null
      );
      const targetContainer = scopedContainer ?? container;
      const start = item.start_offset;
      const end = item.end_offset;
      if (
        typeof start === "number"
        && Number.isFinite(start)
        && typeof end === "number"
        && Number.isFinite(end)
      ) {
        const appliedByOffset = addMarkByOffsets(targetContainer, start, end, highlightId, color);
        if (!appliedByOffset) {
          const anchored = findOffsetsByQuote(targetContainer, item);
          if (anchored) {
            addMarkByOffsets(targetContainer, anchored.start, anchored.end, highlightId, color);
          }
        }
      } else {
        const anchored = findOffsetsByQuote(targetContainer, item);
        if (anchored) {
          addMarkByOffsets(targetContainer, anchored.start, anchored.end, highlightId, color);
        } else {
          applyHighlightByText(targetContainer, item.text, highlightId, color);
        }
      }
      mark = findMark();
    }
    if (!mark) return;

    mark.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    mark.classList.add("ring-2", "ring-indigo-400", "ring-offset-1", "ring-offset-white", "dark:ring-offset-gray-900");
    window.setTimeout(() => {
      mark?.classList.remove("ring-2", "ring-indigo-400", "ring-offset-1", "ring-offset-white", "dark:ring-offset-gray-900");
    }, 1200);
  }, [USER_HIGHLIGHT_ATTR, addMarkByOffsets, applyHighlightByText, findOffsetsByQuote, getComponentScopeByIndex]);

  // In-page topic navigation: fetch new topic, update state + URL (no page remount)
  const handleTopicNav = useCallback(async (href: string, destIdx: number) => {
    if (navigatingRef.current) return;
    navigatingRef.current = true;
    setTopicChanging(true);
    window.history.pushState({}, "", href);
    window.scrollTo(0, 0);
    try {
      const token = getAuthToken();
      const res = await fetch(`${BACKEND}/api/topic-details`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ course_id: courseId, topic_index: destIdx }),
      });
      if (res.status === 401) {
        clearAuthToken();
        window.location.replace("/auth?reason=session_expired");
        return;
      }
      if (!res.ok) throw new Error("Failed to load topic");
      const data: TopicDetail = await res.json();
      setCurrentTopic(data);
      setIsCompleted(completedRef.current.has(data.topic_index));
    } catch {
      // On unrecoverable error fall back to a hard navigation
      window.location.href = href;
    } finally {
      setTopicChanging(false);
      navigatingRef.current = false;
    }
  }, [courseId]);

  // Keep in sync when user presses browser back/forward
  useEffect(() => {
    const onPop = () => {
      const m = window.location.pathname.match(/\/topics\/(\d+)\//);
      if (m) {
        const idx = Number(m[1]);
        if (idx !== currentTopic.topic_index) {
          handleTopicNav(`${window.location.pathname}${window.location.search}`, idx);
        }
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [currentTopic.topic_index, handleTopicNav]);

  useEffect(() => {
    const container = contentRef.current;
    if (!container) return;

    let rafId: number | null = null;
    let touchTimer: number | null = null;
    const scheduleCapture = () => {
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        captureSelectionFromTopicContent();
      });
    };

    const onCaptureSelection = () => {
      scheduleCapture();
    };
    const onTouchEndCapture = () => {
      scheduleCapture();
      if (touchTimer !== null) window.clearTimeout(touchTimer);
      touchTimer = window.setTimeout(() => {
        scheduleCapture();
      }, 90);
    };
    const onSelectionChange = () => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
      const range = sel.getRangeAt(0);
      const startNode = range.startContainer.nodeType === Node.TEXT_NODE ? range.startContainer.parentNode : range.startContainer;
      const endNode = range.endContainer.nodeType === Node.TEXT_NODE ? range.endContainer.parentNode : range.endContainer;
      if (!startNode || !endNode) return;
      if (!container.contains(startNode) || !container.contains(endNode)) return;
      scheduleCapture();
    };

    container.addEventListener("mouseup", onCaptureSelection);
    container.addEventListener("keyup", onCaptureSelection);
    container.addEventListener("touchend", onTouchEndCapture);
    document.addEventListener("selectionchange", onSelectionChange);
    return () => {
      container.removeEventListener("mouseup", onCaptureSelection);
      container.removeEventListener("keyup", onCaptureSelection);
      container.removeEventListener("touchend", onTouchEndCapture);
      document.removeEventListener("selectionchange", onSelectionChange);
      if (rafId !== null) window.cancelAnimationFrame(rafId);
      if (touchTimer !== null) window.clearTimeout(touchTimer);
    };
  }, [captureSelectionFromTopicContent, currentTopic.topic_index]);

  useEffect(() => {
    const onOutsidePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      const targetEl = target instanceof Element ? target : target.parentElement;
      if (targetEl?.closest("[data-highlight-action='1']")) return;
      if (targetEl?.closest("[data-highlight-palette='1']")) return;
      const container = contentRef.current;
      if (container && container.contains(target)) return;
      setSelectionAction((prev) => ({ ...prev, visible: false }));
      setSelectionColorPaletteOpen(false);
    };
    const onScroll = () => {
      setSelectionAction((prev) => ({ ...prev, visible: false }));
      setSelectionColorPaletteOpen(false);
    };
    document.addEventListener("mousedown", onOutsidePointerDown);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      document.removeEventListener("mousedown", onOutsidePointerDown);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  useEffect(() => {
    if (!drawingPadOpen) return;
    const body = document.body;
    const html = document.documentElement;
    const prevBodyOverscroll = body.style.overscrollBehavior;
    const prevHtmlOverscroll = html.style.overscrollBehavior;

    body.style.overscrollBehavior = "contain";
    html.style.overscrollBehavior = "contain";

    return () => {
      body.style.overscrollBehavior = prevBodyOverscroll;
      html.style.overscrollBehavior = prevHtmlOverscroll;
    };
  }, [drawingPadOpen]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!highlightsEnabled) return;
      const isAddHighlightShortcut =
        (event.ctrlKey || event.metaKey) &&
        event.shiftKey &&
        event.key.toLowerCase() === "h";
      if (!isAddHighlightShortcut) return;
      if (!selectedTextRef.current.trim()) return;
      event.preventDefault();
      handleAddHighlight();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleAddHighlight, highlightsEnabled]);

  useEffect(() => {
    const isTypingTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      if (target.isContentEditable) return true;
      const tag = target.tagName.toLowerCase();
      return tag === "input" || tag === "textarea" || tag === "select";
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (!highlightsEnabled) return;
      if (isTypingTarget(event.target)) return;
      const key = event.key.toLowerCase();
      const modifier = event.ctrlKey || event.metaKey;
      if (!modifier || event.altKey) return;

      const isUndo = key === "z" && !event.shiftKey;
      const isRedo = (key === "z" && event.shiftKey) || key === "y";
      if (!isUndo && !isRedo) return;

      event.preventDefault();
      if (isUndo) {
        handleUndoHighlightChange();
        return;
      }
      handleRedoHighlightChange();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleRedoHighlightChange, handleUndoHighlightChange, highlightsEnabled]);

  // ── Alt+Arrow: navigate between topics ──────────────────────────────────────
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.altKey) return;
      if (event.ctrlKey || event.metaKey || event.shiftKey) return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      if (event.key === "ArrowLeft" && prev) {
        event.preventDefault();
        handleTopicNav(buildTopicHref(prev.topic_index, prev.slug), prev.topic_index);
      } else if (event.key === "ArrowRight" && next) {
        event.preventDefault();
        handleTopicNav(buildTopicHref(next.topic_index, next.slug), next.topic_index);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [prev, next, handleTopicNav, buildTopicHref]);

  useEffect(() => {
    const container = contentRef.current;
    if (!container) return;

    const highlights = currentTopicHighlights;
    const highlightIds = new Set(
      highlights
        .map((item) => String(item.id || "").trim())
        .filter(Boolean)
    );
    const applyOne = (item: ViewerHighlight, idx: number) => {
      const id = (item.id && item.id.trim()) ? item.id : `generated-${idx}`;
      const color = normalizeHighlightColor(item.color);
      const componentIndex = item.component_index;
      const scopedContainer = (
        typeof componentIndex === "number" && Number.isFinite(componentIndex)
          ? getComponentScopeByIndex(componentIndex)
          : null
      );
      const highlightContainer = scopedContainer ?? container;
      const start = item.start_offset;
      const end = item.end_offset;
      if (
        typeof start === "number"
        && Number.isFinite(start)
        && typeof end === "number"
        && Number.isFinite(end)
      ) {
        const appliedByOffset = addMarkByOffsets(highlightContainer, start, end, id, color);
        if (appliedByOffset) return;
      }
      const anchored = findOffsetsByQuote(highlightContainer, item);
      if (anchored) {
        const appliedByQuote = addMarkByOffsets(highlightContainer, anchored.start, anchored.end, id, color);
        if (appliedByQuote) return;
      }
      applyHighlightByText(highlightContainer, item.text, id, color);
    };
    const removeStaleMarks = () => {
      const marks = Array.from(
        container.querySelectorAll(`mark[${USER_HIGHLIGHT_ATTR}="1"]`)
      ) as HTMLElement[];
      marks.forEach((mark) => {
        const id = String(mark.getAttribute("data-highlight-id") || "").trim();
        if (!id || highlightIds.has(id)) return;
        const parent = mark.parentNode;
        if (!parent) return;
        while (mark.firstChild) {
          parent.insertBefore(mark.firstChild, mark);
        }
        parent.removeChild(mark);
        parent.normalize();
      });
    };
    const applyMissingOnly = () => {
      mutingMutations = true;
      removeStaleMarks();
      highlights.forEach((item, idx) => {
        const id = (item.id && item.id.trim()) ? item.id : `generated-${idx}`;
        if (container.querySelector(`mark[${USER_HIGHLIGHT_ATTR}="1"][data-highlight-id="${id}"]`)) {
          return;
        }
        applyOne(item, idx);
      });
      mutingMutations = false;
    };
    const applyFull = () => {
      mutingMutations = true;
      unwrapUserHighlights(container);
      highlights.forEach((item, idx) => {
        applyOne(item, idx);
      });
      mutingMutations = false;
    };

    let rafId: number | null = null;
    let mutingMutations = false;
    const scheduleApplyMissing = () => {
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        applyMissingOnly();
      });
    };

    const observer = new MutationObserver(() => {
      if (mutingMutations) return;
      scheduleApplyMissing();
    });
    observer.observe(container, { childList: true, subtree: true, characterData: true });

    applyFull();
    return () => {
      observer.disconnect();
      if (rafId !== null) window.cancelAnimationFrame(rafId);
    };
  }, [
    addMarkByOffsets,
    applyHighlightByText,
    currentTopic.topic_index,
    currentTopicHighlights,
    findOffsetsByQuote,
    getComponentScopeByIndex,
    unwrapUserHighlights,
  ]);

  useEffect(() => {
    selectedOffsetsRef.current = null;
    selectedQuoteContextRef.current = null;
    return deferEffectState(() => {
      setSelectedText("");
      setNewHighlightNote("");
      setNewTopicNote("");
      setTopicNoteComposerOpen(false);
      setTopicNoteEditOpenById({});
      setTopicNoteEditDraftById({});
      setHighlightNoteEditorOpenById({});
      setNoteDraftById({});
      setSelectionAction((prev) => ({ ...prev, visible: false }));
      setSelectionColorPaletteOpen(false);
      setHighlightUndoStack([]);
      setHighlightRedoStack([]);
    });
  }, [currentTopic.topic_index]);

  const handleOpenDrawingPad = useCallback(() => {
    if (!drawingsEnabled) return;
    const max = Math.max(320, window.innerWidth - 24);
    const min = Math.min(360, max);
    const target = window.innerWidth * 0.5;
    setDrawingPanelWidth(Math.max(min, Math.min(target, max)));
    setDrawerOpen(false);
    setTocDrawerOpen(false);
    setHighlightDrawerOpen(false);
    setDesktopSidebarCollapsed(true);
    setDrawingPadOpen(true);
    writeDrawingDrawerOpen(courseId, true);
  }, [courseId, drawingsEnabled]);

  useEffect(() => {
    if (!drawingsEnabled || drawingPadOpen) return;
    if (typeof window === "undefined") return;
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const shouldRestoreDrawingPad = readDrawingDrawerOpen(courseId);
    if (!hash.get("addLibrary") && !shouldRestoreDrawingPad) return;
    return deferEffectState(handleOpenDrawingPad);
  }, [courseId, drawingsEnabled, drawingPadOpen, handleOpenDrawingPad]);

  const handleToggleHighlightDrawer = useCallback(() => {
    if (!notesDrawerEnabled) return;
    setDrawerOpen(false);
    setTocDrawerOpen(false);
    setDesktopSidebarCollapsed(true);
    if (drawingPadOpen) {
      setDrawingPanelVisible(false);
      window.setTimeout(() => {
        setDrawingPadOpen(false);
      }, DRAWER_ANIM_MS);
    }
    if (!highlightDrawerOpen) {
      const max = Math.max(320, window.innerWidth - 24);
      const min = Math.min(340, max);
      const target = window.innerWidth * 0.3;
      setHighlightPanelWidth(Math.max(min, Math.min(target, max)));
    }
    setHighlightDrawerOpen((prev) => !prev);
  }, [drawingPadOpen, highlightDrawerOpen, notesDrawerEnabled]);

  const handleCloseDrawingPad = useCallback(() => {
    setDrawingPanelVisible(false);
    window.setTimeout(() => {
      setDrawingPadOpen(false);
    }, DRAWER_ANIM_MS);
    setDrawerOpen(false);
    setTocDrawerOpen(false);
    setHighlightDrawerOpen(false);
    writeDrawingDrawerOpen(courseId, false);
  }, [courseId]);

  const handleSaveDrawingScene = useCallback(async (scene: ViewerDrawingScene) => {
    if (!drawingsEnabled) return;
    setDrawingSaveBusy(true);
    try {
      const courseState = await updateViewerCourseSettings({
        course_id: courseId,
        upsert_course_drawing_note: {
          scene,
        },
      }, { includeCourse: false });
      if (courseState?.drawing_note && typeof courseState.drawing_note === "object") {
        setCourseDrawingNote(courseState.drawing_note);
      } else {
        setCourseDrawingNote({
          scene,
          updated_at: new Date().toISOString(),
        });
      }
    } finally {
      setDrawingSaveBusy(false);
    }
  }, [courseId, drawingsEnabled]);

  const handleDeleteDrawingScene = useCallback(async () => {
    if (!drawingsEnabled) return;
    if (!window.confirm("Are you sure you want to delete this drawing scene?")) {
      return;
    }
    setDrawingSaveBusy(true);
    try {
      await updateViewerCourseSettings({
        course_id: courseId,
        remove_course_drawing_note: {},
      }, { includeCourse: false });
      setCourseDrawingNote(null);
    } finally {
      setDrawingSaveBusy(false);
    }
  }, [courseId, drawingsEnabled]);

  useEffect(() => {
    if (!drawingsEnabled && drawingPadOpen) {
      return deferEffectState(() => setDrawingPadOpen(false));
    }
    return undefined;
  }, [drawingsEnabled, drawingPadOpen]);

  useEffect(() => {
    writeDrawingDrawerOpen(courseId, drawingsEnabled && drawingPadOpen);
  }, [courseId, drawingsEnabled, drawingPadOpen]);

  useEffect(() => {
    let frameCancel: (() => void) | undefined;
    let timeoutId: number | undefined;
    if (tocDrawerOpen) {
      frameCancel = deferEffectState(() => {
        setTocDrawerMounted(true);
        setTocDrawerVisible(false);
        timeoutId = window.setTimeout(() => setTocDrawerVisible(true), 18);
      });
      return () => {
        frameCancel?.();
        if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      };
    }
    frameCancel = deferEffectState(() => {
      setTocDrawerVisible(false);
      timeoutId = window.setTimeout(() => setTocDrawerMounted(false), DRAWER_ANIM_MS);
    });
    return () => {
      frameCancel?.();
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    };
  }, [tocDrawerOpen]);

  useEffect(() => {
    let frameCancel: (() => void) | undefined;
    let timeoutId: number | undefined;
    if (highlightDrawerOpen) {
      frameCancel = deferEffectState(() => {
        setHighlightDrawerMounted(true);
        setHighlightDrawerVisible(false);
        timeoutId = window.setTimeout(() => setHighlightDrawerVisible(true), 18);
      });
      return () => {
        frameCancel?.();
        if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      };
    }
    frameCancel = deferEffectState(() => {
      setHighlightDrawerVisible(false);
      timeoutId = window.setTimeout(() => setHighlightDrawerMounted(false), DRAWER_ANIM_MS);
    });
    return () => {
      frameCancel?.();
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    };
  }, [highlightDrawerOpen]);

  useEffect(() => {
    let frameCancel: (() => void) | undefined;
    let timeoutId: number | undefined;
    if (drawingPadOpen) {
      frameCancel = deferEffectState(() => {
        setDrawingPanelVisible(false);
        timeoutId = window.setTimeout(() => setDrawingPanelVisible(true), 18);
      });
      return () => {
        frameCancel?.();
        if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      };
    }
    return deferEffectState(() => setDrawingPanelVisible(false));
  }, [drawingPadOpen]);

  const clampDrawingPanelWidth = useCallback((next: number) => {
    if (typeof window === "undefined") return 560;
    const max = Math.max(320, window.innerWidth - 24);
    const min = Math.min(360, max);
    return Math.max(min, Math.min(next, max));
  }, []);

  const clampHighlightPanelWidth = useCallback((next: number) => {
    if (typeof window === "undefined") return 420;
    const max = Math.max(320, window.innerWidth - 24);
    const min = Math.min(340, max);
    return Math.max(min, Math.min(next, max));
  }, []);

  useEffect(() => {
    if (!drawingPadOpen) return;
    const cancelClamp = deferEffectState(() => {
      setDrawingPanelWidth((prev) => clampDrawingPanelWidth(prev));
    });
    const onResize = () => {
      setDrawingPanelWidth((prev) => clampDrawingPanelWidth(prev));
    };
    window.addEventListener("resize", onResize);
    return () => {
      cancelClamp();
      window.removeEventListener("resize", onResize);
    };
  }, [clampDrawingPanelWidth, drawingPadOpen]);

  useEffect(() => {
    if (!highlightDrawerMounted) return;
    const cancelClamp = deferEffectState(() => {
      setHighlightPanelWidth((prev) => clampHighlightPanelWidth(prev));
    });
    const onResize = () => {
      setHighlightPanelWidth((prev) => clampHighlightPanelWidth(prev));
    };
    window.addEventListener("resize", onResize);
    return () => {
      cancelClamp();
      window.removeEventListener("resize", onResize);
    };
  }, [clampHighlightPanelWidth, highlightDrawerMounted]);

  useEffect(() => {
    const onPointerMove = (e: PointerEvent) => {
      const drawingState = drawingResizeStateRef.current;
      if (drawingState.active) {
        const delta = drawingState.startX - e.clientX;
        setDrawingPanelWidth(clampDrawingPanelWidth(drawingState.startWidth + delta));
      }
      const highlightState = highlightResizeStateRef.current;
      if (highlightState.active) {
        const delta = highlightState.startX - e.clientX;
        setHighlightPanelWidth(clampHighlightPanelWidth(highlightState.startWidth + delta));
      }
    };
    const onPointerUp = () => {
      drawingResizeStateRef.current.active = false;
      highlightResizeStateRef.current.active = false;
    };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [clampDrawingPanelWidth, clampHighlightPanelWidth]);

  const handleStartDrawingResize = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    drawingResizeStateRef.current = {
      active: true,
      startX: e.clientX,
      startWidth: drawingPanelWidth,
    };
  }, [drawingPanelWidth]);

  const handleStartHighlightResize = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    highlightResizeStateRef.current = {
      active: true,
      startX: e.clientX,
      startWidth: highlightPanelWidth,
    };
  }, [highlightPanelWidth]);

  const activeRightPanelWidth = drawingPadOpen
    ? drawingPanelWidth
    : (highlightDrawerOpen ? highlightPanelWidth : 0);
  const contentShiftStyle = activeRightPanelWidth > 0
    ? { marginRight: `${activeRightPanelWidth}px` }
    : undefined;
  const chatRightOffsetPx = Math.max(24, activeRightPanelWidth + 24);

  // Track reading progress bar.
  const updateScrollProgress = useCallback(() => {
    const root = document.documentElement;
    const winScroll = window.scrollY || root.scrollTop;
    const height = root.scrollHeight - window.innerHeight;
    const scrolled = height > 0 ? Math.min(100, Math.max(0, (winScroll / height) * 100)) : 0;
    if (Math.abs(scrollProgressRef.current - scrolled) < 0.05) return;
    scrollProgressRef.current = scrolled;
    const fill = progressFillRef.current;
    if (fill) {
      fill.style.transform = `scaleX(${scrolled / 100})`;
    }
  }, []);

  useEffect(() => {
    let rafId: number | null = null;

    const scheduleProgressUpdate = () => {
      if (rafId !== null) return; // already scheduled - skip
      rafId = requestAnimationFrame(() => {
        rafId = null;
        updateScrollProgress();
      });
    };
    window.addEventListener("scroll", scheduleProgressUpdate, { passive: true });
    window.addEventListener("resize", scheduleProgressUpdate, { passive: true });

    const root = document.documentElement;
    const body = document.body;
    const resizeObserver = typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(() => scheduleProgressUpdate())
      : null;
    if (resizeObserver) {
      resizeObserver.observe(root);
      if (body) resizeObserver.observe(body);
      if (contentRef.current) resizeObserver.observe(contentRef.current);
    }

    // Trigger once on mount to set initial progress bar width
    scheduleProgressUpdate();

    return () => {
      window.removeEventListener("scroll", scheduleProgressUpdate);
      window.removeEventListener("resize", scheduleProgressUpdate);
      resizeObserver?.disconnect();
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [updateScrollProgress]);

  useEffect(() => {
    const rafA = window.requestAnimationFrame(updateScrollProgress);
    const rafB = window.requestAnimationFrame(() => window.requestAnimationFrame(updateScrollProgress));
    return () => {
      window.cancelAnimationFrame(rafA);
      window.cancelAnimationFrame(rafB);
    };
  }, [updateScrollProgress, drawingPadOpen, highlightDrawerOpen, desktopSidebarCollapsed, currentTopic.topic_index]);
  // Keep TOC drawer dismissible via keyboard.
  useEffect(() => {
    if (!tocDrawerOpen && !highlightDrawerOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setTocDrawerOpen(false);
        setHighlightDrawerOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [highlightDrawerOpen, tocDrawerOpen]);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-950">

      {/* Full-width AppNavbar — consistent with the rest of the app */}
      <AppNavbar
        crumbs={[
          { label: "Dashboard", href: "/dashboard" },
          sectionCrumb,
          ...(course
            ? [{ label: course.title, href: courseHref }]
            : []),
          { label: currentTopic.topic_name },
        ]}
        backHref={courseHref}
        backLabel="Topics"
        mobileMenuTrigger={
          course ? (
            <button
              onClick={() => setDrawerOpen((o) => !o)}
              className="p-1.5 rounded-md text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
              aria-label="Toggle navigation"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          ) : undefined
        }
        actions={<UserMenu />}
      />

      {/* Reading Progress Indicator */}
      <div
        className="sticky left-0 right-0 z-[65] h-1 bg-gray-200 dark:bg-gray-800 pointer-events-none"
        style={{ top: "var(--ev-navbar-offset, 56px)" }}
      >
        <div
          ref={progressFillRef}
          className="h-full w-full bg-emerald-500 transition-transform duration-75 ease-linear"
          style={{ transform: "scaleX(0)", transformOrigin: "left center", willChange: "transform" }}
        />
      </div>

      {/* Tablet drawer overlay — only on < lg, offset below navbar */}
      {drawerOpen && course && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-30 lg:hidden"
            onClick={() => setDrawerOpen(false)}
          />
          <div
            className="fixed left-0 z-40 lg:hidden shadow-2xl"
            style={{
              top: "var(--ev-navbar-offset, 56px)",
              height: "calc(100% - var(--ev-navbar-offset, 56px))",
            }}
          >
            <TopicSidebar
              courseId={courseId}
              courseSlug={slug}
              courseTitle={course.title}
              courseHref={courseHref}
              toc={course.toc}
              currentTopicIndex={currentTopic.topic_index}
              completedTopicIndices={completed}
              bookmarkedTopicIndices={bookmarked}
              fromPath={validFromPath}
              asideClassName="w-72 shrink-0 flex flex-col h-full"
              onClose={() => setDrawerOpen(false)}
              onTopicClick={(href, destIdx) => { setDrawerOpen(false); handleTopicNav(href, destIdx); }}
            />
          </div>
        </>
      )}

      {/* Sidebar + Main */}
      <div className="flex flex-1">

        {/* Desktop sidebar — sticky below navbar */}
        {course && (
          <TopicSidebar
            courseId={courseId}
            courseSlug={slug}
            courseTitle={course.title}
            courseHref={courseHref}
            toc={course.toc}
            currentTopicIndex={currentTopic.topic_index}
            completedTopicIndices={completed}
            bookmarkedTopicIndices={bookmarked}
            fromPath={validFromPath}
            isCollapsed={desktopSidebarCollapsed}
            onToggleCollapsed={() => setDesktopSidebarCollapsed((prev) => !prev)}
            onTopicClick={(href, destIdx) => handleTopicNav(href, destIdx)}
          />
        )}

        {/* Main content — natural page scroll */}
        <main
          className="flex-1 min-w-0 transition-[margin-right] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
          style={contentShiftStyle}
        >

          {/* Topic Header */}
          <div className="max-w-6xl mx-auto px-6 pt-8 pb-2">
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-gray-900 dark:text-gray-100 leading-tight">
              {currentTopic.topic_name}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 rounded-full text-[11px] uppercase tracking-wider font-semibold border border-gray-200 dark:border-gray-700 shadow-sm">
                <svg className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{estimatedTime} min read</span>
              </div>
              {bookmarksEnabled && (
                <button
                  onClick={handleToggleBookmark}
                  className={[
                    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] uppercase tracking-wider font-semibold border shadow-sm transition-colors cursor-pointer",
                    isBookmarked
                      ? "bg-amber-50 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300"
                      : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:text-amber-600 dark:hover:text-amber-300 hover:border-amber-300 dark:hover:border-amber-700",
                  ].join(" ")}
                >
                  <svg className="w-3.5 h-3.5" fill={isBookmarked ? "currentColor" : "none"} viewBox="0 0 20 20" stroke="currentColor" strokeWidth={1.6}>
                    <path d="M5 2a2 2 0 0 0-2 2v14l7-3 7 3V4a2 2 0 0 0-2-2H5Z" />
                  </svg>
                  <span>{isBookmarked ? "Bookmarked" : "Bookmark"}</span>
                </button>
              )}
            </div>
          </div>

          {/* Components */}
          <div ref={contentRef} className="max-w-6xl mx-auto px-6 pb-8 pt-4 space-y-6 topic-content-wrapper">
            <TopicComponentsList
              currentComponents={currentComponents}
              topicIndex={currentTopic.topic_index}
            />

            {!highlightsEnabled && (
              <section className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/40 p-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Highlights are disabled by administrator.
                </p>
              </section>
            )}
          </div>

          <FontInjector />

          {/* Mark complete + Prev / Next */}
          <div className="max-w-6xl mx-auto px-6 pb-10 space-y-4">
            {/* Mark complete checkbox */}
            <div className="flex justify-center">
              <button
                onClick={handleToggleComplete}
                className={[
                  "inline-flex items-center gap-2 px-5 py-2 rounded-full border text-sm font-medium transition-colors cursor-pointer",
                  isCompleted
                    ? "bg-emerald-50 dark:bg-emerald-900/30 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-400"
                    : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-emerald-400 hover:text-emerald-700 dark:hover:border-emerald-600 dark:hover:text-emerald-400",
                ].join(" ")}
              >
                {isCompleted ? (
                  <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <circle cx="12" cy="12" r="9" />
                  </svg>
                )}
                {isCompleted ? "Completed" : "Mark as complete"}
              </button>
            </div>

            {/* Prev / Next */}
            <div className="flex items-center justify-between gap-4">
              {prev ? (
                <button
                  onClick={() => {
                    if (!isCompleted) {
                      setIsCompleted(true);
                      setCompleted((s) => {
                        const n = new Set(s); n.add(currentTopic.topic_index);
                        completedRef.current = n;
                        return n;
                      });
                      recordTopicVisit(courseId, currentTopic.topic_index, true).catch(() => { });
                    }
                    handleTopicNav(buildTopicHref(prev.topic_index, prev.slug), prev.topic_index);
                  }}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-700 dark:text-gray-300 hover:border-indigo-400 dark:hover:border-indigo-600 hover:text-indigo-700 dark:hover:text-indigo-400 transition-colors max-w-xs cursor-pointer"
                >
                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                  <span className="truncate">{prev.title}</span>
                </button>
              ) : <div />}
              {next ? (
                <button
                  onClick={() => {
                    if (!isCompleted) {
                      setIsCompleted(true);
                      setCompleted((ps) => {
                        const s = new Set(ps); s.add(currentTopic.topic_index);
                        completedRef.current = s;
                        return s;
                      });
                      recordTopicVisit(courseId, currentTopic.topic_index, true).catch(() => { });
                    }
                    handleTopicNav(buildTopicHref(next.topic_index, next.slug), next.topic_index);
                  }}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-700 dark:text-gray-300 hover:border-indigo-400 dark:hover:border-indigo-600 hover:text-indigo-700 dark:hover:text-indigo-400 transition-colors max-w-xs cursor-pointer"
                >
                  <span className="truncate">{next.title}</span>
                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              ) : <div />}
            </div>
          </div>

        </main>
      </div>

      {/* Floating TOC Toggle Button */}
      <button
        onClick={() => setTocDrawerOpen(o => !o)}
        className="hidden lg:flex fixed right-0 top-1/2 -translate-y-1/2 z-40 flex-col items-center gap-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 border-r-0 rounded-l-xl px-2 py-3 shadow-md text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
        title="On this page"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h7" />
        </svg>
        <span className="text-[9px] font-semibold uppercase tracking-wide [writing-mode:vertical-rl] rotate-180">TOC</span>
      </button>

      {drawingsEnabled && (
        <>
          <button
            onClick={handleOpenDrawingPad}
            className={`hidden lg:flex fixed right-0 z-40 flex-col items-center gap-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 border-r-0 rounded-l-xl px-2 py-3 shadow-md text-gray-500 hover:text-sky-600 dark:hover:text-sky-300 transition-colors cursor-pointer ${
              notesDrawerEnabled ? "top-[calc(50%+8rem)]" : "top-[calc(50%+2.6rem)]"
            }`}
            title="Drawing Notes"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M12 20h9" />
              <path d="m16.5 3.5 4 4L7 21H3v-4L16.5 3.5Z" />
            </svg>
            <span className="text-[9px] font-semibold uppercase tracking-wide [writing-mode:vertical-rl] rotate-180">
              DRAW
            </span>
          </button>
          <button
            onClick={handleOpenDrawingPad}
            className="lg:hidden fixed bottom-5 right-4 z-40 inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-md text-gray-600 dark:text-gray-300 hover:text-sky-700 dark:hover:text-sky-300 transition-colors cursor-pointer"
            title="Drawing Notes"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M12 20h9" />
              <path d="m16.5 3.5 4 4L7 21H3v-4L16.5 3.5Z" />
            </svg>
            <span className="text-[11px] font-semibold uppercase tracking-wide">Draw</span>
          </button>
        </>
      )}

      {notesDrawerEnabled && (
        <button
          onClick={handleToggleHighlightDrawer}
          className="hidden lg:flex fixed right-0 top-[calc(50%+2.6rem)] z-40 flex-col items-center gap-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 border-r-0 rounded-l-xl px-2 py-3 shadow-md text-gray-500 hover:text-amber-600 dark:hover:text-amber-300 transition-colors cursor-pointer"
          title={highlightsEnabled ? "Highlights & Notes" : "Notes"}
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M15 4H6a2 2 0 0 0-2 2v14l5-2 5 2V6a2 2 0 0 0-2-2Z" />
          </svg>
          <span className="text-[9px] font-semibold uppercase tracking-wide [writing-mode:vertical-rl] rotate-180">
            {highlightsEnabled ? "H&N" : "NOTE"}
          </span>
        </button>
      )}

      {/* Slide-out TOC Drawer */}
      {tocDrawerMounted && (
        <div
          className={`fixed inset-x-0 bottom-0 z-40 transition-opacity duration-300 ${tocDrawerVisible ? "pointer-events-auto" : "pointer-events-none"}`}
          style={{ top: "var(--ev-navbar-offset, 56px)" }}
        >
          <div
            className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ${tocDrawerVisible ? "opacity-100" : "opacity-0"}`}
            onClick={() => setTocDrawerOpen(false)}
          />
          <div className={`absolute right-0 top-0 bottom-0 w-80 bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 shadow-2xl flex flex-col transform-gpu will-change-transform transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${tocDrawerVisible ? "translate-x-0" : "translate-x-full"}`}>
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200 dark:border-gray-800 shrink-0">
              <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider">On this page</h2>
              <button onClick={() => setTocDrawerOpen(false)} className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 cursor-pointer">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {bookmarksEnabled && (
                <div className="mb-5 flex flex-wrap items-center gap-2">
                  <button
                    onClick={handleToggleBookmark}
                    className={[
                      "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] uppercase tracking-wider font-semibold border shadow-sm transition-colors cursor-pointer",
                      isBookmarked
                        ? "bg-amber-50 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300"
                        : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:text-amber-600 dark:hover:text-amber-300 hover:border-amber-300 dark:hover:border-amber-700",
                    ].join(" ")}
                  >
                    <svg className="w-3.5 h-3.5" fill={isBookmarked ? "currentColor" : "none"} viewBox="0 0 20 20" stroke="currentColor" strokeWidth={1.6}>
                      <path d="M5 2a2 2 0 0 0-2 2v14l7-3 7 3V4a2 2 0 0 0-2-2H5Z" />
                    </svg>
                    <span>{isBookmarked ? "Bookmarked" : "Bookmark"}</span>
                  </button>
                </div>
              )}
              {headings.length === 0 ? (
                <p className="text-sm text-gray-500">No headings detected yet.</p>
              ) : (
                <ul className="space-y-3 text-[13px]">
                  {headings.map((h) => (
                    <li key={h.idx} style={{ paddingLeft: `${(h.level - 1) * 0.75}rem` }}>
                      <button
                        onClick={() => {
                          setTocDrawerOpen(false);
                          // Re-query heading at click time to get fresh position
                          requestAnimationFrame(() => {
                            const container = contentRef.current;
                            if (!container) return;
                            const els = Array.from(
                              container.querySelectorAll("h1, h2, h3")
                            ).filter((el) => !el.closest("[data-component-badge]"));
                            const el = els[h.idx] as HTMLElement | undefined;
                            if (el) {
                              const top = el.getBoundingClientRect().top + window.scrollY - 80;
                              window.scrollTo({ top, behavior: "smooth" });
                            }
                          });
                        }}
                        className={`text-left w-full py-0.5 transition-colors hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer ${
                          activeHeadingIdx === h.idx
                            ? "text-indigo-600 dark:text-indigo-400 font-semibold"
                            : "text-gray-600 dark:text-gray-400"
                        }`}
                      >
                        {h.text}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {notesDrawerEnabled && highlightDrawerMounted && (
        <div
          className={`fixed bottom-0 right-0 z-50 border-l border-gray-200/50 dark:border-white/5 bg-white/75 dark:bg-[#0c101b]/75 backdrop-blur-xl shadow-2xl will-change-transform transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] flex flex-col ${highlightDrawerVisible ? "pointer-events-auto translate-x-0 opacity-100" : "pointer-events-none translate-x-full opacity-0"}`}
          style={{
            top: "var(--ev-navbar-offset, 56px)",
            width: `${highlightPanelWidth}px`,
          }}
        >
          {/* Side Tab Handles protruding to the left */}
          <div className="absolute left-0 top-20 -translate-x-full flex flex-col border border-r-0 border-gray-200 dark:border-white/10 bg-white/95 dark:bg-[#0c101b]/95 rounded-l-2xl shadow-xl z-30 overflow-hidden divide-y divide-gray-150 dark:divide-white/5">
            {/* Collapse Tab */}
            <button
              type="button"
              onClick={() => setHighlightDrawerOpen(false)}
              className="w-10 h-10 flex items-center justify-center text-gray-400 dark:text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors cursor-pointer"
              title="Collapse panel"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
            
            {/* Eye/Toggle Highlights visibility button */}
            <button
              type="button"
              onClick={() => setShowHighlightsOnText(prev => !prev)}
              className={`w-10 h-10 flex items-center justify-center transition-all cursor-pointer ${
                showHighlightsOnText 
                  ? "text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/20" 
                  : "text-gray-400 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5"
              }`}
              title={showHighlightsOnText ? "Hide highlights in text" : "Show highlights in text"}
            >
              {showHighlightsOnText ? (
                <Eye className="w-5 h-5" />
              ) : (
                <EyeOff className="w-5 h-5" />
              )}
            </button>
          </div>

          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize notes and highlights panel"
            onPointerDown={handleStartHighlightResize}
            className="absolute left-0 top-0 h-full w-6 -translate-x-1/2 cursor-col-resize bg-transparent z-20 touch-none"
            title="Drag to resize notes and highlights panel"
          >
            <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-10 w-10 rounded-full border border-gray-300/90 dark:border-gray-700/90 bg-white/95 dark:bg-[#0c101b]/95 shadow-lg flex items-center justify-center">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="text-gray-600 dark:text-gray-300">
                <path d="M9 7 5 12l4 5" />
                <path d="M15 7l4 5-4 5" />
                <line x1="12" y1="6" x2="12" y2="18" />
              </svg>
            </div>
          </div>
          
          <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200/50 dark:border-white/5 shrink-0 bg-white/40 dark:bg-[#0c101b]/40 backdrop-blur-xs">
            <div className="flex items-center gap-2.5">
              <span className="w-1.5 h-5 rounded-full bg-indigo-500 dark:bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.6)]" />
              <h2 className="text-[13px] font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                Highlights & Notes
              </h2>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleUndoHighlightChange}
                disabled={highlightHistoryBusy || highlightMutationBusy || highlightUndoStack.length === 0}
                className="inline-flex items-center justify-center w-8 h-8 rounded-xl border border-gray-200 dark:border-white/10 text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-300 hover:bg-indigo-500/5 hover:border-indigo-300 dark:hover:border-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                title="Undo recent change"
                aria-label="Undo recent change"
              >
                <Undo2 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleRedoHighlightChange}
                disabled={highlightHistoryBusy || highlightMutationBusy || highlightRedoStack.length === 0}
                className="inline-flex items-center justify-center w-8 h-8 rounded-xl border border-gray-200 dark:border-white/10 text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-300 hover:bg-indigo-500/5 hover:border-indigo-300 dark:hover:border-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                title="Redo recent change"
                aria-label="Redo recent change"
              >
                <Redo2 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleClearTopicData}
                disabled={(currentTopicHighlights.length === 0 && currentTopicNotes.length === 0) || highlightHistoryBusy || highlightMutationBusy}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border border-gray-200 dark:border-white/10 text-gray-500 dark:text-gray-400 hover:text-red-600 hover:border-red-300 dark:hover:border-red-900/50 dark:hover:text-red-400 hover:bg-red-500/5 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear All</span>
              </button>
              <button 
                type="button"
                onClick={() => setHighlightDrawerOpen(false)} 
                className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-all cursor-pointer"
                aria-label="Close notes and highlights panel"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin">
              <style dangerouslySetInnerHTML={{__html: `
                ${!showHighlightsOnText ? `
                  mark[data-user-highlight="1"] {
                    background-color: transparent !important;
                    border-bottom: 2px dashed rgba(99, 102, 241, 0.55) !important;
                    color: inherit !important;
                  }
                  .dark mark[data-user-highlight="1"] {
                    border-bottom: 2px dashed rgba(129, 140, 248, 0.55) !important;
                  }
                ` : ''}
              `}} />

              {highlightsEnabled && selectedText && (
                <section className="rounded-2xl border border-indigo-200/60 dark:border-indigo-500/20 bg-indigo-50/30 dark:bg-indigo-950/20 p-4 shadow-xs">
                  <div className="flex items-center gap-2 mb-2.5">
                    <Sparkles className="w-4 h-4 text-indigo-500" />
                    <p className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-400">
                      {notesEnabled ? "Add Note To Selection" : "Current Selection"}
                    </p>
                  </div>
                  <p className="text-xs text-gray-700 dark:text-gray-300 italic bg-white/40 dark:bg-gray-900/40 p-2.5 rounded-xl border border-gray-200/50 dark:border-white/5 line-clamp-3 mb-3 leading-relaxed">
                    "${selectedText}"
                  </p>
                  {notesEnabled && (
                    <textarea
                      value={newHighlightNote}
                      onChange={(e) => setNewHighlightNote(e.target.value.slice(0, 800))}
                      rows={2}
                      placeholder="Add an optional note to attach to this highlight..."
                      className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-gray-900/60 px-3 py-2 text-xs text-gray-700 dark:text-gray-200 outline-none focus:ring-2 focus:ring-indigo-500/35 focus:border-indigo-500/50 transition-all resize-none"
                    />
                  )}
                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-gray-500 dark:text-gray-400">
                        Color
                      </span>
                      <div className="flex items-center gap-1.5">
                        {HIGHLIGHT_COLORS.map((color) => (
                          <button
                            key={`new-${color}`}
                            type="button"
                            onClick={() => {
                              setSelectedColor(color);
                              persistLastHighlightColor(color);
                            }}
                            className={[
                              "w-5 h-5 rounded-full border-2 transition-all cursor-pointer hover:scale-110 active:scale-90",
                              HIGHLIGHT_SWATCH_CLASS[color],
                              normalizeHighlightColor(selectedColor) === color
                                ? "border-indigo-650 dark:border-indigo-300 ring-2 ring-indigo-500/20"
                                : "border-white/80 dark:border-gray-900/80 shadow-xs",
                            ].join(" ")}
                            title={`Use ${color} highlight`}
                            aria-label={`Use ${color} highlight`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </section>
              )}

              {notesEnabled && (
                <section className="space-y-4">
                  {/* Notes Control Card */}
                  <div className="rounded-xl border border-gray-200/80 dark:border-white/5 bg-white/40 dark:bg-white/[0.02] p-4 shadow-xs hover:border-indigo-500/25 hover:shadow-md transition-all duration-300 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-indigo-500/10 dark:bg-indigo-500/10 flex items-center justify-center shrink-0 text-indigo-600 dark:text-indigo-400 border border-indigo-500/10">
                        <StickyNote className="w-4 h-4" />
                      </div>
                      <div className="space-y-0.5">
                        <h3 className="font-bold text-gray-900 dark:text-white text-xs uppercase tracking-wider">
                          Notes ({currentTopicNotes.length})
                        </h3>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-normal font-normal">
                          Add and manage your notes for this topic.
                        </p>
                      </div>
                    </div>
                    
                    {!topicNoteComposerOpen && (
                      <button
                        type="button"
                        onClick={() => setTopicNoteComposerOpen(true)}
                        className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-indigo-500/20 dark:border-indigo-500/30 text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 bg-indigo-500/5 hover:bg-indigo-500/10 transition-all font-bold text-[10px] uppercase tracking-wider active:scale-95 cursor-pointer shadow-xs shadow-indigo-500/5"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Add Note</span>
                      </button>
                    )}
                  </div>

                  {/* Composer for Topic Notes */}
                  {topicNoteComposerOpen && (
                    <div className="rounded-2xl border border-indigo-200/50 dark:border-indigo-900/30 bg-indigo-50/10 dark:bg-indigo-950/5 p-4 shadow-sm space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-600 dark:text-indigo-400">
                          Create New Note
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={handleAddTopicNote}
                            disabled={highlightMutationBusy || !newTopicNote.trim()}
                            className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                          >
                            Save Note
                          </button>
                          <span className="text-gray-400 dark:text-gray-500">|</span>
                          <button
                            type="button"
                            onClick={() => {
                              setNewTopicNote("");
                              setTopicNoteComposerOpen(false);
                            }}
                            className="text-xs font-medium text-gray-500 hover:underline cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                      <textarea
                        value={newTopicNote}
                        onChange={(e) => setNewTopicNote(e.target.value.slice(0, 1200))}
                        rows={3}
                        placeholder="Type your notes here..."
                        className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-gray-900 px-3.5 py-2.5 text-xs text-gray-800 dark:text-gray-100 outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50 transition-all resize-none"
                      />
                    </div>
                  )}

                  {/* List of Topic Notes */}
                  {currentTopicNotes.length > 0 && (
                    <ul className="space-y-3">
                      {currentTopicNotes.map((note) => {
                        const isEditing = Boolean(topicNoteEditOpenById[note.id]);
                        const draft = topicNoteEditDraftById[note.id] ?? note.text;
                        return (
                          <li
                            key={note.id}
                            className="rounded-2xl border border-gray-200/60 dark:border-white/5 bg-white/40 dark:bg-white/[0.01] p-4 shadow-xs hover:shadow-sm transition-all"
                          >
                            {isEditing ? (
                              <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-600 dark:text-indigo-400">
                                    Edit Note
                                  </span>
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateTopicNote(note.id)}
                                      disabled={highlightMutationBusy || !draft.trim()}
                                      className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer disabled:opacity-50"
                                    >
                                      Save
                                    </button>
                                    <span className="text-gray-400 dark:text-gray-500">|</span>
                                    <button
                                      type="button"
                                      onClick={() => setTopicNoteEditOpenById((prev) => ({ ...prev, [note.id]: false }))}
                                      className="text-xs font-medium text-gray-500 hover:underline cursor-pointer"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                                <textarea
                                  value={draft}
                                  onChange={(e) => setTopicNoteEditDraftById((prev) => ({ ...prev, [note.id]: e.target.value.slice(0, 1200) }))}
                                  rows={3}
                                  className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-gray-900 px-3.5 py-2.5 text-xs text-gray-800 dark:text-gray-100 outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50 transition-all resize-none"
                                />
                              </div>
                            ) : (
                              <div className="space-y-3">
                                <p className="text-xs text-gray-700 dark:text-gray-200 leading-relaxed whitespace-pre-wrap font-normal">
                                  {note.text}
                                </p>
                                <div className="flex items-center justify-between border-t border-gray-100 dark:border-white/5 pt-2.5 text-[10px] text-gray-400 dark:text-gray-500 font-medium">
                                  <span>
                                    {note.created_at ? new Date(note.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : "General Note"}
                                  </span>
                                  <div className="flex items-center gap-3">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setTopicNoteEditDraftById((prev) => ({ ...prev, [note.id]: note.text }));
                                        setTopicNoteEditOpenById((prev) => ({ ...prev, [note.id]: true }));
                                      }}
                                      className="inline-flex items-center gap-1 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
                                    >
                                      <Edit2 className="w-3 h-3" />
                                      <span>Edit</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveTopicNote(note.id)}
                                      disabled={highlightMutationBusy}
                                      className="inline-flex items-center gap-1 hover:text-red-500 dark:hover:text-red-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                      <span>Delete</span>
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>
              )}

              {/* Dotted line divider with center dot */}
              <div className="relative flex items-center py-2 shrink-0 select-none">
                <div className="flex-grow border-t border-dashed border-gray-200/80 dark:border-white/5" />
                <span className="flex-shrink-0 mx-4 w-2 h-2 rounded-full bg-indigo-500/80 dark:bg-indigo-400/80 animate-pulse" />
                <div className="flex-grow border-t border-dashed border-gray-200/80 dark:border-white/5" />
              </div>

              {highlightsEnabled && (
                <section className="space-y-4">
                  {/* Highlights Control Card */}
                  <div className="rounded-xl border border-gray-200/80 dark:border-white/5 bg-white/40 dark:bg-white/[0.02] p-4 shadow-xs hover:border-indigo-500/25 hover:shadow-md transition-all duration-300">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-indigo-500/10 dark:bg-indigo-500/10 flex items-center justify-center shrink-0 text-indigo-600 dark:text-indigo-400 border border-indigo-500/10">
                        <Star className="w-4 h-4 fill-indigo-500/10" />
                      </div>
                      <div className="space-y-0.5">
                        <h3 className="font-bold text-gray-900 dark:text-white text-xs uppercase tracking-wider">
                          Highlights ({currentTopicHighlights.length})
                        </h3>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-normal font-normal">
                          {currentTopicHighlights.length === 0 ? "No highlights yet for this topic." : "Manage highlighted sections and references for this topic."}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Empty state or highlights list */}
                  {currentTopicHighlights.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                      <div className="w-28 h-28 rounded-full bg-gradient-to-tr from-indigo-500/5 to-purple-500/10 dark:from-indigo-500/10 dark:to-purple-500/20 flex items-center justify-center border border-indigo-500/20 dark:border-indigo-500/30 mb-6 relative group hover:border-indigo-500/30 transition-all duration-300">
                        <div className="absolute top-5 right-5 opacity-70">
                          <Sparkles className="w-4 h-4 text-indigo-400 animate-pulse" />
                        </div>
                        <div className="absolute bottom-5 left-5 opacity-70">
                          <Sparkles className="w-3 h-3 text-indigo-400/80 animate-pulse" style={{ animationDelay: "500ms" }} />
                        </div>
                        <div className="relative text-indigo-600 dark:text-indigo-400 group-hover:scale-105 transition-transform duration-300">
                          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="stroke-indigo-600 dark:stroke-indigo-400">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                            <line x1="16" y1="13" x2="8" y2="13" />
                            <line x1="16" y1="17" x2="8" y2="17" />
                            <line x1="10" y1="9" x2="8" y2="9" />
                            <path d="M18.5 11.5a1.5 1.5 0 0 1 2 2L12.5 21H9v-3.5l8-8z" className="stroke-indigo-500 fill-indigo-500/10" />
                          </svg>
                        </div>
                      </div>
                      <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-2 tracking-tight">
                        Your highlights will appear here
                      </h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400 max-w-[260px] leading-relaxed">
                        Use the highlighter to add important text from this topic.
                      </p>
                    </div>
                  ) : (
                    <ul className="space-y-4">
                      {currentTopicHighlights.map((item) => {
                        const noteValue = noteDraftById[item.id] ?? "";
                        const saving = Boolean(savingNoteById[item.id]);
                        const noteEditorOpen = Boolean(highlightNoteEditorOpenById[item.id]);
                        const itemColor = normalizeHighlightColor(item.color);
                        return (
                          <li
                            key={item.id}
                            className={`rounded-2xl border p-4 shadow-xs hover:shadow-sm transition-all duration-300 ${HIGHLIGHT_CARD_CLASS[itemColor]}`}
                          >
                            <div className="mb-3 flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5">
                                {HIGHLIGHT_COLORS.map((color) => (
                                  <button
                                    key={`${item.id}-${color}`}
                                    type="button"
                                    onClick={() => handleSaveHighlightColor(item.id, color)}
                                    className={[
                                      "w-4 h-4 rounded-full border transition-all cursor-pointer hover:scale-110",
                                      HIGHLIGHT_SWATCH_CLASS[color],
                                      itemColor === color
                                        ? "border-indigo-600 dark:border-indigo-300 ring-2 ring-indigo-500/25"
                                        : "border-white/80 dark:border-gray-900/80 shadow-xs",
                                    ].join(" ")}
                                    title={`Set highlight color to ${color}`}
                                    aria-label={`Set highlight color to ${color}`}
                                  />
                                ))}
                              </div>
                              <div className="flex items-center gap-3">
                                <span className={`text-[10px] uppercase font-bold tracking-wider ${HIGHLIGHT_CARD_TEXT_COLOR[itemColor]}`}>
                                  {itemColor}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveHighlight(item.id)}
                                  disabled={highlightMutationBusy}
                                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-600 dark:text-red-400 hover:underline disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                  title="Delete highlight"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>Delete</span>
                                </button>
                              </div>
                            </div>
                            
                            <button
                              type="button"
                              onClick={() => handleJumpToHighlight(item)}
                              className="block w-full text-left text-xs sm:text-sm text-gray-800 dark:text-gray-200 font-medium leading-relaxed mb-3 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer group"
                              title="Jump to highlighted text in the topic"
                            >
                              <span className="inline-flex items-center gap-1 text-[9px] font-bold text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity mr-1 uppercase">
                                <Compass className="w-3 h-3 animate-spin-slow" /> Jump
                              </span>
                              "${item.text}"
                            </button>

                            {notesEnabled && (
                              <div className="border-t border-gray-200/30 dark:border-white/5 pt-3">
                                {!noteEditorOpen && (
                                  <>
                                    {(item.note ?? "").trim() ? (
                                      <div className="rounded-xl border border-gray-200/50 dark:border-white/5 bg-white/70 dark:bg-[#0c101b]/70 px-3.5 py-2.5">
                                        <p className="mb-1 text-[9px] uppercase font-bold tracking-wider text-indigo-600 dark:text-indigo-400">
                                          Attached Note
                                        </p>
                                        <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                                          {item.note}
                                        </p>
                                      </div>
                                    ) : null}
                                    <div className="mt-2 flex items-center justify-end">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setNoteDraftById((prev) => ({ ...prev, [item.id]: item.note ?? "" }));
                                          setHighlightNoteEditorOpenById((prev) => ({ ...prev, [item.id]: true }));
                                        }}
                                        className="inline-flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                                      >
                                        <Edit2 className="w-3 h-3" />
                                        <span>{(item.note ?? "").trim() ? "Edit Note" : "Add Note"}</span>
                                      </button>
                                    </div>
                                  </>
                                )}
                                {noteEditorOpen && (
                                  <div className="space-y-3 bg-white/30 dark:bg-gray-900/10 p-3 rounded-xl border border-gray-200/50 dark:border-white/5">
                                    <span className="text-[9px] uppercase font-bold tracking-wider text-indigo-600 dark:text-indigo-400">
                                      Note Editor
                                    </span>
                                    <textarea
                                      value={noteValue}
                                      onChange={(e) => setNoteDraftById((prev) => ({ ...prev, [item.id]: e.target.value.slice(0, 800) }))}
                                      rows={3}
                                      placeholder="Add note..."
                                      className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-gray-900 px-3.5 py-2.5 text-xs text-gray-800 dark:text-gray-100 outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50 transition-all resize-none"
                                    />
                                    <div className="flex items-center gap-2">
                                      <button
                                        type="button"
                                        onClick={() => handleSaveHighlightNote(item.id)}
                                        disabled={saving || highlightMutationBusy}
                                        className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                      >
                                        {saving ? "Saving..." : "Save Note"}
                                      </button>
                                      <span className="text-gray-400 dark:text-gray-500">|</span>
                                      <button
                                        type="button"
                                        onClick={() => setHighlightNoteEditorOpenById((prev) => ({ ...prev, [item.id]: false }))}
                                        className="text-xs font-medium text-gray-500 hover:underline cursor-pointer"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>
              )}
            </div>
          </div>
      )}

      {drawingsEnabled && drawingPadOpen && (
        <div
          className={`fixed bottom-0 right-0 z-50 border-l border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 shadow-2xl will-change-[opacity] transition-opacity duration-220 ease-out ${drawingPanelVisible ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"}`}
          style={{
            top: "var(--ev-navbar-offset, 56px)",
            width: `${drawingPanelWidth}px`,
            opacity: drawingPanelVisible ? 1 : 0,
          }}
        >
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize drawing panel"
            onPointerDown={handleStartDrawingResize}
            className="absolute left-0 top-0 h-full w-6 -translate-x-1/2 cursor-col-resize bg-transparent z-20 touch-none"
            title="Drag to resize drawing panel"
          >
            <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-10 w-10 rounded-full border border-gray-300/90 dark:border-gray-700/90 bg-white/95 dark:bg-gray-900/95 shadow-lg flex items-center justify-center">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-600 dark:text-gray-300">
                <path d="M9 7 5 12l4 5" />
                <path d="M15 7l4 5-4 5" />
                <line x1="12" y1="6" x2="12" y2="18" />
              </svg>
            </div>
          </div>
          <TopicDrawingPad
            topicTitle={currentTopic.topic_name}
            initialScene={currentCourseDrawing?.scene ?? null}
            draftStorageKey={`ev:drawing-draft:v1:${courseId}`}
            saveBusy={drawingSaveBusy}
            onSave={handleSaveDrawingScene}
            onDelete={handleDeleteDrawingScene}
            onClose={handleCloseDrawingPad}
          />
        </div>
      )}

      {highlightsEnabled && selectionAction.visible && selectedText && (
        <>
          {selectionColorPaletteOpen && (
            <div
              data-highlight-palette="1"
              className="fixed z-50 rounded-full border border-indigo-200 dark:border-indigo-800 bg-white/95 dark:bg-gray-900/95 backdrop-blur px-2 py-1 shadow-lg flex items-center gap-1.5"
              style={{
                left: `${selectionAction.x}px`,
                top: `${selectionAction.y}px`,
                transform:
                  selectionAction.placement === "below"
                    ? "translate(-50%, calc(-100% - 0.55rem))"
                    : "translate(-50%, 0.55rem)",
              }}
            >
              {HIGHLIGHT_COLORS.map((color) => (
                <button
                  key={`picker-${color}`}
                  type="button"
                  onPointerDown={(e) => { e.stopPropagation(); }}
                  onClick={() => handleSelectionColorPick(color)}
                  className={[
                    "w-7 h-7 rounded-full border-2 transition-colors cursor-pointer",
                    HIGHLIGHT_SWATCH_CLASS[color],
                    normalizeHighlightColor(selectedColor) === color
                      ? "border-indigo-600 dark:border-indigo-300"
                      : "border-white/70 dark:border-gray-900/60",
                  ].join(" ")}
                  title={`Highlight in ${color}`}
                  aria-label={`Highlight in ${color}`}
                />
              ))}
            </div>
          )}
          <button
            data-highlight-action="1"
            onPointerDown={(e) => { e.stopPropagation(); }}
            onClick={() => {
              if (!selectionColorPaletteOpen) {
                setSelectionColorPaletteOpen(true);
                persistLastHighlightColor(selectedColor);
                return;
              }
              handleAddHighlight();
            }}
            className="fixed z-50 inline-flex items-center justify-center w-9 h-9 rounded-full border border-indigo-300 dark:border-indigo-700 bg-white dark:bg-gray-900 text-indigo-600 dark:text-indigo-400 shadow-lg hover:scale-105 transition-transform cursor-pointer"
            style={{
              left: `${selectionAction.x}px`,
              top: `${selectionAction.y}px`,
              transform:
                selectionAction.placement === "below"
                  ? "translate(-50%, 0%)"
                  : "translate(-50%, -100%)",
            }}
            aria-label="Add highlight"
            title={selectionColorPaletteOpen ? "Add highlight with selected color" : "Choose highlight color"}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 4H6a2 2 0 0 0-2 2v14l5-2 5 2V6a2 2 0 0 0-2-2Z" />
              <path d="M18 9v6M21 12h-6" />
            </svg>
            <span
              className={[
                "absolute -right-0.5 -bottom-0.5 w-3 h-3 rounded-full border border-white dark:border-gray-900",
                HIGHLIGHT_SWATCH_CLASS[normalizeHighlightColor(selectedColor)],
              ].join(" ")}
              aria-hidden="true"
            />
          </button>
        </>
      )}

      {/* Floating Course Chatbot (topic page only), shifted left while side drawers are open */}
      <CourseChatbot
        topicTitle={currentTopic.topic_name}
        topicContext={topicContext}
        rightOffsetPx={chatRightOffsetPx}
      />
    </div>
  );
}

