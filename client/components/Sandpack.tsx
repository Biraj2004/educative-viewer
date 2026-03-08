"use client";

import {
  SandpackProvider,
  SandpackLayout,
  SandpackCodeEditor,
  SandpackPreview,
  SandpackConsole,
  SandpackFileExplorer,
  defaultDark,
  type SandpackPredefinedTemplate,
  type SandpackFiles,
} from "@codesandbox/sandpack-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SandpackFile {
  active: boolean;
  code: string;
  hidden: boolean;
  readOnly: boolean;
  visible: boolean;
  highlightedLines?: string;
  useInAIMentor?: boolean;
}

export interface SandpackData {
  comp_id: string;
  autoRun?: boolean;
  caption?: string;
  codeHeight?: number;
  files: Record<string, SandpackFile>;
  hideConsole?: boolean;
  hideEditor?: boolean;
  hideOutput?: boolean;
  hideStopBtn?: boolean;
  hideTests?: boolean;
  outputHeight?: number;
  primaryFile?: string;
  template?: string;
  version?: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Convert Educative's file map → Sandpack's SandpackFiles shape
function toSandpackFiles(files: Record<string, SandpackFile>): SandpackFiles {
  const out: SandpackFiles = {};
  for (const [path, file] of Object.entries(files)) {
    // Sandpack expects paths starting with /
    const key = path.startsWith("/") ? path : `/${path}`;
    out[key] = {
      code: file.code,
      active: file.active,
      hidden: file.hidden,
      readOnly: file.readOnly,
    };
  }
  return out;
}

// Sandpack template names match what the API sends (react, vue, vanilla, node, etc)
function resolveTemplate(template?: string): SandpackPredefinedTemplate {
  const valid: SandpackTemplate[] = [
    "react", "react-ts", "vue", "vue3", "vanilla", "vanilla-ts",
    "angular", "svelte", "solid", "test-ts", "nextjs", "vite",
    "vite-react", "vite-react-ts", "vite-vue", "vite-vue-ts",
    "vite-svelte", "vite-svelte-ts", "node", "astro",
    "static",
  ];
  return valid.includes(template as SandpackTemplate)
    ? (template as SandpackTemplate)
    : "static";
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Sandpack({ data }: { data: SandpackData }) {
  if (data.hideOutput) return null;

  const files = toSandpackFiles(data.files);
  const template = resolveTemplate(data.template);
  const editorHeight = data.codeHeight ?? 400;
  const previewHeight = data.outputHeight ?? 400;
  const showEditor = !data.hideEditor;
  const showConsole = !data.hideConsole;
  const multiFile = Object.keys(files).length > 1;

  return (
    <div className="max-w-4xl mx-auto px-6 py-2">
      <SandpackProvider
        files={files}
        template={template}
        theme={defaultDark}
        options={{
          autorun: data.autoRun ?? true,
          activeFile: data.primaryFile
            ? (data.primaryFile.startsWith("/") ? data.primaryFile : `/${data.primaryFile}`)
            : undefined,
          recompileDelay: 500,
        }}
      >
        <SandpackLayout>
          {multiFile && showEditor && <SandpackFileExplorer />}
          {showEditor && (
            <SandpackCodeEditor
              style={{ height: editorHeight }}
              showTabs={!multiFile}
              showLineNumbers
              showInlineErrors
              wrapContent
              closableTabs={false}
            />
          )}
          <SandpackPreview
            style={{ height: previewHeight }}
            showNavigator={false}
            showOpenInCodeSandbox={false}
            showRefreshButton
          />
          {showConsole && <SandpackConsole style={{ height: 160 }} />}
        </SandpackLayout>
      </SandpackProvider>

      {data.caption && (
        <p className="text-center text-sm text-gray-500 mt-2">{data.caption}</p>
      )}
    </div>
  );
}

