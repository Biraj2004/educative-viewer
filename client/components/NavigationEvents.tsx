"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * Placed once in the root layout. Intercepts every internal anchor click and
 * signals NavProgressBar to start/stop via lightweight window CustomEvents.
 * Covers: <Link>, <a href="...">, router.push() via anchor delegation.
 */
export default function NavigationEvents() {
  const pathname = usePathname();
  const mounted = useRef(false);

  // Signal "done" whenever the active pathname resolves (route fully rendered)
  useEffect(() => {
    // Skip the very first mount so we don't fire a spurious "done" on page load
    if (!mounted.current) { mounted.current = true; return; }
    window.dispatchEvent(new Event("navprogress:done"));
  }, [pathname]);

  // Intercept all internal anchor clicks (catches every <Link> and plain <a>)
  useEffect(() => {
    const dispatch = () => window.dispatchEvent(new Event("navprogress:start"));

    const onClick = (e: MouseEvent) => {
      // Skip modifier-key combos that open new tabs / trigger browser shortcuts
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const anchor = (e.target as HTMLElement).closest("a");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (
        !href ||
        href.startsWith("http") ||
        href.startsWith("//") ||
        href.startsWith("#") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:")
      ) return;

      dispatch();
    };

    // Browser back/forward toolbar buttons AND mouse side-buttons (all fire popstate)
    const onPopState = () => dispatch();

    document.addEventListener("click", onClick);
    window.addEventListener("popstate", onPopState);
    return () => {
      document.removeEventListener("click", onClick);
      window.removeEventListener("popstate", onPopState);
    };
  }, []);

  return null;
}

/** Helper for programmatic navigations (router.push / router.replace calls). */
export function dispatchNavStart() {
  if (typeof window !== "undefined")
    window.dispatchEvent(new Event("navprogress:start"));
}
