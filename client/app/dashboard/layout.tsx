import type { Metadata } from "next";
import AuthProvider from "@/components/edu-viewer/AuthProvider";
import { BRAND_ICON_URL } from "@/utils/branding";

export const metadata: Metadata = {
  title: "Dashboard · Edu-Viewer PRO",
  description: "Edu-Viewer is a platform to view and interact with educational contents.",
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

// Auth is enforced entirely client-side by AuthProvider:
// it calls GET /api/auth/me (Flask) on every route change and redirects to /auth on 401.
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthProvider>{children}</AuthProvider>;
}
