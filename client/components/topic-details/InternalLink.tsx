"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authenticatedFetch } from "@/utils/authClient";
import { getBackendApiBase } from "@/utils/runtime-config";

export default function InternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    
    if (loading) return;
    setLoading(true);

    try {
      const BACKEND = getBackendApiBase();
      
      const res = await authenticatedFetch(`${BACKEND}/api/resolve-link?url=${encodeURIComponent(href)}`);

      if (res.ok) {
        const data = await res.json();
        if (data.resolved && data.path) {
          router.push(data.path);
          return;
        }
      }
      
      // Fallback: If API fails or course not resolved locally, open it in a new tab
      let targetHref = href;
      if (href.startsWith("/answers/") || href.startsWith("/blog/") || href.startsWith("/newsletter/")) {
        targetHref = `https://www.educative.io${href}`;
      }
      window.open(targetHref, "_blank");
    } catch (err) {
      console.error("Failed to resolve link", err);
      let targetHref = href;
      if (href.startsWith("/answers/") || href.startsWith("/blog/") || href.startsWith("/newsletter/")) {
        targetHref = `https://www.educative.io${href}`;
      }
      window.open(targetHref, "_blank");
    } finally {
      setLoading(false);
    }
  }

  return (
    <a 
      href={href} 
      onClick={handleClick} 
      className={`text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline transition-colors ${loading ? "opacity-50 cursor-wait" : "cursor-pointer"}`}
      title={href}
    >
      {children}
    </a>
  );
}
