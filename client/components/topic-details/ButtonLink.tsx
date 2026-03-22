"use client";

import React, { useState } from "react";
import { getAuthToken } from "@/utils/authClient";
import { getBackendApiBase } from "@/utils/runtime-config";

export interface ButtonLinkData {
  comp_id: string;
  buttonText: string;
  buttonType: "Primary" | "Default" | string;
  url: string;
  loginRequired?: boolean;
}

export default function ButtonLink({ data }: { data: ButtonLinkData }) {
  const isPrimary = data.buttonType === "Primary";
  const [loading, setLoading] = useState(false);

  const handleClick = async (e: React.MouseEvent<HTMLAnchorElement>) => {
    // If it's an API route for download, handle it via fetch to inject Auth Headers
    if (data.url.startsWith("/api")) {
      e.preventDefault();
      if (loading) return;
      setLoading(true);

      try {
        const token = getAuthToken();
        const headers: Record<string, string> = {};
        if (token) headers["Authorization"] = `Bearer ${token}`;

        // Fallback to absolute backend URL if needed, depending on mapping
        const backendBase = getBackendApiBase();
        const targetUrl = data.url.startsWith("/") ? `${backendBase}${data.url}` : data.url;

        const res = await fetch(targetUrl, { headers });
        if (!res.ok) throw new Error("API request failed");

        const blob = await res.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = blobUrl;
        
        let filename = "download.pdf";
        const disposition = res.headers.get("Content-Disposition");
        if (disposition && disposition.includes("filename=")) {
          filename = disposition.split("filename=")[1].replace(/"/g, "");
        } else {
          const parts = data.url.split("/");
          const last = parts.pop();
          if (last && last !== "download") filename = last;
        }

        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(blobUrl);
        document.body.removeChild(a);
      } catch (err) {
        console.error("ButtonLink download error:", err);
        // Fallback if fetch fails (e.g. CORS issues, missing proxy)
        window.open(data.url, "_blank");
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="w-full flex justify-center py-4">
      <a
        href={data.url}
        onClick={handleClick}
        target="_blank"
        rel="noopener noreferrer"
        className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-colors duration-200 shadow-sm border flex items-center justify-center gap-2 ${
          loading ? "opacity-75 cursor-wait" : "cursor-pointer"
        } ${
          isPrimary
            ? "bg-indigo-600 text-white hover:bg-indigo-700 border-indigo-700 dark:border-indigo-500"
            : "bg-white text-gray-700 hover:bg-gray-50 border-gray-300 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700 dark:hover:bg-gray-700"
        }`}
      >
        {loading ? "Processing..." : data.buttonText}
        {data.loginRequired && !loading && (
          <span className="inline-flex items-center opacity-75" title="Login Required">
            <LockIcon />
          </span>
        )}
      </a>
    </div>
  );
}

function LockIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  );
}
