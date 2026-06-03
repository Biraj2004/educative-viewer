"use client";
import { useEffect, useRef, useState, type ReactNode } from 'react';
import AppNavbar from '@/components/edu-viewer/AppNavbar';
import { useAuth } from '@/components/edu-viewer/AuthProvider';
import LazyLoadPlaceholder, { LazyLoadPlaceholderData } from '@/components/topic-details/LazyLoadPlaceholder';
import EditorCode, { EditorCodeComponentData } from '@/components/topic-details/EditorCode';
import SlateHTML from '@/components/topic-details/SlateHTML';
import Latex from '@/components/topic-details/Latex';
import MarkdownEditor from '@/components/topic-details/MarkdownEditor';
import Code from '@/components/topic-details/Code';
import Columns from '@/components/topic-details/Columns';
import DrawIOWidget from '@/components/topic-details/DrawIOWidget';
import APIWidget from '@/components/topic-details/APIWidget';
import SpoilerEditor from '@/components/topic-details/SpoilerEditor';
import TabbedCode from '@/components/topic-details/TabbedCode';
import Table from '@/components/topic-details/Table';
import TableHTML from '@/components/topic-details/TableHTML';
import EducativeArray from '@/components/topic-details/EducativeArray';
import MatchTheAnswers from '@/components/topic-details/MatchTheAnswers';
import Permutation from '@/components/topic-details/Permutation';
import Quiz from '@/components/topic-details/Quiz';
import { QuizData } from '@/components/topic-details/Quiz';
import StructuredQuiz from '@/components/topic-details/StructuredQuiz';
import { StructuredQuizData } from '@/components/topic-details/StructuredQuiz';
import Sandpack from '@/components/topic-details/Sandpack';
import { SandpackData } from '@/components/topic-details/Sandpack';
import WebpackBin, { WebpackBinData } from '@/components/topic-details/WebpackBin';
import Image from '@/components/topic-details/Image';
import File, { FileComponentData } from '@/components/topic-details/File';
import InstaCalc from '@/components/topic-details/InstaCalc';
import ChartComponent, { ChartComponentData } from '@/components/topic-details/Chart';
import RunJS, { RunJSData } from '@/components/topic-details/RunJS';
import Notepad, { NotepadData } from '@/components/topic-details/Notepad';
import CodeDrawing, { CodeDrawingData } from '@/components/topic-details/CodeDrawing';
import NaryTree, { NaryTreeData } from '@/components/topic-details/NaryTree';
import Video, { VideoData } from '@/components/topic-details/Video';
import Adaptive, { AdaptiveData } from '@/components/topic-details/Adaptive';
import BinaryTree, { BinaryTreeData } from '@/components/topic-details/BinaryTree';
import Graphviz, { GraphvizData } from '@/components/topic-details/Graphviz';
import LinkedList, { LinkedListData } from '@/components/topic-details/LinkedList';
import Stack, { StackData } from '@/components/topic-details/Stack';
import Matrix, { MatrixComponentData } from '@/components/topic-details/Matrix';
import ButtonLink, { ButtonLinkData } from '@/components/topic-details/ButtonLink';
import CodeTest, { CodeTestData } from '@/components/topic-details/CodeTest';
import HashTable, { HashTableData } from '@/components/topic-details/HashTable';
import Mermaid, { MermaidData } from '@/components/topic-details/Mermaid';
import MarkMap, { MarkMapData } from '@/components/topic-details/MarkMap';
import D2Diagram, { D2DiagramData } from '@/components/topic-details/D2Diagram';
import SequenceDiagrams, { SequenceDiagramData } from "@/components/topic-details/SequenceDiagrams";
import PromptAI, { PromptAIData } from "@/components/topic-details/PromptAI";
import UML, { UMLData } from "@/components/topic-details/UML";
import WorkPreview, { WorkPreviewData } from "@/components/topic-details/WorkPreview";
import { getBackendApiBase } from "@/utils/runtime-config";

