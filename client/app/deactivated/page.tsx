"use client";

import React from "react";
import AppNavbar from "@/components/edu-viewer/AppNavbar";

// ─── Icons ────────────────────────────────────────────────────────────────────

function IconShieldAlert() {
  return (
    <svg className="w-12 h-12 text-rose-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
      <path d="M12 8v4" />
      <path d="M12 16h.01" />
    </svg>
  );
}

function IconMail() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DeactivatedPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 flex flex-col font-sans text-gray-900 dark:text-gray-100">
      <AppNavbar crumbs={[{ label: "Access Restricted" }]} backHref="/auth" backLabel="Sign In" />

      <main className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-2xl w-full text-center space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-700">
          
          <div className="relative inline-block">
            <div className="absolute inset-0 bg-rose-500/20 blur-3xl rounded-full scale-150" />
            <div className="relative w-24 h-24 bg-rose-50 dark:bg-rose-500/10 rounded-full flex items-center justify-center mx-auto border border-rose-100 dark:border-rose-500/20 shadow-xl">
              <IconShieldAlert />
            </div>
          </div>

          <div className="space-y-4">
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-gray-900 dark:text-white">
              Access <span className="text-rose-500">Removed</span>
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-400 max-w-lg mx-auto leading-relaxed">
              Your account has been deactivated by an administrator. This happens due to violations, maintenance, or security concerns.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4 max-w-md mx-auto">
            <div className="p-5 rounded-2xl border border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 text-left space-y-2">
              <h3 className="font-bold text-gray-900 dark:text-white">Why was I removed?</h3>
              <p className="text-sm text-gray-500 dark:text-gray-500 leading-relaxed">
                Accounts are periodically reviewed. If you believe this is a mistake, please reach out to us.
              </p>
            </div>
            <div className="p-5 rounded-2xl border border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 text-left space-y-2">
              <h3 className="font-bold text-gray-900 dark:text-white">Regain Access</h3>
              <p className="text-sm text-gray-500 dark:text-gray-500 leading-relaxed">
                You can appeal this decision by submitting a contact request with your account details.
              </p>
            </div>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button 
              onClick={() => window.location.href = "/contact"}
              className="w-full sm:w-auto px-8 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-950 rounded-xl font-bold transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
            >
              <IconMail />
              Contact Administration
            </button>
            <button 
              onClick={() => window.location.href = "/auth"}
              className="w-full sm:w-auto px-8 py-3 bg-white dark:bg-gray-900 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-800 rounded-xl font-bold transition-all hover:border-gray-300 dark:hover:border-gray-700 active:scale-95 cursor-pointer"
            >
              Back to Sign In
            </button>
          </div>

        </div>
      </main>

      <footer className="py-4 border-t border-gray-100 dark:border-gray-900 text-center">
        <p className="text-xs text-gray-400 dark:text-gray-600 font-medium tracking-widest uppercase">
          Edu-Viewer PRO Security Enforcement
        </p>
      </footer>
    </div>
  );
}
