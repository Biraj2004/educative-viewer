"use client";

import { getRenderer, UnknownRenderer } from "@/utils/component-registry";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ColumnComp {
  type: string;
  width: string;
  content: Record<string, unknown>;
  hash: string | number;
}

export interface ColumnsData {
  comp_id: string;
  comps: ColumnComp[];
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Columns({ data }: { data: ColumnsData }) {
  return (
    <div className="max-w-6xl mx-auto px-6 py-2">
      <div className="flex gap-4 items-stretch">
        {data.comps.map((comp, i) => {
          const renderer = getRenderer(comp.type);
          return (
            <div
              key={comp.hash ?? i}
              style={{ width: `${comp.width}%`, flexShrink: 0 }}
              className="min-w-0"
            >
              {renderer
                ? renderer(comp.content)
                : <UnknownRenderer type={comp.type} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

