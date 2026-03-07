import { resolveEduUrl } from "@/utils/constants";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ImageComponentData {
  comp_id: string;
  borderColor?: string;
  caption?: string;
  hasBorder?: boolean;
  image_id?: number;
  metadata?: {
    height?: number;
    name?: string;
    sizeInBytes?: number;
    width?: number;
  };
  path: string;
  style?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ImageComponent({ data }: { data: ImageComponentData }) {
  const src = resolveEduUrl(data.path);
  const alt = data.metadata?.name ?? data.caption ?? "image";

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="flex flex-col items-center gap-3">
        <div
          style={
            data.hasBorder
              ? { border: `1px solid ${data.borderColor ?? "#ccc"}` }
              : undefined
          }
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            className="max-w-full h-auto block"
          />
        </div>
        {data.caption && (
          <p className="text-sm text-gray-500 text-center">{data.caption}</p>
        )}
      </div>
    </div>
  );
}
