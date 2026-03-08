"use client";

import { useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

function SearchIcon() {
  return (
    <svg
      className="w-4 h-4 text-gray-400 dark:text-gray-500 pointer-events-none"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  );
}

function ClearIcon() {
  return (
    <svg
      className="w-3.5 h-3.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

interface Props {
  initialValue?: string;
  placeholder?: string;
  totalCount?: number;
  filteredCount?: number;
}

export default function CourseSearchInput({
  initialValue = "",
  placeholder = "Search courses…",
  totalCount,
  filteredCount,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(initialValue);
  const [, startTransition] = useTransition();

  function update(val: string) {
    setValue(val);
    const params = new URLSearchParams(searchParams.toString());
    if (val.trim()) {
      params.set("q", val);
    } else {
      params.delete("q");
    }
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`);
    });
  }

  const isFiltered = value.trim().length > 0;

  return (
    <div className="w-full max-w-xl mx-auto">
      <div className="relative">
        {/* Search icon */}
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2">
          <SearchIcon />
        </span>

        <input
          type="text"
          value={value}
          onChange={(e) => update(e.target.value)}
          placeholder={placeholder}
          className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 dark:focus:border-indigo-600 shadow-sm transition-all"
        />

        {/* Clear button */}
        {isFiltered && (
          <button
            onClick={() => update("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
            aria-label="Clear search"
          >
            <ClearIcon />
          </button>
        )}
      </div>

      {/* Result hint */}
      {isFiltered && totalCount !== undefined && filteredCount !== undefined && (
        <p className="mt-2 text-xs text-center text-gray-400 dark:text-gray-600">
          {filteredCount === 0 ? (
            <span className="text-gray-500 dark:text-gray-400">
              No courses matched &ldquo;{value}&rdquo;
            </span>
          ) : (
            <>
              <span className="font-medium text-indigo-600 dark:text-indigo-400">{filteredCount}</span>
              {" of "}
              <span className="font-medium">{totalCount}</span>
              {" courses"}
            </>
          )}
        </p>
      )}
    </div>
  );
}
