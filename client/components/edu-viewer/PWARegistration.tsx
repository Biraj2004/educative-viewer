"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export default function PWARegistration() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [showIosPrompt, setShowIosPrompt] = useState(false);

  useEffect(() => {
    // 1. Register service worker
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      const registerSW = async () => {
        try {
          if (document.readyState === "complete") {
            await navigator.serviceWorker.register("/sw.js");
            console.log("[PWA] Service Worker registered.");
          } else {
            window.addEventListener("load", async () => {
              await navigator.serviceWorker.register("/sw.js");
              console.log("[PWA] Service Worker registered on load.");
            });
          }
        } catch (err) {
          console.error("[PWA] Service Worker registration failed:", err);
        }
      };
      registerSW();
    }

    // 2. Check standalone mode (already installed / running as app)
    if (typeof window !== "undefined") {
      const isStandalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        (navigator as Navigator & { standalone?: boolean }).standalone;

      if (isStandalone) {
        return; // No need to show install prompt
      }

      // Check if dismissed previously
      const isDismissed = localStorage.getItem("ev_pwa_dismissed") === "true";
      if (isDismissed) {
        return;
      }

      // 3. Detect iOS / iPadOS
      const userAgent = navigator.userAgent;
      const isIosDevice =
        /iPad|iPhone|iPod/.test(userAgent) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

      if (isIosDevice) {
        // Show iOS instruction prompt after a short delay
        const timer = setTimeout(() => {
          setShowIosPrompt(true);
        }, 5000);
        return () => clearTimeout(timer);
      } else {
        // 4. Listen for beforeinstallprompt for Android/Chrome/Edge/Windows
        const handleBeforeInstallPrompt = (e: Event) => {
          e.preventDefault();
          setDeferredPrompt(e as BeforeInstallPromptEvent);
          const timer = setTimeout(() => {
            setShowInstallPrompt(true);
          }, 5000);
          return () => clearTimeout(timer);
        };

        window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
        return () => {
          window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
        };
      }
    }
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    setShowInstallPrompt(false);
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`[PWA] User choice outcome: ${outcome}`);
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    localStorage.setItem("ev_pwa_dismissed", "true");
    setShowInstallPrompt(false);
    setShowIosPrompt(false);
  };

  const visible = showInstallPrompt || showIosPrompt;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-[9999] p-5 rounded-2xl border bg-white/90 dark:bg-[#090d16]/90 border-gray-200/50 dark:border-white/10 shadow-2xl backdrop-blur-xl flex flex-col gap-4 text-gray-900 dark:text-gray-100"
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 dark:bg-indigo-500/20 border border-indigo-500/20 dark:border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                <svg
                  className="w-5 h-5 animate-pulse"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-bold tracking-tight">Install Edu-Viewer PRO</h3>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-normal">
                  Add to your home screen for a standalone experience with drawing pads & offline learning.
                </p>
              </div>
            </div>
            <button
              onClick={handleDismiss}
              className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors cursor-pointer"
              aria-label="Dismiss"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Android/Desktop Direct Install Button */}
          {showInstallPrompt && (
            <div className="flex flex-col gap-2">
              <button
                onClick={handleInstallClick}
                className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 shadow-md shadow-indigo-600/20 hover:shadow-indigo-500/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Install Application
              </button>
            </div>
          )}

          {/* iOS/iPad Touch/Share Instructions */}
          {showIosPrompt && (
            <div className="bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100/50 dark:border-indigo-950/50 rounded-xl p-3.5 text-xs text-gray-600 dark:text-gray-300 leading-relaxed flex flex-col gap-2">
              <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                To install on iPad or iPhone:
              </span>
              <ol className="list-decimal pl-4 space-y-1.5 text-gray-500 dark:text-gray-400">
                <li className="flex items-center gap-1.5 flex-wrap">
                  Tap the <span className="font-semibold text-gray-800 dark:text-gray-200">Share</span> button
                  <span className="inline-flex p-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-sm">
                    <svg className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 12v6a2 2 0 002 2h12a2 2 0 002-2v-6M12 3v13m0-13L8 7m4-4l4 4" />
                    </svg>
                  </span>
                  in Safari.
                </li>
                <li className="flex items-center gap-1.5 flex-wrap">
                  Scroll down and choose <span className="font-semibold text-gray-800 dark:text-gray-200">Add to Home Screen</span>
                  <span className="inline-flex p-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded shadow-sm">
                    <svg className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                  </span>.
                </li>
              </ol>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
