"use client";
import { useEffect, useState, type ReactNode } from 'react';
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
import SequenceDiagrams, { SequenceDiagramData } from "@/components/topic-details/SequenceDiagrams";

interface TestComponentRow {
  component_id: number;
  component_type: string;
  content_json: string;
  topic_url?: string | null;
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
    "SequenceDiagrams": (props: { data: SequenceDiagramData }) => <SequenceDiagrams {...props} />,
};

type FetchStatus = "idle" | "loading" | "forbidden" | "empty" | "ok" | "error";

export default function ComponentTestPage() {
  const [components, setComponents] = useState<TestComponentRow[]>([]);
  const [fetchStatus, setFetchStatus] = useState<FetchStatus>("idle");
  const { authToken, user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      window.location.replace("/auth");
    }
  }, [loading, user]);

  useEffect(() => {
    if (!authToken) return;
    const fetchComponents = async () => {
      setFetchStatus("loading");
      try {
        const BACKEND = (process.env.NEXT_PUBLIC_BACKEND_API_BASE ?? "").replace(/\/$/, "");
        const API = `${BACKEND}/api/admin`;
        const response = await fetch(`${API}/test-components`, {
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
          setFetchStatus(rows.length === 0 ? "empty" : "ok");
        } else {
          setFetchStatus("error");
        }
      } catch (error) {
        console.error("Error fetching test components:", error);
        setFetchStatus("error");
      }
    };
    fetchComponents();
  }, [authToken]);

  if (loading || !user) return null;

  const handleOpenTopic = (topicUrl: string | null) => {
    if (!topicUrl) return;
    const newWindow = window.open(topicUrl, "_blank", "noopener,noreferrer");
    if (newWindow) newWindow.opener = null;
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <AppNavbar
        crumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Component's Test Page" },
        ]}
        backHref="/dashboard"
        backLabel="Dashboard"
      />

      <div className="overflow-x-hidden">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-10">

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
          {fetchStatus === "empty" && (
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

            return (
              <section key={component.component_id}>
                <SectionHeader
                  name={`<${component.component_type}-${component.component_id}>`}
                  action={
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
                      aria-label={`Open source topic for ${component.component_type} in a new tab`}
                    >
                      Open Topic
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H18m0 0v4.5M18 6l-7.5 7.5M6.75 6h3M6 9.75V17.25A.75.75 0 006.75 18h7.5a.75.75 0 00.75-.75v-3" />
                      </svg>
                    </button>
                  }
                />
                <div className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden bg-white dark:bg-gray-900">
                  <Component data={content} />
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
