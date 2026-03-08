import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Edu-Viewer PRO",
  description: "Edu-Viewer is a platform to view and interact with educational contents.",
  icons: {
    icon: "/icon-96.png",
  },
};

export default function EduViewerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
