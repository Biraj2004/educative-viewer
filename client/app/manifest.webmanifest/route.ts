import { NextResponse } from "next/server";

const ICON_VERSION = "20260531";
const MANIFEST_ICON_URL = `/brand-icon.png?v=${ICON_VERSION}`;

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
      src: MANIFEST_ICON_URL,
      sizes: "192x192",
      type: "image/png",
      purpose: "any",
    },
    {
      src: MANIFEST_ICON_URL,
      sizes: "512x512",
      type: "image/png",
      purpose: "any",
    },
    {
      src: MANIFEST_ICON_URL,
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
