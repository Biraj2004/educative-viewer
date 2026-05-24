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
  type ViewerHighlight,
} from "@/utils/authClient";
import { getBackendApiBase } from "@/utils/runtime-config";

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
  highlightsEnabled?: boolean;
  bookmarksEnabled?: boolean;
  notesEnabled?: boolean;
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
  highlightsEnabled = true,
  bookmarksEnabled = true,
  notesEnabled = true,
}: Props) {
  const USER_HIGHLIGHT_ATTR = "data-user-highlight";
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [tocDrawerOpen, setTocDrawerOpen] = useState(false);
  const [highlightDrawerOpen, setHighlightDrawerOpen] = useState(false);
  const [headings, setHeadings] = useState<{ idx: number; text: string; level: number }[]>([]);
  const [activeHeadingIdx, setActiveHeadingIdx] = useState<number>(0);
  const contentRef = useRef<HTMLDivElement>(null);

  const [currentTopic, setCurrentTopic] = useState<TopicDetail>(topic);
  const [topicChanging, setTopicChanging] = useState(false);
  const [completed, setCompleted] = useState<Set<number>>(() => new Set(initialCompleted));
  const [bookmarked, setBookmarked] = useState<Set<number>>(() => new Set(initialBookmarked));
  const [highlightsByTopic, setHighlightsByTopic] = useState<Record<string, ViewerHighlight[]>>(
    () => initialHighlights
  );
  const [selectedText, setSelectedText] = useState("");
  const [newHighlightNote, setNewHighlightNote] = useState("");
  const [noteDraftById, setNoteDraftById] = useState<Record<string, string>>({});
  const [savingNoteById, setSavingNoteById] = useState<Record<string, boolean>>({});
  const selectedTextRef = useRef("");
  const selectedOffsetsRef = useRef<{ start: number; end: number; componentIndex: number } | null>(null);
  const [selectionAction, setSelectionAction] = useState<{
    visible: boolean;
    x: number;
    y: number;
    placement: "above" | "below";
  }>({ visible: false, x: 0, y: 0, placement: "below" });
  const [isCompleted, setIsCompleted] = useState(() => new Set(initialCompleted).has(topic.topic_index));
  const [scrollProgress, setScrollProgress] = useState(0);
  const navigatingRef = useRef(false);
  const completedRef = useRef<Set<number>>(new Set(initialCompleted));
  const validFromPath = fromPath && fromPath.startsWith("/") && !fromPath.startsWith("//") ? fromPath : null;
  const fromPathsPage = Boolean(validFromPath?.startsWith("/dashboard/paths"));
  const fromProjectsPage = Boolean(validFromPath?.startsWith("/dashboard/projects"));
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
      : { label: "Courses", href: "/dashboard/courses" };
  const courseBaseHref = `/dashboard/courses/${courseId}/${slug}`;
  const courseHref = validFromPath
    ? `${courseBaseHref}?from=${encodeURIComponent(validFromPath)}`
    : courseBaseHref;

  // Keep completedRef current (also updated synchronously below when mutating state)
  useEffect(() => { completedRef.current = completed; }, [completed]);
  useEffect(() => { selectedTextRef.current = selectedText; }, [selectedText]);
  useEffect(() => {
    const next: Record<string, string> = {};
    currentTopicHighlights.forEach((item) => {
      if (item.id) next[item.id] = item.note ?? "";
    });
    setNoteDraftById(next);
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

  const highlightClassName = "bg-yellow-200/80 dark:bg-yellow-500/35 text-inherit rounded px-0.5";

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

  const wrapTextSegment = useCallback((textNode: Text, startOffset: number, endOffset: number, highlightId: string) => {
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
    mark.className = highlightClassName;
    mark.textContent = middle;
    frag.appendChild(mark);
    if (after) frag.appendChild(document.createTextNode(after));
    parent.replaceChild(frag, textNode);
  }, [USER_HIGHLIGHT_ATTR]);

  const addMarkByOffsets = useCallback((container: HTMLElement, start: number, end: number, highlightId: string) => {
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
          wrapTextSegment(node, overlapStart - nodeStart, overlapEnd - nodeStart, highlightId);
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

  const getComponentScopeFromNode = useCallback((node: Node): { componentIndex: number; scope: HTMLElement } | null => {
    const el = node instanceof Element ? node : node.parentElement;
    if (!el) return null;
    const host = el.closest("[data-topic-component-index]") as HTMLElement | null;
    if (!host) return null;
    const raw = host.getAttribute("data-topic-component-index");
    if (raw == null) return null;
    const componentIndex = Number(raw);
    if (!Number.isFinite(componentIndex)) return null;
    const scope = (host.querySelector("[data-highlight-scope='1']") as HTMLElement | null) ?? host;
    return { componentIndex, scope };
  }, []);

  const getRangeOffsetsWithinContainer = useCallback((container: HTMLElement, range: Range) => {
    if (range.collapsed) return null;
    if (range.startContainer.nodeType !== Node.TEXT_NODE || range.endContainer.nodeType !== Node.TEXT_NODE) {
      return null;
    }
    if (!isSelectableTextNode(range.startContainer) || !isSelectableTextNode(range.endContainer)) {
      return null;
    }

    const startTextNode = range.startContainer as Text;
    const endTextNode = range.endContainer as Text;
    const startOffsetInNode = range.startOffset;
    const endOffsetInNode = range.endOffset;

    const nodes = getSelectableTextNodes(container);
    let traversed = 0;
    let start: number | null = null;
    let end: number | null = null;
    for (const textNode of nodes) {
      const len = textNode.nodeValue?.length ?? 0;
      if (textNode === startTextNode) {
        start = traversed + Math.max(0, Math.min(startOffsetInNode, len));
      }
      if (textNode === endTextNode) {
        end = traversed + Math.max(0, Math.min(endOffsetInNode, len));
      }
      traversed += len;
      if (start !== null && end !== null) break;
    }

    if (start === null || end === null || end <= start) return null;
    return { start, end };
  }, [getSelectableTextNodes, isSelectableTextNode]);

  const applyHighlightByText = useCallback((container: HTMLElement, text: string, highlightId: string) => {
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
        wrapTextSegment(node, safeStart, safeEnd, highlightId);
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
      setSelectionAction((prev) => ({ ...prev, visible: false }));
      return "";
    }

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      setSelectedText("");
      selectedOffsetsRef.current = null;
      setSelectionAction((prev) => ({ ...prev, visible: false }));
      return "";
    }

    const range = selection.getRangeAt(0);
    const startInfo = getComponentScopeFromNode(range.startContainer);
    const endInfo = getComponentScopeFromNode(range.endContainer);
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
      setSelectionAction((prev) => ({ ...prev, visible: false }));
      return "";
    }

    const text = selection.toString().trim().slice(0, 280);
    if (!text) {
      setSelectedText("");
      selectedOffsetsRef.current = null;
      setSelectionAction((prev) => ({ ...prev, visible: false }));
      return "";
    }
    if (
      startInfo
      && endInfo
      && startInfo.componentIndex === endInfo.componentIndex
      && startInfo.scope.contains(startNodeForScope as Node)
      && startInfo.scope.contains(endNodeForScope as Node)
    ) {
      const offsets = getRangeOffsetsWithinContainer(startInfo.scope, range);
      selectedOffsetsRef.current = offsets
        ? { ...offsets, componentIndex: startInfo.componentIndex }
        : null;
    } else {
      selectedOffsetsRef.current = null;
    }
    setSelectedText(text);
    const rect = range.getBoundingClientRect();
    const nextX = Math.min(window.innerWidth - 20, Math.max(20, rect.left + (rect.width / 2)));
    const wantsBelow = rect.bottom + 56 < window.innerHeight;
    const nextY = wantsBelow ? rect.bottom + 12 : Math.max(72, rect.top - 12);
    setSelectionAction({
      visible: true,
      x: nextX,
      y: nextY,
      placement: wantsBelow ? "below" : "above",
    });
    return text;
  }, [getComponentScopeFromNode, getRangeOffsetsWithinContainer, highlightsEnabled]);

  const handleAddHighlight = useCallback(() => {
    if (!highlightsEnabled) return;
    const text = (selectedTextRef.current || captureSelectionFromTopicContent()).trim();
    if (!text) return;
    const topicKey = String(currentTopic.topic_index);
    const selectedOffsets = selectedOffsetsRef.current;
    const note = notesEnabled ? newHighlightNote.trim().slice(0, 800) : "";
    const existing = currentTopicHighlights;
    const overlaps: ViewerHighlight[] = [];
    let mergedStart = selectedOffsets?.start ?? null;
    let mergedEnd = selectedOffsets?.end ?? null;
    let mergedComponentIndex = selectedOffsets?.componentIndex ?? null;

    if (selectedOffsets) {
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
        mergedStart = mergedStart === null ? itemStart : Math.min(mergedStart, itemStart);
        mergedEnd = mergedEnd === null ? itemEnd : Math.max(mergedEnd, itemEnd);
        mergedComponentIndex = itemComponentIndex;
      });
    }

    const optimisticId = `local-${Date.now()}`;
    const optimistic: ViewerHighlight = {
      id: optimisticId,
      text,
      note,
      start_offset: mergedStart,
      end_offset: mergedEnd,
      component_index: mergedComponentIndex,
    };
    const overlapIds = new Set(overlaps.map((item) => item.id));
    const nextTopicHighlights = existing
      .filter((item) => !overlapIds.has(item.id))
      .concat(optimistic);

    setHighlightsByTopic((prev) => ({ ...prev, [topicKey]: nextTopicHighlights }));
    setSelectedText("");
    setNewHighlightNote("");
    selectedOffsetsRef.current = null;
    const sel = window.getSelection();
    sel?.removeAllRanges();
    setSelectionAction((prev) => ({ ...prev, visible: false }));

    const removeOps = overlaps
      .map((item) => item.id)
      .filter(Boolean)
      .map((highlightId) => updateViewerCourseSettings({
        course_id: courseId,
        remove_highlight: {
          topic_index: currentTopic.topic_index,
          highlight_id: highlightId,
        },
      }).catch(() => null));

    Promise.all(removeOps).then(() => updateViewerCourseSettings({
      course_id: courseId,
      add_highlight: {
        topic_index: currentTopic.topic_index,
        text,
        ...(note ? { note } : {}),
        ...(mergedStart !== null && mergedEnd !== null && mergedComponentIndex !== null ? {
          start_offset: mergedStart,
          end_offset: mergedEnd,
          component_index: mergedComponentIndex,
        } : {}),
      },
    })).then((courseState) => {
      const highlights = courseState?.highlights;
      if (!highlights || typeof highlights !== "object") return;
      setHighlightsByTopic(highlights);
    }).catch(() => { });
  }, [
    captureSelectionFromTopicContent,
    courseId,
    currentTopicHighlights,
    currentTopic.topic_index,
    highlightsEnabled,
    notesEnabled,
    newHighlightNote,
  ]);

  const handleRemoveHighlight = useCallback((highlightId: string) => {
    const topicKey = String(currentTopic.topic_index);
    setHighlightsByTopic((prev) => {
      const nextTopicHighlights = (prev[topicKey] ?? []).filter((item) => item.id !== highlightId);
      return { ...prev, [topicKey]: nextTopicHighlights };
    });
    updateViewerCourseSettings({
      course_id: courseId,
      remove_highlight: {
        topic_index: currentTopic.topic_index,
        highlight_id: highlightId,
      },
    }).then((courseState) => {
      const highlights = courseState?.highlights;
      if (!highlights || typeof highlights !== "object") return;
      setHighlightsByTopic(highlights);
    }).catch(() => { });
  }, [courseId, currentTopic.topic_index]);

  const handleSaveHighlightNote = useCallback((highlightId: string) => {
    if (!notesEnabled) return;
    const note = (noteDraftById[highlightId] ?? "").slice(0, 800);
    setSavingNoteById((prev) => ({ ...prev, [highlightId]: true }));
    updateViewerCourseSettings({
      course_id: courseId,
      update_highlight_note: {
        topic_index: currentTopic.topic_index,
        highlight_id: highlightId,
        note,
      },
    }).then((courseState) => {
      const highlights = courseState?.highlights;
      if (!highlights || typeof highlights !== "object") return;
      setHighlightsByTopic(highlights);
    }).catch(() => { }).finally(() => {
      setSavingNoteById((prev) => ({ ...prev, [highlightId]: false }));
    });
  }, [courseId, currentTopic.topic_index, noteDraftById, notesEnabled]);

  const handleClearTopicHighlights = useCallback(() => {
    const topicKey = String(currentTopic.topic_index);
    setHighlightsByTopic((prev) => {
      const next = { ...prev };
      delete next[topicKey];
      return next;
    });
    const container = contentRef.current;
    if (container) {
      unwrapUserHighlights(container);
    }
    updateViewerCourseSettings({
      course_id: courseId,
      clear_highlights_topic_index: currentTopic.topic_index,
    }).then((courseState) => {
      const highlights = courseState?.highlights;
      if (!highlights || typeof highlights !== "object") return;
      setHighlightsByTopic(highlights);
    }).catch(() => { });
  }, [courseId, currentTopic.topic_index, unwrapUserHighlights]);

  const handleJumpToHighlight = useCallback((item: ViewerHighlight) => {
    const container = contentRef.current;
    const highlightId = String(item.id || "").trim();
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
        addMarkByOffsets(targetContainer, start, end, highlightId);
      } else {
        applyHighlightByText(targetContainer, item.text, highlightId);
      }
      mark = findMark();
    }
    if (!mark) return;

    mark.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    mark.classList.add("ring-2", "ring-indigo-400", "ring-offset-1", "ring-offset-white", "dark:ring-offset-gray-900");
    window.setTimeout(() => {
      mark?.classList.remove("ring-2", "ring-indigo-400", "ring-offset-1", "ring-offset-white", "dark:ring-offset-gray-900");
    }, 1200);
  }, [USER_HIGHLIGHT_ATTR, addMarkByOffsets, applyHighlightByText, getComponentScopeByIndex]);

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

    const onCaptureSelection = () => {
      window.requestAnimationFrame(() => {
        captureSelectionFromTopicContent();
      });
    };

    container.addEventListener("mouseup", onCaptureSelection);
    container.addEventListener("keyup", onCaptureSelection);
    container.addEventListener("touchend", onCaptureSelection);
    return () => {
      container.removeEventListener("mouseup", onCaptureSelection);
      container.removeEventListener("keyup", onCaptureSelection);
      container.removeEventListener("touchend", onCaptureSelection);
    };
  }, [captureSelectionFromTopicContent, currentTopic.topic_index]);

  useEffect(() => {
    const onOutsidePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      const targetEl = target instanceof Element ? target : target.parentElement;
      if (targetEl?.closest("[data-highlight-action='1']")) return;
      const container = contentRef.current;
      if (container && container.contains(target)) return;
      setSelectionAction((prev) => ({ ...prev, visible: false }));
    };
    const onScroll = () => {
      setSelectionAction((prev) => ({ ...prev, visible: false }));
    };
    document.addEventListener("mousedown", onOutsidePointerDown);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      document.removeEventListener("mousedown", onOutsidePointerDown);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

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
        const appliedByOffset = addMarkByOffsets(highlightContainer, start, end, id);
        if (appliedByOffset) return;
      }
      applyHighlightByText(highlightContainer, item.text, id);
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

    const t1 = window.setTimeout(applyFull, 80);
    const t2 = window.setTimeout(applyMissingOnly, 600);
    const t3 = window.setTimeout(applyMissingOnly, 1800);
    applyFull();
    return () => {
      observer.disconnect();
      if (rafId !== null) window.cancelAnimationFrame(rafId);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, [
    addMarkByOffsets,
    applyHighlightByText,
    currentTopic.topic_index,
    currentTopicHighlights,
    getComponentScopeByIndex,
    unwrapUserHighlights,
  ]);

  useEffect(() => {
    setSelectedText("");
    setNewHighlightNote("");
    selectedOffsetsRef.current = null;
    setSelectionAction((prev) => ({ ...prev, visible: false }));
  }, [currentTopic.topic_index]);

  // Track reading progress bar and persist last visited topic in auth DB
  useEffect(() => {
    let rafId: number | null = null;

    const handleScroll = () => {
      if (rafId !== null) return; // already scheduled — skip
      rafId = requestAnimationFrame(() => {
        rafId = null;
        const winScroll = document.documentElement.scrollTop;
        const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
        const scrolled = height > 0 ? (winScroll / height) * 100 : 0;
        setScrollProgress(scrolled);
      });
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    // Trigger once on mount to set initial progress bar width
    handleScroll();

    updateViewerCourseSettings({
      course_id: courseId,
      last_topic_index: currentTopic.topic_index,
    }).catch(() => { });

    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [courseId, currentTopic.topic_index]);

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
      <div className="sticky top-14 left-0 right-0 z-20 h-1 bg-gray-200 dark:bg-gray-800 pointer-events-none">
        <div
          className="h-full bg-emerald-500 transition-all duration-150 ease-out"
          style={{ width: `${scrollProgress}%` }}
        />
      </div>

      {/* Tablet drawer overlay — only on < lg, offset below navbar */}
      {drawerOpen && course && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-30 lg:hidden"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="fixed left-0 top-14 h-[calc(100%-3.5rem)] z-40 lg:hidden shadow-2xl">
            <TopicSidebar
              courseId={courseId}
              courseSlug={slug}
              courseTitle={course.title}
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
            toc={course.toc}
            currentTopicIndex={currentTopic.topic_index}
            completedTopicIndices={completed}
            bookmarkedTopicIndices={bookmarked}
            fromPath={validFromPath}
            onTopicClick={(href, destIdx) => handleTopicNav(href, destIdx)}
          />
        )}

        {/* Main content — natural page scroll */}
        <main className="flex-1 min-w-0">

          {/* Estimated Reading Time */}
          <div className="max-w-6xl mx-auto px-6 pt-8 pb-2">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 rounded-full text-[11px] uppercase tracking-wider font-semibold border border-gray-200 dark:border-gray-700 shadow-sm">
                <svg className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{estimatedTime} min read</span>
              </div>
              {highlightsEnabled && (
                <button
                  onClick={() => setHighlightDrawerOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 rounded-full text-[11px] uppercase tracking-wider font-semibold border border-gray-200 dark:border-gray-700 shadow-sm hover:text-amber-600 dark:hover:text-amber-300 hover:border-amber-300 dark:hover:border-amber-700 transition-colors cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path d="M15 4H6a2 2 0 0 0-2 2v14l5-2 5 2V6a2 2 0 0 0-2-2Z" />
                  </svg>
                  <span>Highlights</span>
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

      {highlightsEnabled && (
        <button
          onClick={() => setHighlightDrawerOpen((o) => !o)}
          className="hidden lg:flex fixed right-0 top-[calc(50%+5.25rem)] z-40 flex-col items-center gap-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 border-r-0 rounded-l-xl px-2 py-3 shadow-md text-gray-500 hover:text-amber-600 dark:hover:text-amber-300 transition-colors cursor-pointer"
          title="Highlights & Notes"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M15 4H6a2 2 0 0 0-2 2v14l5-2 5 2V6a2 2 0 0 0-2-2Z" />
          </svg>
          <span className="text-[9px] font-semibold uppercase tracking-wide [writing-mode:vertical-rl] rotate-180">
            H&N
          </span>
        </button>
      )}

      {/* Slide-out TOC Drawer */}
      {tocDrawerOpen && (
        <div className="fixed inset-x-0 bottom-0 top-14 z-40">
          <div className="absolute inset-0 bg-black/40" onClick={() => setTocDrawerOpen(false)} />
          <div className="absolute right-0 top-0 bottom-0 w-80 bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 shadow-2xl flex flex-col">
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

      {highlightsEnabled && highlightDrawerOpen && (
        <div className="fixed inset-x-0 bottom-0 top-14 z-40">
          <div className="absolute inset-0 bg-black/40" onClick={() => setHighlightDrawerOpen(false)} />
          <div className="absolute right-0 top-0 bottom-0 w-[24rem] bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200 dark:border-gray-800 shrink-0">
              <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider">
                Highlights & Notes
              </h2>
              <button onClick={() => setHighlightDrawerOpen(false)} className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 cursor-pointer">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {selectedText && (
                <section className="rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50/60 dark:bg-indigo-950/30 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-indigo-700 dark:text-indigo-300 mb-1">
                    {notesEnabled ? "Add Note To Current Selection" : "Current Selection"}
                  </p>
                  <p className="text-xs text-gray-700 dark:text-gray-200 line-clamp-2 mb-2">
                    {selectedText}
                  </p>
                  {notesEnabled && (
                    <textarea
                      value={newHighlightNote}
                      onChange={(e) => setNewHighlightNote(e.target.value.slice(0, 800))}
                      rows={2}
                      placeholder="Optional note for this highlight..."
                      className="w-full rounded-md border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-gray-800 px-2 py-1.5 text-xs text-gray-700 dark:text-gray-200 outline-none focus:ring-2 focus:ring-indigo-500/40"
                    />
                  )}
                </section>
              )}

              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-wide font-semibold text-gray-500 dark:text-gray-400">
                  Saved ({currentTopicHighlights.length})
                </p>
                <button
                  onClick={handleClearTopicHighlights}
                  disabled={currentTopicHighlights.length === 0}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] rounded border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:border-red-300 dark:hover:border-red-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 6h18" />
                    <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                  </svg>
                  <span>Clear Topic</span>
                </button>
              </div>

              {currentTopicHighlights.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No highlights yet for this topic.
                </p>
              ) : (
                <ul className="space-y-3">
                  {currentTopicHighlights.map((item) => {
                    const noteValue = noteDraftById[item.id] ?? "";
                    const saving = Boolean(savingNoteById[item.id]);
                    return (
                      <li key={item.id} className="rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/20 p-3">
                        <button
                          type="button"
                          onClick={() => handleJumpToHighlight(item)}
                          className="block w-full text-left text-sm text-gray-800 dark:text-gray-100 leading-relaxed mb-2 hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors cursor-pointer"
                          title="Jump to highlight"
                        >
                          {item.text}
                        </button>
                        {notesEnabled && (
                          <textarea
                            value={noteValue}
                            onChange={(e) => setNoteDraftById((prev) => ({ ...prev, [item.id]: e.target.value.slice(0, 800) }))}
                            rows={2}
                            placeholder="Add note..."
                            className="w-full rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1.5 text-xs text-gray-700 dark:text-gray-200 outline-none focus:ring-2 focus:ring-amber-500/30"
                          />
                        )}
                        <div className="mt-2 flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleJumpToHighlight(item)}
                            className="text-xs px-2 py-1 rounded border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-300 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors cursor-pointer"
                          >
                            Jump
                          </button>
                          <button
                            onClick={() => handleRemoveHighlight(item.id)}
                            className="text-xs px-2 py-1 rounded border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:border-red-300 dark:hover:border-red-700 transition-colors cursor-pointer"
                          >
                            Remove
                          </button>
                          {notesEnabled && (
                            <button
                              onClick={() => handleSaveHighlightNote(item.id)}
                              disabled={saving}
                              className="text-xs px-2 py-1 rounded border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40 disabled:opacity-60 cursor-pointer transition-colors"
                            >
                              {saving ? "Saving..." : "Save Note"}
                            </button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {highlightsEnabled && selectionAction.visible && selectedText && (
        <button
          data-highlight-action="1"
          onPointerDown={(e) => { e.stopPropagation(); }}
          onClick={handleAddHighlight}
          className="fixed z-50 inline-flex items-center justify-center w-8 h-8 rounded-full border border-indigo-300 dark:border-indigo-700 bg-white dark:bg-gray-900 text-indigo-600 dark:text-indigo-400 shadow-lg hover:scale-105 transition-transform cursor-pointer"
          style={{
            left: `${selectionAction.x}px`,
            top: `${selectionAction.y}px`,
            transform:
              selectionAction.placement === "below"
                ? "translate(-50%, 0%)"
                : "translate(-50%, -100%)",
          }}
          aria-label="Add highlight"
          title="Add highlight"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 4H6a2 2 0 0 0-2 2v14l5-2 5 2V6a2 2 0 0 0-2-2Z" />
            <path d="M18 9v6M21 12h-6" />
          </svg>
        </button>
      )}

      {/* Floating Course Chatbot */}
      <CourseChatbot topicTitle={currentTopic.topic_name} topicContext={topicContext} />
    </div>
  );
}
