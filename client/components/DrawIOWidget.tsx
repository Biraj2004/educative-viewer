"use client";

import { resolveEduUrl } from "@/utils/constants";

export interface DrawIOWidgetData {
  comp_id: string;
  path: string;
  caption: string;
  width: number;
  height: number;
}

export default function DrawIOWidget({ data }: { data: DrawIOWidgetData }) {
  const src = resolveEduUrl(data.path);

  return (
    <div className="max-w-4xl mx-auto px-6 py-2">
      <div className="flex flex-col items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={data.caption || "diagram"}
          width={data.width || undefined}
          height={data.height || undefined}
          className="max-w-full h-auto object-contain"
        />
        {data.caption && (
          <p className="text-center text-sm text-gray-500">{data.caption}</p>
        )}
      </div>
    </div>
  );
}
