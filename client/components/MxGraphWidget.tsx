import { resolveEduUrl } from "@/utils/constants";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MxGraphWidgetData {
  path: string;
  caption?: string;
  prevPath?: string;
  svg?: string;
  xml?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function MxGraphWidget({ data }: { data: MxGraphWidgetData }) {
  const src = resolveEduUrl(data.path);

  return (
    <div className="flex flex-col items-center justify-center h-full py-4">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={data.caption ?? "diagram"}
        className="max-w-full h-auto object-contain"
      />
      {data.caption && (
        <p className="text-center text-sm text-gray-500 mt-2">{data.caption}</p>
      )}
    </div>
  );
}
