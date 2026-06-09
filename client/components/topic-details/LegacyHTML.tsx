"use client";
import React, { useRef, useEffect } from "react";

export default function LegacyHTML({ data }: { data: any }) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hostRef.current || !data || typeof data.html !== "string") return;

    const host = hostRef.current;

    // Attach or reuse shadow root
    const shadow = host.shadowRoot ?? host.attachShadow({ mode: "open" });

    // Cleanup before re-render
    shadow.innerHTML = "";

    // --- Inject isolation CSS ---
    const style = document.createElement("style");
    style.textContent = `
      /* ---- Hide legacy chrome ---- */
      #sidebar-caret-collapse-2,
      div[aria-label*="Your Privacy"],
      div[class*="ed-grid"] > nav,
      div[id*='view-collection-article-content-root'] > :not(#handleArticleScroll):not(:last-child),
      div[id*='view-collection-article-content-root']:not(:has(#handleArticleScroll)) > :not(:last-child),
      div[aria-labelledby*="simple-modal-title"],
      nav,
      header,
      div[class*="cookie"], 
      div[class*="sticky top-0"],
      div[class*="PALBanner_container"] {
        display: none !important;
      }

      /* ---- Scrollbar hiding ---- */
      ::-webkit-scrollbar { display: none !important; }
      * { -ms-overflow-style: none !important; scrollbar-width: none !important; }

      /* ---- Image / media containment ---- */
      img, svg, video, canvas {
        max-width: 100% !important;
        height: auto !important;
      }

      /* ---- Reset legacy fixed/capped layout wrappers ---- */
      html, body {
        overflow: visible !important;
        height: auto !important;
        min-height: unset !important;
        margin: 0;
        padding: 0;
      }
      
      /* Target all known legacy layout wrappers from the DOM tree */
      :host > div,
      div[id*='view-collection-article-content-root'],
      div[id*='handleArticleScroll'],
      div[class*='content-width'],
      div[class*='custom-default'],
      div[class*='ed-grid-main'],
      div[class*='ed-grid'],
      div[class*='ArticleContent'],
      div[class*='Page'],
      div[class*='Layout'],
      main, article {
        max-width: 100% !important;
        width: 100% !important;
        box-sizing: border-box !important;
        margin-left: 0 !important;
        margin-right: 0 !important;
        padding-left: 0 !important;
        padding-right: 0 !important;
      }
      pre, code {
        max-width: 100% !important;
        overflow-x: auto !important;
      }

    `;
    shadow.appendChild(style);

    // --- Parse and inject legacy HTML ---
    const wrapper = document.createElement("div");
    // Ensure wrapper spans full height to support backgrounds
    wrapper.style.minHeight = "100%";
    wrapper.innerHTML = data.html;
    shadow.appendChild(wrapper);

    // --- Mirror Dark Mode from Host ---
    // Educative's legacy CSS relies on the 'dark' class being present on a parent container.
    // Since innerHTML strips the original <html>/<body> tags, we manually restore it here.
    if (document.documentElement.classList.contains("dark")) {
      wrapper.classList.add("dark");
    }

    const observer = new MutationObserver(() => {
      if (document.documentElement.classList.contains("dark")) {
        wrapper.classList.add("dark");
      } else {
        wrapper.classList.remove("dark");
      }
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    // --- Execute scripts manually (shadow DOM doesn't auto-run them) ---
    wrapper.querySelectorAll("script").forEach((oldScript) => {
      const newScript = document.createElement("script");
      Array.from(oldScript.attributes).forEach((attr) =>
        newScript.setAttribute(attr.name, attr.value)
      );
      newScript.textContent = oldScript.textContent;
      oldScript.replaceWith(newScript);
    });

    return () => {
      observer.disconnect();
    };
  }, [data]);

  if (!data || typeof data.html !== "string") return null;

  return (
    <div
      ref={hostRef}
      className="legacy-html-shadow-host w-full"
      style={{ display: "block" }}
    />
  );
}

