import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { getTheme } from "@/utils/theme";
import NavigationEvents from "@/components/edu-viewer/NavigationEvents";
import NavProgressBar from "@/components/edu-viewer/NavProgressBar";
// import AuthFlowGuard from "@/components/edu-viewer/AuthFlowGuard";
import { BRAND_ICON_URL } from "@/utils/branding";

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
  return (
    <html
      lang="en"
      className={theme === "dark" ? "dark" : ""}
      suppressHydrationWarning
    >
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {/* <AuthFlowGuard /> */}
        <NavigationEvents />
        <NavProgressBar />
        {children}
      </body>
    </html>
  );
}
