import { resolveEduUrl } from "@/utils/constants";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FileComponentData {
  comp_id: string;
  file?: unknown;
  file_name?: string;
  image_id?: number;
  metadata?: {
    sizeInBytes?: number;
  };
  path: string;
  text?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function File({ data }: { data: FileComponentData }) {
  const href = resolveEduUrl(data.path);
  const label = data.text ?? "Download";
  const fileName = data.file_name ?? "";
  const size = data.metadata?.sizeInBytes;

  return (
    <div className="max-w-4xl mx-auto px-6 py-2 flex justify-center">
      <div className="flex items-center gap-4 rounded-lg border border-gray-200 bg-gray-50 px-5 py-4">
        {/* File icon */}
        <div className="shrink-0 text-blue-500">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
        </div>

        {/* File info */}
        <div className="min-w-0">
          {fileName && (
            <p className="text-sm font-medium text-gray-800 truncate">{fileName}</p>
          )}
          {size !== undefined && (
            <p className="text-xs text-gray-400">{formatBytes(size)}</p>
          )}
        </div>

        {/* Download button */}
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V4" />
          </svg>
          {label}
        </a>
      </div>
    </div>
  );
}
