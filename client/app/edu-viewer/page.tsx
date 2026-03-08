"use client";
import canvasAnimationData from '../../public/canvasAnimation.json';
import slateHtmlData from '../../public/slatehtml.json';
import latexComponentData from '../../public/latexComponent.json';
import markdownEditorData from '../../public/MarkdownEditor.json';
import codeComponentData from '../../public/codeComponent.json';
import columnComponentData from '../../public/columnComponent.json';
import drawIOWidgetData from '../../public/DrawIOWidget.json';
import apiWidgetData from '../../public/apiWidget.json';
import spoilerEditorData from '../../public/SpoilerEditor.json';
import tabbedCodeData from '../../public/TabbedCode.json';
import tableComponentData from '../../public/tableComponent.json';
import editorCodeComponentData from '../../public/editorCodeComponent.json';
import educativeArrayData from '../../public/educativeArray.json';
import imageComponentData from '../../public/imageComponent.json';
import fileComponentData from '../../public/fileComponent.json';
import instaCalcData from '../../public/instaCalc.json';
import matchTheAnswersData from '../../public/matchTheAnswers.json';
import permutationData from '../../public/Permutation.json';
import quizData from '../../public/Quiz.json';
import structuredQuizData from '../../public/StructuredQuiz.json';
import sandpackData from '../../public/Sandpack.json';
import webpackBinData from '../../public/WebpackBin.json';
import androidData from '../../public/Android.json';
import LazyLoadPlaceholder from '@/components/LazyLoadPlaceholder';
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
import WebpackBin from '@/components/WebpackBin';
import Image from '@/components/Image';
import File, { FileComponentData } from '@/components/File';
import InstaCalc from '@/components/InstaCalc';
import DarkModeToggle from '@/components/DarkModeToggle';

export default function Home() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      {/* Sticky top bar with toggle */}
      <div className="sticky top-0 z-20 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">Component Demo</span>
          <DarkModeToggle />
        </div>
      </div>

      {/* Canvas Animation Section */}
      <div className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 px-6 py-10">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-[22px] font-bold text-gray-900 dark:text-gray-100 mb-6">Canvas Animation</h2>
          <LazyLoadPlaceholder data={canvasAnimationData as any} />
        </div>
      </div>

      {/* LaTeX Component */}
      <div className="border-b border-gray-200 dark:border-gray-800">
        <Latex data={latexComponentData} />
      </div>

      {/* Markdown Editor */}
      <div className="border-b border-gray-200 dark:border-gray-800">
        <MarkdownEditor data={markdownEditorData} />
      </div>

      {/* Code Component */}
      <div className="border-b border-gray-200 dark:border-gray-800">
        <Code data={codeComponentData} />
      </div>

      {/* Column Component */}
      <div className="border-b border-gray-200 dark:border-gray-800">
        <Columns data={columnComponentData} />
      </div>

      {/* DrawIO Widget */}
      <div className="border-b border-gray-200 dark:border-gray-800">
        <DrawIOWidget data={drawIOWidgetData} />
      </div>

      {/* API Widget */}
      <div className="border-b border-gray-200 dark:border-gray-800">
        <APIWidget data={apiWidgetData} />
      </div>

      {/* Table Component */}
      <div className="border-b border-gray-200 dark:border-gray-800">
        <Table data={tableComponentData} />
      </div>

      {/* Tabbed Code */}
      <div className="border-b border-gray-200 dark:border-gray-800">
        <TabbedCode data={tabbedCodeData} />
      </div>

      {/* Spoiler Editor */}
      <div className="border-b border-gray-200 dark:border-gray-800">
        <SpoilerEditor data={spoilerEditorData} />
      </div>

      {/* Editor Code Component */}
      <div className="border-b border-gray-200 dark:border-gray-800">
        <EditorCode data={editorCodeComponentData as EditorCodeComponentData} />
      </div>

      {/* Educative Array */}
      <div className="border-b border-gray-200 dark:border-gray-800">
        <EducativeArray data={educativeArrayData} />
      </div>

      {/* Image Component */}
      <div className="border-b border-gray-200 dark:border-gray-800">
        {/* eslint-disable-next-line jsx-a11y/alt-text */}
        <Image data={imageComponentData} />
      </div>

      {/* File Component */}
      <div className="border-b border-gray-200 dark:border-gray-800">
        <File data={fileComponentData as FileComponentData} />
      </div>

      {/* InstaCalc */}
      <div className="border-b border-gray-200 dark:border-gray-800">
        <InstaCalc data={instaCalcData} />
      </div>

      {/* Match The Answers */}
      <div className="border-b border-gray-200 dark:border-gray-800">
        <MatchTheAnswers data={matchTheAnswersData} />
      </div>

      {/* Permutation */}
      <div className="border-b border-gray-200 dark:border-gray-800">
        <Permutation data={permutationData} />
      </div>

      {/* Quiz */}
      <div className="border-b border-gray-200 dark:border-gray-800">
        <Quiz data={quizData as QuizData} />
      </div>

      {/* Structured Quiz */}
      <div className="border-b border-gray-200 dark:border-gray-800">
        <StructuredQuiz data={structuredQuizData as StructuredQuizData} />
      </div>

      {/* Sandpack */}
      <div className="border-b border-gray-200 dark:border-gray-800">
        <Sandpack data={sandpackData as SandpackData} />
      </div>
      {/* WebpackBin */}
      <div className="border-b border-gray-200 dark:border-gray-800">
        <WebpackBin data={webpackBinData as any} />
      </div>
      {/* Android */}
      <div className="border-b border-gray-200 dark:border-gray-800">
        <WebpackBin data={androidData as any} />
      </div>
      {/* Slate HTML Content */}
      <SlateHTML data={slateHtmlData} />
    </div>
  );
}
