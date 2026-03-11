"use client";
import canvasAnimationData from '../../../public/canvasAnimation.json';
import slateHtmlData from '../../../public/slatehtml.json';
import latexComponentData from '../../../public/latexComponent.json';
import markdownEditorData from '../../../public/MarkdownEditor.json';
import codeComponentData from '../../../public/codeComponent.json';
import columnComponentData from '../../../public/columnComponent.json';
import drawIOWidgetData from '../../../public/DrawIOWidget.json';
import apiWidgetData from '../../../public/apiWidget.json';
import spoilerEditorData from '../../../public/SpoilerEditor.json';
import tabbedCodeData from '../../../public/TabbedCode.json';
import tableComponentData from '../../../public/tableComponent.json';
import editorCodeComponentData from '../../../public/editorCodeComponent.json';
import educativeArrayData from '../../../public/educativeArray.json';
import imageComponentData from '../../../public/imageComponent.json';
import fileComponentData from '../../../public/fileComponent.json';
import instaCalcData from '../../../public/instaCalc.json';
import matchTheAnswersData from '../../../public/matchTheAnswers.json';
import permutationData from '../../../public/Permutation.json';
import quizData from '../../../public/Quiz.json';
import structuredQuizData from '../../../public/StructuredQuiz.json';
import sandpackData from '../../../public/Sandpack.json';
import sandpackStaticData from '../../../public/Sandpack-static.json';
import webpackBinData from '../../../public/WebpackBin.json';
import androidData from '../../../public/Android.json';
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
import AppNavbar from '@/components/AppNavbar';

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

export default function ComponentTestPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 overflow-x-hidden">
      <AppNavbar
        crumbs={[{ label: "Component Test" }]}
        backHref="/edu-viewer"
        backLabel="Dashboard"
      />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-10">

        {/* Canvas Animation */}
        <section>
          <SectionHeader name="LazyLoadPlaceholder" note="Canvas Animation" />
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden bg-white dark:bg-gray-900">
            <LazyLoadPlaceholder data={canvasAnimationData as LazyLoadPlaceholderData} />
          </div>
        </section>

        {/* Latex */}
        <section>
          <SectionHeader name="Latex" />
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden bg-white dark:bg-gray-900">
            <Latex data={latexComponentData} />
          </div>
        </section>

        {/* MarkdownEditor */}
        <section>
          <SectionHeader name="MarkdownEditor" />
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden bg-white dark:bg-gray-900">
            <MarkdownEditor data={markdownEditorData} />
          </div>
        </section>

        {/* Code */}
        <section>
          <SectionHeader name="Code" />
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden bg-white dark:bg-gray-900">
            <Code data={codeComponentData} />
          </div>
        </section>

        {/* TabbedCode */}
        <section>
          <SectionHeader name="TabbedCode" />
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden bg-white dark:bg-gray-900">
            <TabbedCode data={tabbedCodeData} />
          </div>
        </section>

        {/* EditorCode */}
        <section>
          <SectionHeader name="EditorCode" />
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden bg-white dark:bg-gray-900">
            <EditorCode data={editorCodeComponentData as EditorCodeComponentData} />
          </div>
        </section>

        {/* Columns */}
        <section>
          <SectionHeader name="Columns" />
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden bg-white dark:bg-gray-900">
            <Columns data={columnComponentData} />
          </div>
        </section>

        {/* Table */}
        <section>
          <SectionHeader name="Table" />
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden bg-white dark:bg-gray-900">
            <Table data={tableComponentData} />
          </div>
        </section>

        {/* SlateHTML */}
        <section>
          <SectionHeader name="SlateHTML" />
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden bg-white dark:bg-gray-900">
            <SlateHTML data={slateHtmlData} />
          </div>
        </section>

        {/* SpoilerEditor */}
        <section>
          <SectionHeader name="SpoilerEditor" />
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden bg-white dark:bg-gray-900">
            <SpoilerEditor data={spoilerEditorData} />
          </div>
        </section>

        {/* DrawIOWidget */}
        <section>
          <SectionHeader name="DrawIOWidget" />
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden bg-white dark:bg-gray-900">
            <DrawIOWidget data={drawIOWidgetData} />
          </div>
        </section>

        {/* APIWidget */}
        <section>
          <SectionHeader name="APIWidget" />
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden bg-white dark:bg-gray-900">
            <APIWidget data={apiWidgetData} />
          </div>
        </section>

        {/* EducativeArray */}
        <section>
          <SectionHeader name="EducativeArray" />
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden bg-white dark:bg-gray-900">
            <EducativeArray data={educativeArrayData} />
          </div>
        </section>

        {/* Image */}
        <section>
          <SectionHeader name="Image" />
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden bg-white dark:bg-gray-900">
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <Image data={imageComponentData} />
          </div>
        </section>

        {/* File */}
        <section>
          <SectionHeader name="File" />
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden bg-white dark:bg-gray-900">
            <File data={fileComponentData as FileComponentData} />
          </div>
        </section>

        {/* InstaCalc */}
        <section>
          <SectionHeader name="InstaCalc" />
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden bg-white dark:bg-gray-900">
            <InstaCalc data={instaCalcData} />
          </div>
        </section>

        {/* MatchTheAnswers */}
        <section>
          <SectionHeader name="MatchTheAnswers" />
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden bg-white dark:bg-gray-900">
            <MatchTheAnswers data={matchTheAnswersData} />
          </div>
        </section>

        {/* Permutation */}
        <section>
          <SectionHeader name="Permutation" />
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden bg-white dark:bg-gray-900">
            <Permutation data={permutationData} />
          </div>
        </section>

        {/* Quiz */}
        <section>
          <SectionHeader name="Quiz" />
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden bg-white dark:bg-gray-900">
            <Quiz data={quizData as QuizData} />
          </div>
        </section>

        {/* StructuredQuiz */}
        <section>
          <SectionHeader name="StructuredQuiz" />
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden bg-white dark:bg-gray-900">
            <StructuredQuiz data={structuredQuizData as StructuredQuizData} />
          </div>
        </section>

        {/* Sandpack */}
        <section>
          <SectionHeader name="Sandpack" />
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden bg-white dark:bg-gray-900">
            <Sandpack data={sandpackData as SandpackData} />
          </div>
        </section>

        {/* Sandpack Static */}
        <section>
          <SectionHeader name="Sandpack" note="static" />
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden bg-white dark:bg-gray-900">
            <Sandpack data={sandpackStaticData.content as SandpackData} />
          </div>
        </section>

        {/* WebpackBin */}
        <section>
          <SectionHeader name="WebpackBin" />
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden bg-white dark:bg-gray-900">
            <WebpackBin data={webpackBinData as WebpackBinData} />
          </div>
        </section>

        {/* Android (WebpackBin) */}
        <section>
          <SectionHeader name="WebpackBin" note="Android" />
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden bg-white dark:bg-gray-900">
            <WebpackBin data={androidData as WebpackBinData} />
          </div>
        </section>

      </div>
    </div>
  );
}