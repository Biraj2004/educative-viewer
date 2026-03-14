"use client";

import React, { useState } from "react";
import { getRenderer } from "@/utils/component-registry";

export interface AdaptiveComp {
  type: string;
  content: Record<string, unknown>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export interface AdaptiveTab {
  id: string;
  name: string;
  parentId: string;
  comps: AdaptiveComp[];
}

export interface AdaptiveData {
  comp_id: string;
  version?: number;
  children?: {
    [key: string]: string[];
  };
  tabs: {
    [key: string]: AdaptiveTab;
  };
}

export default function Adaptive({ data }: { data: AdaptiveData }) {
  // Determine which tabs to show. Educative's "children" maps parent tabs to sub-tabs.
  // Generally, "defaultTab" holds the root-level tabs to display.
  const rootTabsIds = data.children?.["defaultTab"] || [];
  
  // If there are no root tabs IDs specifeid, fallback to all non-defaultTab keys
  const availableTabIds = rootTabsIds.length > 0 
    ? rootTabsIds 
    : Object.keys(data.tabs).filter(id => id !== "defaultTab");

  const [activeTabId, setActiveTabId] = useState<string>(availableTabIds[0] || "");

  if (availableTabIds.length === 0) {
    return (
      <div className="w-full rounded-xl border border-gray-200 dark:border-gray-800 p-6 flex justify-center text-sm text-gray-500 italic bg-gray-50 dark:bg-gray-950">
        No content available.
      </div>
    );
  }

  const activeTab = data.tabs[activeTabId];

  return (
    <div className="w-full max-w-5xl mx-auto rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden bg-white dark:bg-gray-900 shadow-sm font-sans flex flex-col my-6">
      
      {/* Tab Navigation (only show if there's more than one tab to switch to or if the only tab has a meaningful name) */}
      {!(availableTabIds.length === 1 && !data.tabs[availableTabIds[0]]?.name) && (
        <div className="flex border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-[#0f172a] overflow-x-auto">
          {availableTabIds.map((tabId) => {
            const tab = data.tabs[tabId];
            const isActive = activeTabId === tabId;
            return (
              <button
                key={tabId}
                onClick={() => setActiveTabId(tabId)}
                className={`flex items-center gap-2 px-6 py-3 text-sm font-semibold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                  isActive
                    ? "border-indigo-500 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-gray-900"
                    : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800/50"
                }`}
              >
                {/* Fallback to Tab 1, Tab 2 if name is somehow missing but we decided to render the bar */}
                {tab?.name || "Tab"}
              </button>
            );
          })}
        </div>
      )}

      {/* Tab Content Rendering */}
      <div className="flex-1 flex flex-col p-6 space-y-6">
        {activeTab?.comps?.length > 0 ? (
          activeTab.comps.map((comp, idx) => {
            const Renderer = getRenderer(comp.type);
            if (!Renderer) {
              return (
                <div key={idx} className="p-4 rounded-md bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400 text-sm italic border border-red-200 dark:border-red-900/30">
                  Unsupported inner component: {comp.type}
                </div>
              );
            }
            return (
              <div key={idx} className="w-full">
                <Renderer {...(comp.content as Record<string, unknown>)} data={comp.content} />
              </div>
            );
          })
        ) : (
          <div className="text-sm text-gray-400 italic text-center py-4">
            This tab has no content.
          </div>
        )}
      </div>

    </div>
  );
}
