"use client";

/**
 * ActiveToggle
 * ============
 * Admin-only sliding toggle switch for marking a course/path/project
 * as active (visible to users) or inactive (hidden from users).
 *
 * Design: iOS-style pill track with a sliding circle and a label.
 * Renders nothing for non-admin users.
 */

import { useState } from "react";

const BACKEND = (process.env.NEXT_PUBLIC_BACKEND_API_BASE ?? "").replace(/\/$/, "");

type Entity = "course" | "path" | "project";

interface Props {
  entity: Entity;
  entityId: number | string;
  isActive: boolean;
  authToken: string;
  onToggle?: (newValue: boolean) => void;
}

export default function ActiveToggle({
  entity,
  entityId,
  isActive,
  authToken,
  onToggle,
}: Props) {
  const [active, setActive] = useState(isActive);
  const [pending, setPending] = useState(false);

  async function handleToggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (pending) return;

    const next = !active;
    setActive(next);  // optimistic
    setPending(true);

    try {
      const res = await fetch(`${BACKEND}/api/admin/set-course-status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ entity, id: Number(entityId), is_active: next }),
      });

      if (!res.ok) {
        setActive(!next);  // revert
      } else {
        onToggle?.(next);
      }
    } catch {
      setActive(!next);  // revert on network error
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      aria-label={active ? "Visible to users — click to hide" : "Hidden from users — click to show"}
      title={active ? "Visible to users — click to hide" : "Hidden from users — click to show"}
      onClick={handleToggle}
      disabled={pending}
      className={[
        "group relative inline-flex items-center gap-2 rounded-full px-1.5 py-0.5 text-[10px] font-semibold select-none cursor-pointer transition-all duration-300",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-indigo-500",
        pending ? "cursor-wait" : "",
      ].join(" ")}
      style={{ WebkitTapHighlightColor: "transparent" }}
    >
      {/* Track */}
      <span
        className={[
          "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-all duration-300 ease-in-out",
          "shadow-inner",
          active
            ? "bg-emerald-500 dark:bg-emerald-500 border-emerald-600/30"
            : "bg-gray-300 dark:bg-gray-600 border-gray-400/20 dark:border-gray-500/20",
          pending ? "opacity-70" : "",
        ].join(" ")}
      >
        {/* Sliding thumb */}
        <span
          className={[
            "absolute inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-all duration-300 ease-in-out",
            active ? "translate-x-4.5" : "translate-x-0.5",
            pending ? "animate-pulse" : "",
          ].join(" ")}
          style={{
            boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
          }}
        />
      </span>

      {/* Label */}
      <span
        className={[
          "transition-colors duration-300 uppercase tracking-wider",
          active
            ? "text-emerald-600 dark:text-emerald-400"
            : "text-gray-400 dark:text-gray-500",
        ].join(" ")}
      >
        {active ? "Active" : "Hidden"}
      </span>
    </button>
  );
}
