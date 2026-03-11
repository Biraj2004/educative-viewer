"use client";

interface ComponentBadgeProps {
  componentName: string;
  subType?: string;
}

/**
 * Floating badge anchored at the top-right of a `position: relative` parent.
 * Shows a small, styled info icon at rest; reveals a monospaced tooltip with
 * the component name (and optional sub-type) on hover.
 */
export default function ComponentBadge({ componentName, subType }: ComponentBadgeProps) {
  const label = subType ? `${componentName} - ${subType}` : componentName;

  return (
    <span className="group/badge absolute top-2 -right-5 z-15 inline-flex flex-col items-end cursor-pointer">

      {/* ── Tooltip bubble ── appears ABOVE the icon, never overlaps content ── */}
      <span
        role="tooltip"
        className="
          flex flex-col items-end mb-1.5
          opacity-0 group-hover/badge:opacity-100
          translate-y-1 group-hover/badge:translate-y-0
          transition-all duration-200 ease-out
          pointer-events-none select-none
        "
      >
        {/* Label pill */}
        <span className="
          rounded-md px-2 py-1
          text-[11px] font-mono font-medium leading-none whitespace-nowrap
          bg-gray-900 text-gray-100
          dark:bg-gray-50 dark:text-gray-900
          ring-1 ring-inset ring-white/10 dark:ring-gray-900/10
          shadow-lg
        ">
          {label}
        </span>

        {/* Downward-pointing caret — aligns with center of icon below */}
        <span className="
          block w-0 h-0 mr-1.5
          border-l-4 border-r-4 border-t-4
          border-l-transparent border-r-transparent
          border-t-gray-900 dark:border-t-gray-50
        " />
      </span>

      {/* ── Trigger icon ── info circle ───────────────────────────────────── */}
      <span
        aria-label={`Component: ${label}`}
        className="
          flex h-5 w-5 items-center justify-center rounded-full
          border border-gray-400 dark:border-gray-500
          bg-white dark:bg-gray-900
          text-gray-500 dark:text-gray-400
          opacity-65 group-hover/badge:opacity-100
          shadow-sm group-hover/badge:shadow-md
          group-hover/badge:border-indigo-400 dark:group-hover/badge:border-indigo-500
          group-hover/badge:text-indigo-500 dark:group-hover/badge:text-indigo-400
          transition-all duration-200
        "
      >
        <svg className="h-3 w-3" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0zm.93 6.588-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533zM8 5.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2z" />
        </svg>
      </span>
    </span>
  );
}
