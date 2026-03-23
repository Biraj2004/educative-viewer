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

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeComps(value: unknown): ColumnComp[] {
  const list = Array.isArray(value) ? value : [];
  const fallbackWidth = list.length > 0 ? 100 / list.length : 100;
  return list.map((item, index) => {
    const rec = asRecord(item);
    const widthNum = asNumber(rec.width);
    const widthFromStr = Number(asString(rec.width));
    const normalizedWidth =
      widthNum !== null
        ? widthNum
        : Number.isFinite(widthFromStr)
          ? widthFromStr
          : fallbackWidth;

    return {
      type: asString(rec.type),
      width: String(Math.max(1, normalizedWidth)),
      content: asRecord(rec.content),
      hash: (typeof rec.hash === "string" || typeof rec.hash === "number") ? rec.hash : index,
    };
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Columns({ data }: { data: ColumnsData }) {
  const comps = normalizeComps((data as unknown as Record<string, unknown>)?.comps);

  if (comps.length === 0) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-2">
        <div className="rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
          No column data available.
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-2">
      <div className="flex gap-4 items-stretch">
        {comps.map((comp, i) => {
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

