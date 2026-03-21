import type { NextConfig } from "next";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

function getBrandAssetVersion(): string {
  try {
    const iconPath = path.join(process.cwd(), "public", "icon-96.png");
    const data = fs.readFileSync(iconPath);
    return crypto.createHash("sha1").update(data).digest("hex").slice(0, 12);
  } catch {
    return "dev";
  }
}

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_BRAND_ASSET_VERSION: getBrandAssetVersion(),
  },
};

export default nextConfig;
