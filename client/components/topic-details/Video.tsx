// ─── Types ────────────────────────────────────────────────────────────────────

export interface VideoData {
  comp_id: string;
  url: string;
  height?: string;
  caption?: string;
  version?: string;
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function toEmbedUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // youtube.com/watch?v=ID
    if (parsed.hostname.includes("youtube.com") && parsed.searchParams.has("v")) {
      return `https://www.youtube.com/embed/${parsed.searchParams.get("v")}`;
    }
    // youtu.be/ID
    if (parsed.hostname === "youtu.be") {
      return `https://www.youtube.com/embed${parsed.pathname}`;
    }
    // Already an embed URL or unrecognised — return as-is
    return url;
  } catch {
    return url;
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Video({ data }: { data: VideoData }) {
  const embedUrl = toEmbedUrl(data.url);
  const height = data.height ?? "450px";

  return (
    <div className="flex flex-col gap-2 px-4 py-4">
      <div className="w-full" style={{ height }}>
        <iframe
          src={embedUrl}
          title={data.caption || "Video"}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="w-full h-full rounded"
          style={{ border: "none" }}
        />
      </div>
      {data.caption && (
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
          {data.caption}
        </p>
      )}
    </div>
  );
}
