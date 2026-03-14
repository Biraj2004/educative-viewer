"use client";

import { useEffect, useState } from "react";

/**
 * Floating scroll-to-top button.
 * Appears only after the user scrolls down > `threshold` pixels.
 * Clicking smoothly scrolls back to the top of the page.
 */
export default function ScrollToTop({ threshold = 300 }: { threshold?: number }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > threshold);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll(); // set initial state
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);

  if (!visible) return null;

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Scroll to top"
      className={[
        "fixed bottom-6 right-6 z-50",
        "w-10 h-10 rounded-full",
        "bg-indigo-600 hover:bg-indigo-700 active:scale-95",
        "text-white shadow-lg shadow-indigo-500/30",
        "flex items-center justify-center",
        "transition-all duration-200 cursor-pointer",
        "animate-in fade-in slide-in-from-bottom-2",
      ].join(" ")}
    >
      <svg
        className="w-4 h-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m18 15-6-6-6 6" />
      </svg>
    </button>
  );
}
