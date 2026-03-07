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
import { CanvasAnimationViewer } from '@/components/CanvasAnimationViewer';
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
import Image from '@/components/Image';
import File, { FileComponentData } from '@/components/File';
import InstaCalc from '@/components/InstaCalc';

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      {/* Canvas Animation Section */}
      <div className="border-b border-gray-200 bg-gray-50 px-6 py-10">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-[22px] font-bold text-gray-900 mb-6">Canvas Animation</h2>
          <CanvasAnimationViewer data={canvasAnimationData} />
        </div>
      </div>

      {/* LaTeX Component */}
      <div className="border-b border-gray-200">
        <Latex data={latexComponentData} />
      </div>

      {/* Markdown Editor */}
      <div className="border-b border-gray-200">
        <MarkdownEditor data={markdownEditorData} />
      </div>

      {/* Code Component */}
      <div className="border-b border-gray-200">
        <Code data={codeComponentData} />
      </div>

      {/* Column Component */}
      <div className="border-b border-gray-200">
        <Columns data={columnComponentData} />
      </div>

      {/* DrawIO Widget */}
      <div className="border-b border-gray-200">
        <DrawIOWidget data={drawIOWidgetData} />
      </div>

      {/* API Widget */}
      <div className="border-b border-gray-200">
        <APIWidget data={apiWidgetData} />
      </div>

      {/* Table Component */}
      <div className="border-b border-gray-200">
        <Table data={tableComponentData} />
      </div>

      {/* Tabbed Code */}
      <div className="border-b border-gray-200">
        <TabbedCode data={tabbedCodeData} />
      </div>

      {/* Spoiler Editor */}
      <div className="border-b border-gray-200">
        <SpoilerEditor data={spoilerEditorData} />
      </div>

      {/* Editor Code Component */}
      <div className="border-b border-gray-200">
        <EditorCode data={editorCodeComponentData as EditorCodeComponentData} />
      </div>

      {/* Educative Array */}
      <div className="border-b border-gray-200">
        <EducativeArray data={educativeArrayData} />
      </div>

      {/* Image Component */}
      <div className="border-b border-gray-200">
        {/* eslint-disable-next-line jsx-a11y/alt-text */}
        <Image data={imageComponentData} />
      </div>

      {/* File Component */}
      <div className="border-b border-gray-200">
        <File data={fileComponentData as FileComponentData} />
      </div>

      {/* InstaCalc */}
      <div className="border-b border-gray-200">
        <InstaCalc data={instaCalcData} />
      </div>

      {/* Match The Answers */}
      <div className="border-b border-gray-200">
        <MatchTheAnswers data={matchTheAnswersData} />
      </div>

      {/* Permutation */}
      <div className="border-b border-gray-200">
        <Permutation data={permutationData} />
      </div>

      {/* Slate HTML Content */}
      <SlateHTML data={slateHtmlData} />
    </div>
  );
}