interface TestComponentRow {
  component_id: number;
  component_type: string;
  content_json: string;
  topic_url?: string | null;
  // present on randomly-selected components (from the course DB query)
  course_id?: number | null;
  topic_index?: number | null;
  topic_slug?: string | null;
  course_slug?: string | null;
  component_index?: number | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Build the local viewer URL for a topic using the fields returned directly
 * from the API (course_id, course_slug, topic_index, topic_slug).
 * Returns null if any required piece is missing.
 */
function buildLocalTopicUrl(component: TestComponentRow): string | null {
  const { course_id, course_slug, topic_index, topic_slug } = component;
  if (!course_id || !course_slug || topic_index == null || !topic_slug) return null;
  return `/dashboard/courses/${course_id}/${course_slug}/topics/${topic_index}/${topic_slug}`;
}

function SectionHeader({ name, note, action }: { name: string; note?: string; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-3">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-xs font-mono font-semibold tracking-wide text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 px-2.5 py-1 rounded-md">
          {name}
        </span>
        {note && (
          <>
            <span className="text-gray-300 dark:text-gray-700 text-xs select-none">·</span>
            <span className="text-xs font-mono text-gray-400 dark:text-gray-500 truncate">{note}</span>
          </>
        )}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

// ─── LazySection ────────────────────────────────────────────────────────────
// Mounts its children only after the placeholder scrolls within 300px of the
// viewport. Prevents simultaneous instantiation of Monaco / iframe components.
function LazySection({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (visible) return;
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); io.disconnect(); } },
      { rootMargin: "300px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [visible]);

  if (visible) return <>{children}</>;
  return (
    <div
      ref={ref}
      className="h-48 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 animate-pulse"
    />
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const componentMapping: { [key: string]: React.ComponentType<any> } = {
    "CanvasAnimation": (props: { data: LazyLoadPlaceholderData }) => <LazyLoadPlaceholder {...props} />,
    "LazyLoadPlaceholder": (props: { data: LazyLoadPlaceholderData }) => <LazyLoadPlaceholder {...props} />,
    "Latex": Latex,
    "MarkdownEditor": MarkdownEditor,
    "Code": Code,
    "TabbedCode": TabbedCode,
    "EditorCode": (props: { data: EditorCodeComponentData }) => <EditorCode {...props} />,
    "Columns": Columns,
    "Table": Table,
    "TableHTML": TableHTML,
    "TableV2": TableHTML,
    "SlateHTML": SlateHTML,
    "SpoilerEditor": SpoilerEditor,
    "DrawIOWidget": DrawIOWidget,
    "APIWidget": APIWidget,
    "EducativeArray": EducativeArray,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, jsx-a11y/alt-text
    "Image": (props: { data: any }) => <Image {...props} />,
    "File": (props: { data: FileComponentData }) => <File {...props} />,
    "InstaCalc": InstaCalc,
    "MatchTheAnswers": MatchTheAnswers,
    "Permutation": Permutation,
    "Quiz": (props: { data: QuizData }) => <Quiz {...props} />,
    "StructuredQuiz": (props: { data: StructuredQuizData }) => <StructuredQuiz {...props} />,
    "Sandpack": (props: { data: SandpackData }) => <Sandpack {...props} />,
    "WebpackBin": (props: { data: WebpackBinData }) => <WebpackBin {...props} />,
    "Android": (props: { data: WebpackBinData }) => <WebpackBin {...props} />,
    "Chart": (props: { data: ChartComponentData }) => <ChartComponent {...props} />,
    "RunJS": (props: { data: RunJSData }) => <RunJS {...props} />,
    "Notepad": (props: { data: NotepadData }) => <Notepad {...props} />,
    "CodeDrawing": (props: { data: CodeDrawingData }) => <CodeDrawing {...props} />,
    "NaryTree": (props: { data: NaryTreeData }) => <NaryTree {...props} />,
    "Video": (props: { data: VideoData }) => <Video {...props} />,
    "Adaptive": (props: { data: AdaptiveData }) => <Adaptive {...props} />,
    "BinaryTree": (props: { data: BinaryTreeData }) => <BinaryTree {...props} />,
    "Graphviz": (props: { data: GraphvizData }) => <Graphviz {...props} />,
    "LinkedList": (props: { data: LinkedListData }) => <LinkedList {...props} />,
    "Stack": (props: { data: StackData }) => <Stack {...props} />,
    "Matrix": (props: { data: MatrixComponentData }) => <Matrix {...props} />,
    "ButtonLink": (props: { data: ButtonLinkData }) => <ButtonLink {...props} />,
    "CodeTest": (props: { data: CodeTestData }) => <CodeTest {...props} />,
    "HashTable": (props: { data: HashTableData }) => <HashTable {...props} />,
    "Mermaid": (props: { data: MermaidData }) => <Mermaid {...props} />,
    "MarkMap": (props: { data: MarkMapData }) => <MarkMap {...props} />,
    "D2Diagram": (props: { data: D2DiagramData }) => <D2Diagram {...props} />,
    "SequenceDiagrams": (props: { data: SequenceDiagramData }) => <SequenceDiagrams {...props} />,
    "PromptAI": (props: { data: PromptAIData }) => <PromptAI {...props} />,
    "UML": (props: { data: UMLData }) => <UML {...props} />,
    "WorkPreview": (props: { data: WorkPreviewData }) => <WorkPreview {...props} />,
};

type FetchStatus = "idle" | "loading" | "forbidden" | "empty" | "ok" | "error";

export default function ComponentTestPage() {
  const [components, setComponents] = useState<TestComponentRow[]>([]);
  const [fetchStatus, setFetchStatus] = useState<FetchStatus>("idle");
  const [allTypes, setAllTypes] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [lastFetchedTypes, setLastFetchedTypes] = useState<string[]>([]);
  const [variantsCount, setVariantsCount] = useState<number>(5);
  const [isTypesDropdownOpen, setIsTypesDropdownOpen] = useState(false);
  const [isVariantsDropdownOpen, setIsVariantsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const variantsDropdownRef = useRef<HTMLDivElement>(null);
  const { authToken, user, loading } = useAuth();

  const didHaveUser = useRef(false);

  useEffect(() => {
    if (user) {
      didHaveUser.current = true;
      return;
    }
    // Only hard-redirect to /auth if we never authenticated in this session.
    // If we already had a user (didHaveUser.current), it's a transient state
    // during soft navigation — do not override with window.location.replace.
    if (!loading && !didHaveUser.current) {
      window.location.replace("/auth");
    }
  }, [loading, user]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsTypesDropdownOpen(false);
      }
      if (variantsDropdownRef.current && !variantsDropdownRef.current.contains(event.target as Node)) {
        setIsVariantsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!authToken) return;
    const fetchTypes = async () => {
      try {
        const BACKEND = getBackendApiBase();
        const response = await fetch(`${BACKEND}/api/admin/test-components/types`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data)) {
            setAllTypes(data);
          }
        }
      } catch (error) {
        console.error("Error fetching component types:", error);
      }
    };
    fetchTypes();
  }, [authToken]);

  const fetchComponents = async (typesToFetch = selectedTypes, countToFetch = variantsCount) => {
    if (!authToken) return;
    setFetchStatus("loading");
    try {
      const BACKEND = getBackendApiBase();
      const API = `${BACKEND}/api/admin`;
      const params = new URLSearchParams();
      if (typesToFetch.length > 0) {
        params.append("types", typesToFetch.join(","));
      }
      params.append("limit", countToFetch.toString());

      const response = await fetch(`${API}/test-components?${params.toString()}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (response.status === 403 || response.status === 401) {
        setFetchStatus("forbidden");
        return;
      }
      if (response.ok) {
        const data: unknown = await response.json();
        const rows = Array.isArray(data) ? (data as TestComponentRow[]) : [];
        setComponents(rows);
        setLastFetchedTypes(typesToFetch);
        setFetchStatus(rows.length === 0 ? "empty" : "ok");
      } else {
        setFetchStatus("error");
      }
    } catch (error) {
      console.error("Error fetching test components:", error);
      setFetchStatus("error");
    }
  };

  useEffect(() => {
    if (!authToken) return;
    fetchComponents([], 5);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authToken]);

  const handleLoadComponents = () => {
    fetchComponents(selectedTypes, variantsCount);
  };

  const handleClearFilters = () => {
    setSelectedTypes([]);
    setLastFetchedTypes([]);
    setVariantsCount(5);
    setComponents([]);
    setFetchStatus("empty");
  };

  const handleToggleType = (type: string) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const handleSelectAll = () => {
    setSelectedTypes(allTypes);
  };

  const handleClearAll = () => {
    setSelectedTypes([]);
  };

  if (loading || !user) return null;

  // The test page mounts many iframes (Sandpack, Monaco, WebpackBin, etc.).
  // Next.js soft navigation cannot reliably tear these down — use hard navigation.
  const hardNav = (href: string) => { window.location.href = href; };

  const handleOpenTopic = (topicUrl: string | null) => {
    if (!topicUrl) return;
    const newWindow = window.open(topicUrl, "_blank", "noopener,noreferrer");
    if (newWindow) newWindow.opener = null;
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <AppNavbar
        crumbs={[
          { label: "Dashboard", onClick: () => hardNav("/dashboard") },
          { label: "Component's Test Page" },
        ]}
        logoHref="/dashboard"
        onLogoClick={(e) => { e.preventDefault(); hardNav("/dashboard"); }}
        backHref="/dashboard"
        backLabel="Dashboard"
        onBackClick={(e) => { e.preventDefault(); hardNav("/dashboard"); }}
      />

      <div className="overflow-x-hidden">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-10">

          {/* ── Controls Panel ─────────────────────────────────────────────── */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-sm space-y-4">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <svg className="w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
              Filter Components
            </h2>
            <div className="flex flex-col md:flex-row items-end gap-4">
              {/* Checkbox Dropdown for Component Types */}
              <div className="relative flex-1 w-full" ref={dropdownRef}>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                  Component Types
                </label>
                <button
                  type="button"
                  onClick={() => setIsTypesDropdownOpen(!isTypesDropdownOpen)}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm bg-gray-50 dark:bg-gray-950 border border-gray-300 dark:border-gray-700 rounded-lg text-left text-gray-700 dark:text-gray-300 hover:border-gray-400 dark:hover:border-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  <span className="truncate">
                    {selectedTypes.length === 0
                      ? "None selected"
                      : `${selectedTypes.length} selected (${selectedTypes.slice(0, 2).join(", ")}${selectedTypes.length > 2 ? "..." : ""})`}
                  </span>
                  <svg
                    className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isTypesDropdownOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                <div
                  className={`absolute z-50 mt-1 w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow-lg max-h-60 overflow-y-auto p-2 space-y-1 transition-all duration-200 origin-top ${
                    isTypesDropdownOpen
                      ? 'opacity-100 translate-y-0 scale-100 pointer-events-auto'
                      : 'opacity-0 -translate-y-2 scale-95 pointer-events-none'
                  }`}
                >
                  <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-2 mb-2 px-2 text-xs">
                    <button
                      type="button"
                      onClick={handleSelectAll}
                      className="text-indigo-600 dark:text-indigo-400 hover:underline font-semibold cursor-pointer"
                    >
                      Select All
                    </button>
                    <span className="text-gray-400 dark:text-gray-500 font-medium">
                      {allTypes.length} types found
                    </span>
                    <button
                      type="button"
                      onClick={handleClearAll}
                      className="text-gray-500 dark:text-gray-400 hover:underline font-semibold cursor-pointer"
                    >
                      Clear All
                    </button>
                  </div>
                  {allTypes.length === 0 ? (
                    <div className="text-xs text-gray-400 p-2 text-center">Loading types...</div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 px-1">
                      {allTypes.map((type) => {
                        const isChecked = selectedTypes.includes(type);
                        return (
                          <div
                            key={type}
                            onClick={() => handleToggleType(type)}
                            className="flex items-center gap-2.5 px-2.5 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800/60 rounded-md cursor-pointer text-sm text-gray-700 dark:text-gray-300 transition-colors select-none"
                          >
                            <div className={`w-4 h-4 rounded flex items-center justify-center border transition-all duration-150 ${
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
                            <span className="font-mono text-xs">{type}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Custom Dropdown for Number of Variants */}
              <div className="relative w-full md:w-48" ref={variantsDropdownRef}>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                  Variants count per type
                </label>
                <button
                  type="button"
                  onClick={() => setIsVariantsDropdownOpen(!isVariantsDropdownOpen)}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm bg-gray-50 dark:bg-gray-950 border border-gray-300 dark:border-gray-700 rounded-lg text-left text-gray-700 dark:text-gray-300 hover:border-gray-400 dark:hover:border-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  <span className="truncate">
                    {variantsCount} variants
                  </span>
                  <svg
                    className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isVariantsDropdownOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                <div
                  className={`absolute z-50 mt-1 w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow-lg max-h-60 overflow-y-auto p-1.5 space-y-0.5 transition-all duration-200 origin-top ${
                    isVariantsDropdownOpen
                      ? 'opacity-100 translate-y-0 scale-100 pointer-events-auto'
                      : 'opacity-0 -translate-y-2 scale-95 pointer-events-none'
                  }`}
                >
                  {[1, 2, 3, 5, 8, 10, 15, 20].map((v) => {
                    const isSelected = variantsCount === v;
                    return (
                      <div
                        key={v}
                        onClick={() => {
                          setVariantsCount(v);
                          setIsVariantsDropdownOpen(false);
                        }}
                        className={`flex items-center justify-between px-2.5 py-1.5 rounded-md cursor-pointer text-sm transition-colors select-none ${
                          isSelected
                            ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-medium'
                            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/60'
                        }`}
                      >
                        <span>{v} variants</span>
                        {isSelected && (
                          <svg className="w-4 h-4 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 w-full md:w-auto shrink-0">
                <button
                  type="button"
                  onClick={handleLoadComponents}
                  disabled={fetchStatus === "loading"}
                  className="flex-1 md:flex-initial flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-400 dark:bg-indigo-600 dark:hover:bg-indigo-500 dark:disabled:bg-indigo-700/50 border border-transparent rounded-lg shadow-sm transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {fetchStatus === "loading" ? (
                    <>
                      <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Loading...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                      </svg>
                      Load
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg shadow-sm transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  Clear
                </button>
              </div>
            </div>
          </div>

          {/* ── Loading skeleton ──────────────────────────────────────────── */}
          {fetchStatus === "loading" && (
            <div className="space-y-6">
              {[1, 2].map((i) => (
                <div key={i} className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
                  <div className="h-8 w-56 m-4 rounded-md bg-gray-100 dark:bg-gray-800 animate-pulse" />
                  <div className="h-40 bg-gray-50 dark:bg-gray-900/60 animate-pulse" />
                </div>
              ))}
            </div>
          )}

          {/* ── Forbidden ─────────────────────────────────────────────────── */}
          {fetchStatus === "forbidden" && (
            <div className="flex flex-col items-center justify-center py-24 gap-5 text-center">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800">
                <svg className="w-8 h-8 text-red-500 dark:text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <div>
                <p className="text-base font-semibold text-gray-900 dark:text-gray-100">Access Restricted</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-xs">
                  This page is only available to admins. Your account does not have the required role.
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-xs font-mono font-semibold">
                403 Forbidden
              </span>
            </div>
          )}

          {/* ── Empty ─────────────────────────────────────────────────────── */}
          {fetchStatus === "empty" && lastFetchedTypes.length === 0 && (
            <div className="flex flex-col items-center justify-center py-24 gap-5 text-center bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800">
                <svg className="w-8 h-8 text-indigo-400 dark:text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                </svg>
              </div>
              <div>
                <p className="text-base font-semibold text-gray-900 dark:text-gray-100">No components loaded</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-sm">
                  Select component types from the filter dropdown above to load random variants from the database.
                </p>
              </div>
            </div>
          )}

          {fetchStatus === "empty" && lastFetchedTypes.length > 0 && (
            <div className="flex flex-col items-center justify-center py-24 gap-5 text-center">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800">
                <svg className="w-8 h-8 text-indigo-400 dark:text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v11m0 0H5a2 2 0 0 0-2 2v4m6-6h10m0 0h-4a2 2 0 0 0-2 2v4m6-6V5" />
                </svg>
              </div>
              <div>
                <p className="text-base font-semibold text-gray-900 dark:text-gray-100">No components yet</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-xs">
                  The test page is empty. Use the admin API to pin components here for testing.
                </p>
              </div>
              <code className="text-xs text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 px-3 py-1.5 rounded-md font-mono">
                POST /api/admin/test-components
              </code>
            </div>
          )}

          {/* ── Error ─────────────────────────────────────────────────────── */}
          {fetchStatus === "error" && (
            <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800">
                <svg className="w-8 h-8 text-amber-500 dark:text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <div>
                <p className="text-base font-semibold text-gray-900 dark:text-gray-100">Failed to load</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Something went wrong while fetching components.</p>
              </div>
            </div>
          )}

          {/* ── Components list ───────────────────────────────────────────── */}
          {fetchStatus === "ok" && components.map((component) => {
            const Component = componentMapping[component.component_type];
            if (!Component) {
              return (
                <div key={component.component_id}>
                  Unknown component type: {component.component_type}
                </div>
              );
            }

            let content: unknown = {};
            try {
              content = JSON.parse(component.content_json);
            } catch (error) {
              console.error(`Invalid content_json for component ${component.component_id}:`, error);
            }

            const topicUrlFromContent =
              content &&
              typeof content === "object" &&
              "topic_url" in content &&
              typeof content.topic_url === "string"
                ? content.topic_url
                : null;
            const topicUrl = component.topic_url?.trim() || topicUrlFromContent?.trim() || null;
            const hasTopicUrl = Boolean(topicUrl);

            const localTopicUrl = buildLocalTopicUrl(component);
            const hasLocalTopicUrl = Boolean(localTopicUrl);

            return (
              <section key={component.component_id}>
                <SectionHeader
                  name={`<${component.component_type}-${component.component_id}>`}
                  action={
                    <div className="flex items-center gap-2">
                      {/* Open Local Topic */}
                      <button
                        type="button"
                        onClick={() => {
                          if (!localTopicUrl) return;
                          const w = window.open(localTopicUrl, "_blank", "noopener,noreferrer");
                          if (w) w.opener = null;
                        }}
                        disabled={!hasLocalTopicUrl}
                        className={[
                          "inline-flex items-center gap-2 px-3 py-1.5 rounded-md border text-xs font-medium transition-colors",
                          hasLocalTopicUrl
                            ? "bg-white dark:bg-gray-900 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 cursor-pointer"
                            : "bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed",
                        ].join(" ")}
                        aria-label={`Open local topic for ${component.component_type} in a new tab`}
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                        </svg>
                        Open Local
                      </button>

                      {/* Open Educative */}
                      <button
                        type="button"
                        onClick={() => handleOpenTopic(topicUrl)}
                        disabled={!hasTopicUrl}
                        className={[
                          "inline-flex items-center gap-2 px-3 py-1.5 rounded-md border text-xs font-medium transition-colors",
                          hasTopicUrl
                            ? "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-indigo-400 dark:hover:border-indigo-600 hover:text-indigo-700 dark:hover:text-indigo-400 cursor-pointer"
                            : "bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed",
                        ].join(" ")}
                        aria-label={`Open Educative topic for ${component.component_type} in a new tab`}
                      >
                        Open Educative
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H18m0 0v4.5M18 6l-7.5 7.5M6.75 6h3M6 9.75V17.25A.75.75 0 006.75 18h7.5a.75.75 0 00.75-.75v-3" />
                        </svg>
                      </button>
                    </div>
                  }
                />
                <div className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden bg-white dark:bg-gray-900">
                  <LazySection>
                    <Component data={content} />
                  </LazySection>
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
