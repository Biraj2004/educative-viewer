import { prepareSvg } from '@/utils/svg-helpers';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface EducativeArrayData {
  caption?: string;
  comp_id: string;
  isVerticalArray: boolean;
  nodes: Array<{
    id: string;
    content: string;
    fillcolor: string;
    strokecolor: string;
    textcolor: string;
    x: string;
    y: string;
  }>;
  svg_string: string;
  version: string;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function EducativeArray({ data }: { data: EducativeArrayData }) {
  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="flex flex-col items-center gap-3">
        <div
          dangerouslySetInnerHTML={{ __html: prepareSvg(data.svg_string) }}
          style={{ lineHeight: 0, fontSize: 0 }}
        />
        {data.caption && (
          <p className="text-sm text-gray-500 text-center">{data.caption}</p>
        )}
      </div>
    </div>
  );
}
