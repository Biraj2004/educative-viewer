import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { getTheme } from "@/utils/theme";
import NavigationEvents from "@/components/edu-viewer/NavigationEvents";
import NavProgressBar from "@/components/edu-viewer/NavProgressBar";
import AuthFlowGuard from "@/utils/AuthFlowGuard";
import { BRAND_ICON_URL } from "@/utils/branding";
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

export const metadata: Metadata = {
  title: "Edu-Viewer PRO",
  description: "An interactive content viewer for code-first learning.",
  icons: {
    icon: [
      { url: BRAND_ICON_URL, sizes: "16x16", type: "image/png" },
      { url: BRAND_ICON_URL, sizes: "32x32", type: "image/png" },
      { url: BRAND_ICON_URL, sizes: "96x96", type: "image/png" },
    ],
    shortcut: [{ url: BRAND_ICON_URL }],
    apple: [{ url: BRAND_ICON_URL, sizes: "180x180", type: "image/png" }],
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
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <script id="ev-runtime-config" dangerouslySetInnerHTML={{ __html: runtimeConfigScript }} />
        <AuthFlowGuard />
        <NavigationEvents />
        <NavProgressBar />
        {children}
      </body>
    </html>
  );
}
