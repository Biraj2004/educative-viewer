"use client";

export interface WorkPreviewData {
  comp_id: string;
  courseUrl: string;
  ctaText?: string;
  isCopied?: boolean;
  title?: string;
  version?: string;
}

// ─── Static mock metadata ─────────────────────────────────────────────────────
// The real Educative platform fetches course metadata from an API.
// We derive reasonable display values from what's available in the JSON
// and fall back to safe static placeholders for stats.

const STATIC_STATS = [
  {
    icon: <ClockIcon />,
    label: "15hrs",
  },
  {
    icon: <LevelIcon />,
    label: "Intermediate",
  },
  {
    icon: <ChallengeIcon />,
    label: "115 Challenges",
  },
  {
    icon: <QuizIcon />,
    label: "8 Quizzes",
  },
];

export default function WorkPreview({ data }: { data: WorkPreviewData }) {
  const title = data.title ?? "Untitled Course";
  const ctaText = data.ctaText ?? "Preview";
  const courseUrl = data.courseUrl ?? "#";

  // Derive a short description from the title — matches Educative's excerpt style.
  const description =
    "If you're a software engineer looking to add machine learning to your skillset, this is the place to start.";

  return (
    <div className="w-full py-4 px-2 font-sans">
      {/* Section heading */}
      <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4 leading-snug">
        {title}
      </h2>

      {/* Card */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden shadow-sm">
        {/* Top row: thumbnail + text */}
        <div className="flex gap-5 p-5">
          {/* Thumbnail */}
          <div className="shrink-0 w-44 h-28 rounded-lg overflow-hidden bg-[#1e1453] flex items-center justify-center">
            <CourseThumbnail />
          </div>

          {/* Text */}
          <div className="flex flex-col gap-1.5 min-w-0">
            <p className="text-base font-semibold text-gray-900 dark:text-gray-100 leading-snug line-clamp-2">
              {title}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed line-clamp-3">
              {description}
            </p>
            <span className="text-sm text-gray-400 dark:text-gray-500">…</span>
          </div>
        </div>

        {/* Bottom row: stats + CTA */}
        <div className="flex items-center justify-between gap-4 px-5 pb-5 flex-wrap">
          {/* Stats */}
          <div className="flex items-center gap-5 flex-wrap">
            {STATIC_STATS.map(({ icon, label }) => (
              <div key={label} className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
                {icon}
                <span>{label}</span>
              </div>
            ))}
          </div>

          {/* CTA button */}
          <a
            href={courseUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 transition-colors text-white text-sm font-semibold shadow-sm"
          >
            {ctaText}
          </a>
        </div>
      </div>
    </div>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function ClockIcon() {
  return (
    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
    </svg>
  );
}

function LevelIcon() {
  return (
    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="5" cy="12" r="2.5" />
      <circle cx="12" cy="12" r="2.5" />
      <circle cx="19" cy="12" r="2.5" opacity={0.35} />
    </svg>
  );
}

function ChallengeIcon() {
  return (
    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3h12v5l-6 4-6-4V3z" />
      <path d="M6 21h12v-5l-6-4-6 4v5z" />
    </svg>
  );
}

function QuizIcon() {
  return (
    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M9 9h6M9 12h6M9 15h4" />
    </svg>
  );
}

// ─── Course thumbnail SVG (matches the neural-network style in the screenshot) ─

function CourseThumbnail() {
  return (
    <svg viewBox="0 0 180 112" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
      {/* Background */}
      <rect width="180" height="112" fill="#1e1453" />

      {/* Glow blobs */}
      <ellipse cx="90" cy="56" rx="55" ry="45" fill="url(#glowGrad)" opacity="0.6" />

      {/* Network edges */}
      <g stroke="#a78bfa" strokeWidth="1.2" opacity="0.7">
        <line x1="58" y1="38" x2="90" y2="28" />
        <line x1="58" y1="38" x2="72" y2="56" />
        <line x1="58" y1="38" x2="68" y2="74" />
        <line x1="90" y1="28" x2="112" y2="38" />
        <line x1="90" y1="28" x2="108" y2="56" />
        <line x1="72" y1="56" x2="108" y2="56" />
        <line x1="72" y1="56" x2="112" y2="38" />
        <line x1="68" y1="74" x2="108" y2="56" />
        <line x1="68" y1="74" x2="112" y2="74" />
        <line x1="108" y1="56" x2="122" y2="56" />
        <line x1="112" y1="38" x2="122" y2="38" />
        <line x1="112" y1="74" x2="122" y2="74" />
      </g>

      {/* Nodes */}
      <g>
        <circle cx="58" cy="38" r="5" fill="#f59e0b" />
        <circle cx="90" cy="28" r="5" fill="#34d399" />
        <circle cx="72" cy="56" r="5" fill="#60a5fa" />
        <circle cx="68" cy="74" r="5" fill="#f472b6" />
        <circle cx="108" cy="56" r="5" fill="#a78bfa" />
        <circle cx="112" cy="38" r="5" fill="#34d399" />
        <circle cx="112" cy="74" r="5" fill="#f59e0b" />
        <circle cx="122" cy="38" r="4" fill="#60a5fa" />
        <circle cx="122" cy="56" r="4" fill="#f472b6" />
        <circle cx="122" cy="74" r="4" fill="#34d399" />
      </g>

      {/* Brain outline arcs */}
      <path
        d="M58 70 Q42 60 46 44 Q50 30 62 28 Q72 14 88 20 Q102 12 116 26 Q130 30 128 46 Q134 62 120 72 Q110 84 96 80 Q82 90 68 82 Q56 80 58 70Z"
        fill="none"
        stroke="#c4b5fd"
        strokeWidth="1.5"
        opacity="0.4"
      />

      <defs>
        <radialGradient id="glowGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#1e1453" stopOpacity="0" />
        </radialGradient>
      </defs>
    </svg>
  );
}
