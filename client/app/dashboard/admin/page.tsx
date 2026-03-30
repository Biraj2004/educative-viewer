"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/edu-viewer/AuthProvider";
import AppNavbar from "@/components/edu-viewer/AppNavbar";
import UserMenu from "@/components/edu-viewer/UserMenu";

function Icon({ d, className }: { d: string; className?: string }) {
  return (
    <svg
      className={className ?? "w-4 h-4"}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={d} />
    </svg>
  );
}

const ShieldAlertIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <path d="M12 8v4" />
    <path d="M12 16h.01" />
  </svg>
);

const UsersIcon = ({ className }: { className?: string }) => (
  <Icon
    d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm14 14v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"
    className={className}
  />
);

const SettingsIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="3"></circle>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
  </svg>
);

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [countdown, setCountdown] = useState(3);

  // If not admin, countdown to redirect
  useEffect(() => {
    let timer: number;
    if (user && user.role !== "admin") {
      timer = window.setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            router.replace("/dashboard");
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [user, router]);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="w-6 h-6 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" />
      </div>
    );
  }

  // Not an Admin state
  if (user.role !== "admin") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gray-50 dark:bg-gray-950">
        <div className="max-w-md w-full text-center space-y-8 flex flex-col items-center animate-in fade-in zoom-in duration-500">
          <div className="relative">
            <div className="absolute inset-0 bg-red-500/20 rounded-full blur-xl animate-pulse" />
            <div className="relative w-24 h-24 bg-linear-to-br from-red-500 to-rose-600 rounded-full flex items-center justify-center shadow-lg transform transition-transform hover:scale-105 duration-300">
              <ShieldAlertIcon className="w-12 h-12 text-white" />
            </div>
          </div>

          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-gray-100">
              Access Denied
            </h1>
            <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">
              This area is restricted to administrators only. Your current role is{" "}
              <span className="font-semibold text-gray-900 dark:text-gray-100 capitalize">{user.role}</span>.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 w-full justify-center">
            <button
              onClick={() => router.push("/dashboard")}
              className="px-6 py-3 rounded-xl bg-gray-900 hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-100 dark:text-gray-900 text-white text-sm font-semibold transition-all shadow-md hover:shadow-lg transform active:scale-95"
            >
              Back to Dashboard
            </button>
            <button
              onClick={() => router.push("/")}
              className="px-6 py-3 rounded-xl bg-white hover:bg-gray-50 dark:bg-gray-900 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 text-sm font-semibold transition-all shadow-sm hover:shadow-md transform active:scale-95"
            >
              Back to Home
            </button>
          </div>

          <div className="text-xs text-gray-500 dark:text-gray-500 mt-8 flex items-center gap-2">
            <div className="w-3 h-3 border border-gray-400 dark:border-gray-600 border-t-transparent rounded-full animate-spin" />
            Redirecting automatically in <span className="font-bold">{countdown}</span> seconds...
          </div>
        </div>
      </div>
    );
  }

  // Admin Dashboard State
  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-950">
      <AppNavbar crumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Admin" }]} actions={<UserMenu />} />

      <main className="flex-1 container mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12 max-w-7xl">
        <div className="mb-10 animate-in slide-in-from-bottom-2 fade-in duration-500">
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
            Admin Center
          </h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 max-w-2xl">
            Welcome, <span className="font-semibold">{user.name || "Admin"}</span>. Manage your platform settings, users, and global configurations here.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* User Management Card */}
          <Link href="/dashboard/admin/users" className="group block animate-in slide-in-from-bottom-4 fade-in duration-700">
            <div className="h-full relative overflow-hidden bg-white dark:bg-gray-900/50 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 transition-all duration-300 hover:shadow-xl hover:shadow-indigo-500/10 dark:hover:shadow-indigo-500/5 hover:-translate-y-1 hover:bg-gray-50 dark:hover:bg-gray-800">
              <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-5 transition-opacity duration-300 transform group-hover:scale-110">
                <UsersIcon className="w-32 h-32 text-indigo-600 dark:text-indigo-400" />
              </div>
              
              <div className="flex items-center gap-4 mb-4 relative z-10">
                <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center transition-transform group-hover:scale-110 duration-300">
                  <UsersIcon className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                </div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">User Management</h2>
              </div>
              
              <p className="text-sm text-gray-600 dark:text-gray-400 relative z-10 mb-6">
                View, create, edit, or delete user accounts. Check two-factor authentication compliance and reset temporary passwords.
              </p>

              <div className="flex items-center text-sm font-semibold text-indigo-600 dark:text-indigo-400 relative z-10 group-hover:translate-x-1 transition-transform duration-300">
                Manage Users
                <svg className="ml-2 w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </div>
            </div>
          </Link>

          {/* Settings Placeholder Card */}
          <div className="opacity-60 cursor-not-allowed group block animate-in slide-in-from-bottom-4 fade-in duration-700 delay-100">
            <div className="h-full relative overflow-hidden bg-white dark:bg-gray-900/50 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 transition-all duration-300">
              <div className="absolute top-0 right-0 p-4 opacity-5 transition-opacity duration-300">
                <SettingsIcon className="w-32 h-32 text-gray-600 dark:text-gray-400" />
              </div>
              
              <div className="flex items-center gap-4 mb-4 relative z-10">
                <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                  <SettingsIcon className="w-6 h-6 text-gray-500 dark:text-gray-400" />
                </div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Global Settings</h2>
              </div>
              
              <p className="text-sm text-gray-600 dark:text-gray-400 relative z-10 mb-6">
                Configure global platform preferences, authentication policies, and UI themes.
              </p>

              <div className="flex items-center text-sm font-semibold text-gray-500 dark:text-gray-500 relative z-10">
                Coming Soon
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
