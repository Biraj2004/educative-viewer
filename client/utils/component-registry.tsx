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
import WebpackBin from "@/components/WebpackBin";
import "katex/dist/katex.min.css";

// ─── Component Feature Flags ─────────────────────────────────────────────────
// Add a component type name here to silently suppress it everywhere.

export const DISABLED_COMPONENTS: ReadonlySet<string> = new Set<string>([
  "APIWidget",
]);

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
  MxGraphWidget:         (c) => <div data-component-type="MxGraphWidget">        <MxGraphWidget          data={c as any} /></div>,
  MarkdownEditor:        (c) => <div data-component-type="MarkdownEditor">       <MarkdownEditor         data={c as any} /></div>,
  DrawIOWidget:          (c) => <div data-component-type="DrawIOWidget">         <DrawIOWidget           data={c as any} /></div>,
  Code:                  (c) => <div data-component-type="Code">                 <Code                   data={c as any} /></div>,
  TabbedCode:            (c) => <div data-component-type="TabbedCode">           <TabbedCode             data={c as any} /></div>,
  Table:                 (c) => <div data-component-type="Table">                <Table                  data={c as any} /></div>,
  SpoilerEditor:         (c) => <div data-component-type="SpoilerEditor">        <SpoilerEditor          data={c as any} /></div>,
  SlateHTML:             (c) => <div data-component-type="SlateHTML">            <SlateHTML              data={c as any} /></div>,
  Latex:                 (c) => <div data-component-type="Latex">                <Latex                  data={c as any} /></div>,
  CanvasAnimation:       (c) => <div data-component-type="CanvasAnimation">      <CanvasAnimation        data={c as any} /></div>,
  APIWidget:             (c) => <div data-component-type="APIWidget">            <APIWidget              data={c as any} /></div>,
  EditorCode:            (c) => <div data-component-type="EditorCode">           <EditorCode             data={c as any} /></div>,
  EducativeArray:        (c) => <div data-component-type="EducativeArray">       <EducativeArray         data={c as any} /></div>,
  Columns:               (c) => <div data-component-type="Columns">              <Columns                data={c as any} /></div>,
  // eslint-disable-next-line jsx-a11y/alt-text
  Image:                 (c) => <div data-component-type="Image">                <Image                  data={c as any} /></div>,
  File:                  (c) => <div data-component-type="File">                 <File                   data={c as any} /></div>,
  InstaCalc:             (c) => <div data-component-type="InstaCalc">            <InstaCalc              data={c as any} /></div>,
  MatchTheAnswers:       (c) => <div data-component-type="MatchTheAnswers">      <MatchTheAnswers        data={c as any} /></div>,
  LazyLoadPlaceholder:   (c) => <div data-component-type="LazyLoadPlaceholder">  <LazyLoadPlaceholder    data={c as any} /></div>,
  Permutation:           (c) => <div data-component-type="Permutation">          <Permutation            data={c as any} /></div>,
  Quiz:                  (c) => <div data-component-type="Quiz">                 <Quiz                   data={c as any} /></div>,
  StructuredQuiz:        (c) => <div data-component-type="StructuredQuiz">       <StructuredQuiz         data={c as any} /></div>,
  Sandpack:              (c) => <div data-component-type="Sandpack">             <Sandpack               data={c as any} /></div>,
  WebpackBin:            (c) => <div data-component-type="WebpackBin">           <WebpackBin             data={c as any} /></div>,
  Android:               (c) => <div data-component-type="Android">              <WebpackBin             data={c as any} /></div>,
};

// ─── Lookup Helper ───────────────────────────────────────────────────────────
// Use this instead of COMPONENT_REGISTRY[type] directly so that
// DISABLED_COMPONENTS is respected in every call site.

export function getRenderer(type: string): RendererFn | null {
  if (DISABLED_COMPONENTS.has(type)) return null;
  return COMPONENT_REGISTRY[type] ?? null;
}
