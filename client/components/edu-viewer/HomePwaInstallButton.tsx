"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";

export default function HomePwaInstallButton() {
  const [isInstallable, setIsInstallable] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const isStandalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        (navigator as Navigator & { standalone?: boolean }).standalone;

      if (!isStandalone) {
        setTimeout(() => setIsInstallable(true), 0);
      }
    }
  }, []);

  if (!isInstallable) return null;

  const handleInstall = () => {
    console.log("[PWA] Install button clicked. Dispatching trigger-pwa-install event.");
    window.dispatchEvent(new CustomEvent("trigger-pwa-install"));
  };

  return (
    <button
      onClick={handleInstall}
      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/80 dark:bg-gray-900/60 backdrop-blur-md border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 text-sm font-semibold hover:border-indigo-500 dark:hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all hover:scale-105 active:scale-95 duration-200 transform shadow-sm cursor-pointer"
    >
      <Download className="w-4.5 h-4.5 text-indigo-500" />
      Install App
    </button>
  );
}
