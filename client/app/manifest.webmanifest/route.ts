import { NextResponse } from "next/server";

const ICON_VERSION = "20260601";
const ICON_192_URL = `/icon-192.png?v=${ICON_VERSION}`;
const ICON_512_URL = `/icon-512.png?v=${ICON_VERSION}`;
const APPLE_ICON_URL = `/apple-touch-icon.png?v=${ICON_VERSION}`;

const manifest = {
  name: "Edu-Viewer PRO",
  short_name: "Edu-Viewer",
  description: "An interactive content viewer for code-first learning.",
  start_url: "/",
  scope: "/",
  display: "standalone",
  background_color: "#0a0a0a",
  theme_color: "#0a0a0a",
  orientation: "any",
  icons: [
    {
      src: ICON_192_URL,
      sizes: "192x192",
      type: "image/png",
      purpose: "any",
    },
    {
      src: ICON_512_URL,
      sizes: "512x512",
      type: "image/png",
      purpose: "any",
    },
    {
      src: APPLE_ICON_URL,
      sizes: "180x180",
      type: "image/png",
      purpose: "any",
    },
  ],
};

export function GET() {
  return NextResponse.json(manifest, {
    headers: {
      "Content-Type": "application/manifest+json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
