import { getRenderer, UnknownRenderer } from "@/utils/component-registry";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LazyLoadPlaceholderData {
  actualType: string;
  contentRevision?: string;
  height?: number;
  width?: number;
  pageId?: number;
  slidesCount?: number;
  widgetIndex?: number;
  lazyLoadData?: {
    components?: Array<{
      type: string;
      content?: Record<string, unknown>;
    }>;
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function LazyLoadPlaceholder({ data }: { data: LazyLoadPlaceholderData }) {
  const renderer = getRenderer(data.actualType);

  if (!renderer) {
    return <UnknownRenderer type={data.actualType} />;
  }

  // Find the matching component content from lazyLoadData
  const comp = data.lazyLoadData?.components?.find((c) => c.type === data.actualType);
  const content = comp?.content ?? {};

  return <>{renderer(content)}</>;
}
