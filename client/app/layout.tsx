import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "@excalidraw/excalidraw/index.css";
import { getTheme } from "@/utils/theme";
import NavigationEvents from "@/components/edu-viewer/NavigationEvents";
import NavProgressBar from "@/components/edu-viewer/NavProgressBar";
import PWARegistration from "@/components/edu-viewer/PWARegistration";
import AuthFlowGuard from "@/utils/AuthFlowGuard";
import {
  BRAND_APPLE_TOUCH_ICON_URL,
  BRAND_FAVICON_URL,
  BRAND_LOGO_URL,
} from "@/utils/branding";
import {
  RUNTIME_PUBLIC_ENV_KEYS,
  type RuntimePublicEnvMap,
} from "@/utils/runtime-config";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const MANIFEST_VERSION = "20260531";

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  title: "Edu-Viewer PRO",
  description: "An interactive content viewer for code-first learning.",
  icons: {
    icon: [
      { url: BRAND_FAVICON_URL, sizes: "32x32", type: "image/png" },
      { url: BRAND_FAVICON_URL, sizes: "16x16", type: "image/png" },
      { url: BRAND_LOGO_URL, sizes: "96x96", type: "image/png" },
    ],
    shortcut: [{ url: BRAND_FAVICON_URL, type: "image/png" }],
    apple: [{ url: BRAND_APPLE_TOUCH_ICON_URL, sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    title: "Edu-Viewer PRO",
    statusBarStyle: "default",
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const theme = await getTheme();
  const runtimeConfig = RUNTIME_PUBLIC_ENV_KEYS.reduce((acc, key) => {
    acc[key] = process.env[key] ?? "";
    return acc;
  }, {} as RuntimePublicEnvMap);
  const runtimeConfigScript = `window.__EV_RUNTIME_CONFIG__=${JSON.stringify(runtimeConfig).replace(/</g, "\\u003c")};`;

  return (
    <html
      lang="en"
      className={theme === "dark" ? "dark" : ""}
      suppressHydrationWarning
    >
      <head>
        <link rel="icon" href={BRAND_FAVICON_URL} type="image/png" sizes="32x32" />
        <link rel="shortcut icon" href={BRAND_FAVICON_URL} type="image/png" />
        <link rel="manifest" href={`/manifest.webmanifest?v=${MANIFEST_VERSION}`} crossOrigin="use-credentials" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <script id="ev-runtime-config" dangerouslySetInnerHTML={{ __html: runtimeConfigScript }} />
        <AuthFlowGuard />
        <NavigationEvents />
        <NavProgressBar />
        <PWARegistration />
        {children}
      </body>
    </html>
  );
}
