import type { Metadata } from "next";
import AuthProvider from "@/components/AuthProvider";

export const metadata: Metadata = {
  title: "Edu-Viewer PRO",
  description: "Edu-Viewer is a platform to view and interact with educational contents.",
  icons: {
    icon: "/icon-96.png",
  },
};

// Auth is enforced entirely client-side by AuthProvider:
// it calls GET /api/auth/me (Flask) on every route change and redirects to /auth on 401.
export default function EduViewerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthProvider>{children}</AuthProvider>;
}
