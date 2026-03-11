import Link from "next/link";
import AppNavbar from "@/components/AppNavbar";
import {
  HomeAuthProvider,
  HomeNavSignIn,
  HomeHeroCTA,
  HomeBottomCTA,
} from "@/components/HomeAuthSection";

// ─── Icons ────────────────────────────────────────────────────────────────────

function IconCode() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  );
}

function IconQuiz() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <path d="M12 17h.01" />
    </svg>
  );
}

function IconLayers() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  );
}

function IconChevronDown() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function IconExternal() {
  return (
    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const features = [
  {
    Icon: IconCode,
    iconBg: "bg-indigo-50 dark:bg-indigo-950",
    iconColor: "text-indigo-600 dark:text-indigo-400",
    label: "Live Code Execution",
    desc: "Sandpack-powered sandboxes with real-time compilation. React, HTML, and more — write and run code directly in the browser.",
  },
  {
    Icon: IconQuiz,
    iconBg: "bg-violet-50 dark:bg-violet-950",
    iconColor: "text-violet-600 dark:text-violet-400",
    label: "Smart Quizzes & Exercises",
    desc: "Multiple choice, structured Q&A, drag-and-drop permutations, and match-the-answers — all with instant feedback.",
  },
  {
    Icon: IconLayers,
    iconBg: "bg-sky-50 dark:bg-sky-950",
    iconColor: "text-sky-600 dark:text-sky-400",
    label: "Rich Visual Content",
    desc: "Canvas animations, DrawIO diagrams, LaTeX math, tables, spoilers, columns — every content type, rendered natively.",
  },
];

const componentTypes = [
  "Sandpack", "Code Blocks", "LaTeX Math", "Canvas Animation",
  "Draw IO", "Quiz", "Structured Quiz", "Permutation",
  "Match Answers", "Tables", "Spoiler", "Markdown",
  "Columns", "Slate HTML", "InstaCalc", "File Viewer",
  "Educative Array", "API Widget", "Editor Code", "WebpackBin",
];

const stats = [
  { value: "25+", label: "Component Types" },
  { value: "100%", label: "Dark Mode" },
  { value: "0", label: "Setup Required" },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <HomeAuthProvider>
    <div className="h-screen overflow-y-auto bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 no-scrollbar">

      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <AppNavbar actions={<HomeNavSignIn />} />

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-gray-200 dark:border-gray-800">
        {/* Grid backdrop */}
        <div
          className="absolute inset-0 opacity-50 dark:opacity-30"
          style={{
            backgroundImage:
              "linear-gradient(to right, #e5e7eb 1px, transparent 1px), linear-gradient(to bottom, #e5e7eb 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />
        <div
          className="dark:block absolute inset-0 opacity-0 dark:opacity-30"
          style={{
            backgroundImage:
              "linear-gradient(to right, #1f2937 1px, transparent 1px), linear-gradient(to bottom, #1f2937 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />
        {/* Indigo glow */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_55%_at_50%_0%,rgba(99,102,241,0.10),transparent)] dark:bg-[radial-gradient(ellipse_80%_55%_at_50%_0%,rgba(99,102,241,0.18),transparent)]" />

        <div className="relative max-w-5xl mx-auto px-6 py-24 text-center">
          {/* Eyebrow */}
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/80 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-[11px] font-semibold uppercase tracking-wide mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
            Interactive Learning Viewer
          </span>

          {/* Headline */}
          <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight leading-[1.08] text-gray-950 dark:text-white mb-5">
            Explore. Code.
            <br />
            <span className="text-transparent bg-clip-text bg-linear-to-r from-indigo-500 via-violet-500 to-indigo-600 dark:from-indigo-400 dark:via-violet-400 dark:to-sky-400">
              Master.
            </span>
          </h1>

          {/* Sub */}
          <p className="max-w-xl mx-auto text-base text-gray-600 dark:text-gray-400 leading-relaxed mb-10">
            An open-source, power-packed educational content viewer.
            25+ interactive component types — live sandboxes, quizzes,
            diagrams, math, and more. Rendered properly for <span className="underline decoration-wavy decoration-indigo-500 dark:decoration-white/70 decoration-2">better user experience</span>.
          </p>

          {/* CTAs */}
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <HomeHeroCTA />
            <a
              href="#components"
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 text-sm font-medium transition-colors"
            >
              See Components
              <IconChevronDown />
            </a>
          </div>
        </div>
      </section>

      {/* ── Stats ───────────────────────────────────────────────────────── */}
      <div className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/60">
        <div className="max-w-5xl mx-auto px-6 py-5 grid grid-cols-3 divide-x divide-gray-200 dark:divide-gray-800">
          {stats.map(({ value, label }) => (
            <div key={label} className="px-4 text-center">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{value}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Features ────────────────────────────────────────────────────── */}
      <section className="border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-5xl mx-auto px-6 py-16">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white text-center mb-2">
            Built for real learning
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-10">
            Everything your learning content needs, in a single viewer
          </p>
          <div className="grid md:grid-cols-3 gap-5">
            {features.map(({ Icon, iconBg, iconColor, label, desc }) => (
              <div
                key={label}
                className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 hover:shadow-md dark:hover:shadow-gray-950/60 transition-shadow"
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-4 ${iconBg} ${iconColor}`}>
                  <Icon />
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-white text-sm mb-2">{label}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Component Types ─────────────────────────────────────────────── */}
      <section id="components" className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/60">
        <div className="max-w-5xl mx-auto px-6 py-16">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white text-center mb-2">
            Everything in one place
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-10">
            Every content type from the educative.io platform, rendered natively
          </p>
          <div className="flex flex-wrap justify-center gap-2.5">
            {componentTypes.map((name) => (
              <span
                key={name}
                className="inline-flex items-center px-3.5 py-1.5 rounded-full text-xs font-medium border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:border-indigo-400 dark:hover:border-indigo-600 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors cursor-default select-none"
              >
                {name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────────────────── */}
      <section className="border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-5xl mx-auto px-6 py-20 text-center">
          <HomeBottomCTA />
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="max-w-5xl mx-auto px-6 py-6 flex items-center justify-between text-xs text-gray-400 dark:text-gray-600">
        <span>
          © 2026{" "}
          <strong className="text-gray-600 dark:text-gray-400 font-semibold">
            Edu-Viewer PRO
          </strong>{" "}
          · Open Source · GPL-3.0
        </span>
        <a
          href="https://github.com/Biraj2004/educative-viewer"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 hover:text-gray-600 font-bold dark:hover:text-gray-300 transition-colors"
        >
          GitHub
          <IconExternal />
        </a>
      </footer>

    </div>
    </HomeAuthProvider>
  );
}
