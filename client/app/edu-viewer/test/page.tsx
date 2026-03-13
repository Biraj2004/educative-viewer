"use client";
import { useEffect, useState } from 'react';
import AppNavbar from '@/components/AppNavbar';
import { useAuth } from '@/components/AuthProvider';
import LazyLoadPlaceholder, { LazyLoadPlaceholderData } from '@/components/LazyLoadPlaceholder';
import EditorCode, { EditorCodeComponentData } from '@/components/EditorCode';
import SlateHTML from '@/components/SlateHTML';
import Latex from '@/components/Latex';
import MarkdownEditor from '@/components/MarkdownEditor';
import Code from '@/components/Code';
import Columns from '@/components/Columns';
import DrawIOWidget from '@/components/DrawIOWidget';
import APIWidget from '@/components/APIWidget';
import SpoilerEditor from '@/components/SpoilerEditor';
import TabbedCode from '@/components/TabbedCode';
import Table from '@/components/Table';
import EducativeArray from '@/components/EducativeArray';
import MatchTheAnswers from '@/components/MatchTheAnswers';
import Permutation from '@/components/Permutation';
import Quiz from '@/components/Quiz';
import { QuizData } from '@/components/Quiz';
import StructuredQuiz from '@/components/StructuredQuiz';
import { StructuredQuizData } from '@/components/StructuredQuiz';
import Sandpack from '@/components/Sandpack';
import { SandpackData } from '@/components/Sandpack';
import WebpackBin, { WebpackBinData } from '@/components/WebpackBin';
import Image from '@/components/Image';
import File, { FileComponentData } from '@/components/File';
import InstaCalc from '@/components/InstaCalc';
import ChartComponent, { ChartComponentData } from '@/components/Chart';
import RunJS, { RunJSData } from '@/components/RunJS';
import Notepad, { NotepadData } from '@/components/Notepad';
import CodeDrawing, { CodeDrawingData } from '@/components/CodeDrawing';
import NaryTree, { NaryTreeData } from '@/components/NaryTree';
import Video, { VideoData } from '@/components/Video';
import Adaptive, { AdaptiveData } from '@/components/Adaptive';
import BinaryTree, { BinaryTreeData } from '@/components/BinaryTree';
import Graphviz, { GraphvizData } from '@/components/Graphviz';
import LinkedList, { LinkedListData } from '@/components/LinkedList';
import Stack, { StackData } from '@/components/Stack';
import Matrix, { MatrixComponentData } from '@/components/Matrix';
import ButtonLink, { ButtonLinkData } from '@/components/ButtonLink';
import CodeTest, { CodeTestData } from '@/components/CodeTest';

function SectionHeader({ name, note }: { name: string; note?: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-xs font-mono font-semibold tracking-wide text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 px-2.5 py-1 rounded-md">
        {name}
      </span>
      {note && (
        <>
          <span className="text-gray-300 dark:text-gray-700 text-xs select-none">·</span>
          <span className="text-xs font-mono text-gray-400 dark:text-gray-500">{note}</span>
        </>
      )}
    </div>
  );
}

const componentMapping: { [key: string]: React.ComponentType<any> } = {
    "CanvasAnimation": (props: { data: LazyLoadPlaceholderData }) => <LazyLoadPlaceholder {...props} />,
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
};

export default function ComponentTestPage() {
  const [components, setComponents] = useState<any[]>([]);
  const [matchData, setMatchData] = useState<any>(null);
  const { authToken, user, loading } = useAuth();

  // Load MatchTheAnswers test data from public folder (no auth needed)
  useEffect(() => {
    fetch('/matchTheAnswers.json')
      .then((r) => r.json())
      .then(setMatchData)
      .catch((e) => console.error('Failed to load matchTheAnswers.json', e));
  }, []);


  // Auth guard: redirect unauthenticated users once the auth state is resolved.
  useEffect(() => {
    if (!loading && !user) {
      window.location.replace("/auth");
    }
  }, [loading, user]);

  useEffect(() => {
    if (!authToken) return;
    const fetchComponents = async () => {
      try {
        const BACKEND = (process.env.NEXT_PUBLIC_BACKEND_API_BASE ?? "").replace(/\/$/, "");
        const API = `${BACKEND}/api`;
        const response = await fetch(`${API}/test_components`, {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        });
        if (response.ok) {
          const data = await response.json();
          setComponents(data);
        } else {
          console.error('Failed to fetch test components');
        }
      } catch (error) {
        console.error('Error fetching test components:', error);
      }
    };

    fetchComponents();
  }, [authToken]);

  // Render nothing while auth state is being resolved (avoids flash of content).
  if (loading || !user) return null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 overflow-x-hidden">
      <AppNavbar
        crumbs={[{ label: "Component Test" }]}
        backHref="/edu-viewer"
        backLabel="Dashboard"
      />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-10">
        {/* Pinned: MatchTheAnswers loaded from public/matchTheAnswers.json */}
        {matchData && (
          <section>
            <SectionHeader name="MatchTheAnswers" note="public/matchTheAnswers.json" />
            <div className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden bg-white dark:bg-gray-900">
              <MatchTheAnswers data={matchData} />
            </div>
          </section>
        )}

        {components.map((component) => {
          const Component = componentMapping[component.component_type];
          if (!Component) {
            return (
              <div key={component.component_id}>
                Unknown component type: {component.component_type}
              </div>
            );
          }
          const content = JSON.parse(component.content_json);
          return (
            <section key={component.component_id}>
              <SectionHeader name={component.component_type} />
              <div className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden bg-white dark:bg-gray-900">
                <Component data={content} />
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}