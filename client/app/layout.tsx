import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./edu-viewer/globals.css";
import { getTheme } from "@/utils/theme";
import NavigationEvents from "@/components/NavigationEvents";
import NavProgressBar from "@/components/NavProgressBar";

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
  icons: { icon: "/icon-96.png" },
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
        <NavigationEvents />
        <NavProgressBar />
        {children}
      </body>
    </html>
  );
}
