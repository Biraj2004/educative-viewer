import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import AuthProvider from "@/components/AuthProvider";

export const metadata: Metadata = {
  title: "Edu-Viewer PRO",
  description: "Edu-Viewer is a platform to view and interact with educational contents.",
  icons: {
    icon: "/icon-96.png",
  },
};

/**
 * Validates the user's token against the backend DB on every page under
 * /edu-viewer/*. This catches revoked sessions (e.g. login from another device)
 * even when the JWT signature is still valid.
 */
async function validateSession(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get("ev_token")?.value;
  if (!token) return false;

  const base = process.env.BACKEND_API_BASE ?? "";
  try {
    const res = await fetch(`${base}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    return res.ok;
  } catch {
    return false;
  }
}

export default async function EduViewerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const valid = await validateSession();
  if (!valid) {
    redirect("/auth?reason=session_expired");
  }

  return <AuthProvider>{children}</AuthProvider>;
}
