import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In · Edu-Viewer PRO",
  description: "Sign in or create an account to access Edu-Viewer PRO.",
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
      {children}
    </div>
  );
}
