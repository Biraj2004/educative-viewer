import React from "react";
import MarkdownEditor from "@/components/MarkdownEditor";
import DrawIOWidget from "@/components/DrawIOWidget";
import Code from "@/components/Code";
import TabbedCode from "@/components/TabbedCode";
import Table from "@/components/Table";
import SpoilerEditor from "@/components/SpoilerEditor";
import SlateHTML from "@/components/SlateHTML";
import Latex from "@/components/Latex";
import CanvasAnimation from "@/components/CanvasAnimation";
import APIWidget from "@/components/APIWidget";
import MxGraphWidget from "@/components/MxGraphWidget";
import EditorCode from "@/components/EditorCode";
import EducativeArray from "@/components/EducativeArray";
import Columns from "@/components/Columns";
import Image from "@/components/Image";
import File from "@/components/File";
import InstaCalc from "@/components/InstaCalc";
import MatchTheAnswers from "@/components/MatchTheAnswers";
import LazyLoadPlaceholder from "@/components/LazyLoadPlaceholder";
import Permutation from "@/components/Permutation";
import Quiz from "@/components/Quiz";
import StructuredQuiz from "@/components/StructuredQuiz";
import Sandpack from "@/components/Sandpack";
import "katex/dist/katex.min.css";

// ─── Types ────────────────────────────────────────────────────────────────────

export type RendererFn = (content: Record<string, unknown>) => React.ReactNode;

// ─── Fallback ─────────────────────────────────────────────────────────────────

export function UnknownRenderer({ type }: { type: string }) {
  return (
    <div className="flex items-center justify-center h-full py-6 text-sm text-gray-400 italic">
      Unsupported component: {type}
    </div>
  );
}

// ─── Registry ────────────────────────────────────────────────────────────────
// Maps every Educative component type string → its renderer.
// Add new entries here whenever a new component is created.

/* eslint-disable @typescript-eslint/no-explicit-any */

export const COMPONENT_REGISTRY: Record<string, RendererFn> = {
  MxGraphWidget:         (c) => <MxGraphWidget          data={c as any} />,
  MarkdownEditor:        (c) => <MarkdownEditor         data={c as any} />,
  DrawIOWidget:          (c) => <DrawIOWidget           data={c as any} />,
  Code:                  (c) => <Code                   data={c as any} />,
  TabbedCode:            (c) => <TabbedCode             data={c as any} />,
  Table:                 (c) => <Table                  data={c as any} />,
  SpoilerEditor:         (c) => <SpoilerEditor          data={c as any} />,
  SlateHTML:             (c) => <SlateHTML              data={c as any} />,
  Latex:                 (c) => <Latex                  data={c as any} />,
  CanvasAnimation:       (c) => <CanvasAnimation        data={c as any} />,
  APIWidget:             (c) => <APIWidget              data={c as any} />,
  EditorCode:            (c) => <EditorCode             data={c as any} />,
  EducativeArray:        (c) => <EducativeArray         data={c as any} />,
  Columns:               (c) => <Columns                data={c as any} />,
  // eslint-disable-next-line jsx-a11y/alt-text
  Image:                 (c) => <Image                  data={c as any} />,
  File:                  (c) => <File                   data={c as any} />,
  InstaCalc:             (c) => <InstaCalc              data={c as any} />,
  MatchTheAnswers:       (c) => <MatchTheAnswers        data={c as any} />,
  LazyLoadPlaceholder:   (c) => <LazyLoadPlaceholder    data={c as any} />,
  Permutation:           (c) => <Permutation            data={c as any} />,
  Quiz:                  (c) => <Quiz                   data={c as any} />,
  StructuredQuiz:        (c) => <StructuredQuiz         data={c as any} />,
  Sandpack:              (c) => <Sandpack               data={c as any} />,
};
