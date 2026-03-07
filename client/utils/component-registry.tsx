import React from "react";
import MarkdownEditor from "@/components/MarkdownEditor";
import DrawIOWidget from "@/components/DrawIOWidget";
import CodeComponent from "@/components/CodeComponent";
import TabbedCode from "@/components/TabbedCode";
import TableComponent from "@/components/TableComponent";
import SpoilerEditor from "@/components/SpoilerEditor";
import SlateHtml from "@/components/SlateHtml";
import LatexComponent from "@/components/LatexComponent";
import { CanvasAnimationViewer } from "@/components/CanvasAnimationViewer";
import ApiWidget from "@/components/ApiWidget";
import MxGraphWidget from "@/components/MxGraphWidget";
import EditorCodeComponent from "@/components/EditorCodeComponent";
import EducativeArray from "@/components/EducativeArray";
import ColumnComponent from "@/components/ColumnComponent";
import ImageComponent from "@/components/ImageComponent";
import FileComponent from "@/components/FileComponent";
import InstaCalc from "@/components/InstaCalc";
import MatchTheAnswers from "@/components/MatchTheAnswers";
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
  MxGraphWidget:         (c) => <MxGraphWidget             data={c as any} />,
  EditorCodeComponent:   (c) => <EditorCodeComponent       data={c as any} />,
  MarkdownEditor:        (c) => <MarkdownEditor            data={c as any} />,
  DrawIOWidget:          (c) => <DrawIOWidget              data={c as any} />,
  CodeComponent:         (c) => <CodeComponent             data={c as any} />,
  TabbedCode:            (c) => <TabbedCode                data={c as any} />,
  TableComponent:        (c) => <TableComponent            data={c as any} />,
  SpoilerEditor:         (c) => <SpoilerEditor             data={c as any} />,
  SlateHtml:             (c) => <SlateHtml                 data={c as any} />,
  LatexComponent:        (c) => <LatexComponent            data={c as any} />,
  CanvasAnimationViewer: (c) => <CanvasAnimationViewer     data={c as any} />,
  ApiWidget:             (c) => <ApiWidget                 data={c as any} />,
  ColumnComponent:       (c) => <ColumnComponent           data={c as any} />,
  EducativeArray:        (c) => <EducativeArray            data={c as any} />,
  ImageComponent:        (c) => <ImageComponent            data={c as any} />,
  FileComponent:         (c) => <FileComponent             data={c as any} />,
  InstaCalc:             (c) => <InstaCalc                 data={c as any} />,
  MatchTheAnswers:       (c) => <MatchTheAnswers           data={c as any} />,
};

/* eslint-enable @typescript-eslint/no-explicit-any */
