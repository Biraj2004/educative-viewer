import type { Metadata } from "next";
import AuthProvider from "@/components/edu-viewer/AuthProvider";

export const metadata: Metadata = {
  title: "Dashboard · Edu-Viewer PRO",
  description: "Edu-Viewer is a platform to view and interact with educational contents.",
  icons: {
    icon: "/icon-96.png",
  },
};

// Auth is enforced entirely client-side by AuthProvider:
// it calls GET /api/auth/me (Flask) on every route change and redirects to /auth on 401.
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthProvider>{children}</AuthProvider>;
}
