import React from "react";
import MarkdownEditor from "@/components/topic-details/MarkdownEditor";
import DrawIOWidget from "@/components/topic-details/DrawIOWidget";
import Code from "@/components/topic-details/Code";
import TabbedCode from "@/components/topic-details/TabbedCode";
import Table from "@/components/topic-details/Table";
import SpoilerEditor from "@/components/topic-details/SpoilerEditor";
import SlateHTML from "@/components/topic-details/SlateHTML";
import Latex from "@/components/topic-details/Latex";
import CanvasAnimation from "@/components/topic-details/CanvasAnimation";
import APIWidget from "@/components/topic-details/APIWidget";
import MxGraphWidget from "@/components/topic-details/MxGraphWidget";
import EditorCode from "@/components/topic-details/EditorCode";
import EducativeArray from "@/components/topic-details/EducativeArray";
import Columns from "@/components/topic-details/Columns";
import Image from "@/components/topic-details/Image";
import File from "@/components/topic-details/File";
import InstaCalc from "@/components/topic-details/InstaCalc";
import MatchTheAnswers from "@/components/topic-details/MatchTheAnswers";
import LazyLoadPlaceholder from "@/components/topic-details/LazyLoadPlaceholder";
import Permutation from "@/components/topic-details/Permutation";
import Quiz from "@/components/topic-details/Quiz";
import StructuredQuiz from "@/components/topic-details/StructuredQuiz";
import Sandpack from "@/components/topic-details/Sandpack";
import WebpackBin from "@/components/topic-details/WebpackBin";
import Video from "@/components/topic-details/Video";
import Stack from "@/components/topic-details/Stack";
import RunJS from "@/components/topic-details/RunJS";
import Notepad from "@/components/topic-details/Notepad";
import Matrix from "@/components/topic-details/Matrix";
import NaryTree from "@/components/topic-details/NaryTree";
import LinkedList from "@/components/topic-details/LinkedList";
import Graphviz from "@/components/topic-details/Graphviz";
import BinaryTree from "@/components/topic-details/BinaryTree";
import CodeTest from "@/components/topic-details/CodeTest";
import ChartComponent from "@/components/topic-details/Chart";
import ButtonLink from "@/components/topic-details/ButtonLink";
import CodeDrawing from "@/components/topic-details/CodeDrawing";
import Adaptive from "@/components/topic-details/Adaptive";
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
  Video:                 (c) => <div data-component-type="Video">                <Video                  data={c as any} /></div>,
  Stack:                 (c) => <div data-component-type="Stack">                <Stack                  data={c as any} /></div>,
  RunJS:                 (c) => <div data-component-type="RunJS">                <RunJS                  data={c as any} /></div>,
  Notepad:               (c) => <div data-component-type="Notepad">              <Notepad                data={c as any} /></div>,
  Matrix:                (c) => <div data-component-type="Matrix">               <Matrix                 data={c as any} /></div>,
  NaryTree:              (c) => <div data-component-type="NaryTree">             <NaryTree               data={c as any} /></div>,
  LinkedList:            (c) => <div data-component-type="LinkedList">           <LinkedList             data={c as any} /></div>,
  Graphviz:              (c) => <div data-component-type="Graphviz">             <Graphviz               data={c as any} /></div>,
  BinaryTree:            (c) => <div data-component-type="BinaryTree">           <BinaryTree             data={c as any} /></div>,
  CodeTest:              (c) => <div data-component-type="CodeTest">             <CodeTest               data={c as any} /></div>,
  Chart:                 (c) => <div data-component-type="Chart">                <ChartComponent         data={c as any} /></div>,
  ButtonLink:            (c) => <div data-component-type="ButtonLink">           <ButtonLink             data={c as any} /></div>,
  CodeDrawing:           (c) => <div data-component-type="CodeDrawing">          <CodeDrawing            data={c as any} /></div>,
  Adaptive:              (c) => <div data-component-type="Adaptive">             <Adaptive               data={c as any} /></div>,
};

// ─── Lookup Helper ───────────────────────────────────────────────────────────
// Use this instead of COMPONENT_REGISTRY[type] directly so that
// DISABLED_COMPONENTS is respected in every call site.

export function getRenderer(type: string): RendererFn | null {
  if (DISABLED_COMPONENTS.has(type)) return null;
  return COMPONENT_REGISTRY[type] ?? null;
}
