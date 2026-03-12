"use client";

import { useEffect, useRef, useState } from "react";

// Phase-based CSS animation:
//   starting   → width 0%,   no transition  (DOM paints before transition fires)
//   running    → width 82%,  slow ease-out  (indeterminate feel while loading)
//   completing → width 100%, quick ease-in  (loading finished)
//   fading     → opacity 0,  short fade-out
//   hidden     → nothing rendered

type Phase = "hidden" | "starting" | "running" | "completing" | "fading";

const STYLES: Record<Phase, React.CSSProperties> = {
  hidden:     { width: "0%",   opacity: 1, transition: "none" },
  starting:   { width: "0%",   opacity: 1, transition: "none" },
  running:    { width: "82%",  opacity: 1, transition: "width 2s cubic-bezier(0.05, 0.8, 0.1, 1)" },
  completing: { width: "100%", opacity: 1, transition: "width 0.22s ease-in" },
  fading:     { width: "100%", opacity: 0, transition: "opacity 0.35s ease-in" },
};

/**
 * Listens to global `navprogress:start` / `navprogress:done` window events
 * dispatched by NavigationEvents (anchor clicks) and TopicLayoutClient
 * (in-page topic fetches). No props needed — fully self-contained.
 */
export default function NavProgressBar() {
  const [phase, setPhase] = useState<Phase>("hidden");
  const raf       = useRef<number>(0);
  const timers    = useRef<ReturnType<typeof setTimeout>[]>([]);
  const wasActive = useRef(false);

  useEffect(() => {
    const clearAll = () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
      cancelAnimationFrame(raf.current);
    };

    const onDone = () => {
      if (!wasActive.current) return;
      wasActive.current = false;
      clearAll();
      // Defer to avoid synchronous setState within an event handler
      const t0 = setTimeout(() => {
        setPhase("completing");
        const t1 = setTimeout(() => {
          setPhase("fading");
          const t2 = setTimeout(() => setPhase("hidden"), 370);
          timers.current.push(t2);
        }, 220);
        timers.current.push(t1);
      }, 0);
      timers.current.push(t0);
    };

    const onStart = () => {
      wasActive.current = true;
      clearAll();
      // Safety: force-complete after 10s if navprogress:done never arrives
      timers.current.push(setTimeout(onDone, 10_000));
      // Two rAF frames ensure the browser paints width:0 before the slow transition begins
      raf.current = requestAnimationFrame(() => {
        setPhase("starting");
        raf.current = requestAnimationFrame(() => setPhase("running"));
      });
    };

    window.addEventListener("navprogress:start", onStart);
    window.addEventListener("navprogress:done", onDone);
    return () => {
      window.removeEventListener("navprogress:start", onStart);
      window.removeEventListener("navprogress:done", onDone);
      clearAll();
    };
  }, []);

  if (phase === "hidden") return null;

  return (
    <div className="fixed top-14 left-0 right-0 z-[21] h-[2.5px] pointer-events-none overflow-hidden">
      <div
        style={STYLES[phase]}
        className="absolute inset-y-0 left-0 bg-indigo-500 dark:bg-indigo-400"
      />
    </div>
  );
}
