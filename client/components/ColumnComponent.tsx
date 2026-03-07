"use client";

import { COMPONENT_REGISTRY, UnknownRenderer } from "@/utils/component-registry";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ColumnComp {
  type: string;
  width: string;
  content: Record<string, unknown>;
  hash: string | number;
}

export interface ColumnComponentData {
  comp_id: string;
  comps: ColumnComp[];
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ColumnComponent({ data }: { data: ColumnComponentData }) {
  return (
    <div className="max-w-4xl mx-auto px-6 py-6">
      <div className="flex gap-4 items-stretch">
        {data.comps.map((comp, i) => {
          const renderer = COMPONENT_REGISTRY[comp.type];
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

