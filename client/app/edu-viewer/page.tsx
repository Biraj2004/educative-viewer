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
import { CanvasAnimationViewer } from '@/components/CanvasAnimationViewer';
import EditorCodeComponent, { EditorCodeComponentData } from '@/components/EditorCodeComponent';
import SlateHtml from '@/components/SlateHtml';
import LatexComponent from '@/components/LatexComponent';
import MarkdownEditor from '@/components/MarkdownEditor';
import CodeComponent from '@/components/CodeComponent';
import ColumnComponent from '@/components/ColumnComponent';
import DrawIOWidget from '@/components/DrawIOWidget';
import ApiWidget from '@/components/ApiWidget';
import SpoilerEditor from '@/components/SpoilerEditor';
import TabbedCode from '@/components/TabbedCode';
import TableComponent from '@/components/TableComponent';

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
        <LatexComponent data={latexComponentData} />
      </div>

      {/* Markdown Editor */}
      <div className="border-b border-gray-200">
        <MarkdownEditor data={markdownEditorData} />
      </div>

      {/* Code Component */}
      <div className="border-b border-gray-200">
        <CodeComponent data={codeComponentData} />
      </div>

      {/* Column Component */}
      <div className="border-b border-gray-200">
        <ColumnComponent data={columnComponentData} />
      </div>

      {/* DrawIO Widget */}
      <div className="border-b border-gray-200">
        <DrawIOWidget data={drawIOWidgetData} />
      </div>

      {/* API Widget */}
      <div className="border-b border-gray-200">
        <ApiWidget data={apiWidgetData} />
      </div>

      {/* Table Component */}
      <div className="border-b border-gray-200">
        <TableComponent data={tableComponentData} />
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
        <EditorCodeComponent data={editorCodeComponentData as EditorCodeComponentData} />
      </div>

      {/* Slate HTML Content */}
      <SlateHtml data={slateHtmlData} />
    </div>
  );
}
