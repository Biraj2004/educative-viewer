"use client";

import Image from "next/image";
import Link from "next/link";
import AppNavbar from "@/components/edu-viewer/AppNavbar";
import { HomeAuthProvider } from "@/components/edu-viewer/HomeAuthSection";
import { motion, Variants } from "framer-motion";
import {
  ExternalLink,
  Lock,
  Code2,
  Terminal,
  MonitorPlay,
  Video,
  FileText,
  ServerOff,
  Zap,
  Sparkles,
  User,
} from "lucide-react";

function IconGitHub({ className }: { className?: string }) {
  return (
    <svg
      className={className || "w-5 h-5"}
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.699-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.379.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.161 22 16.416 22 12c0-5.523-4.477-10-10-10z"
      />
    </svg>
  );
}

// ─── Animations ─────────────────────────────────────────────────────────────

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.12, delayChildren: 0.05 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 15 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 120, damping: 22 },
  },
};

// ─── Data ──────────────────────────────────────────────────────────────────

const builders = [
  {
    name: "Biraj Sarkar",
    role: "Developer",
    github: "Biraj2004",
    avatar: "https://github.com/Biraj2004.png",
    bio: "Architect of the Edu-Viewer interface and React ecosystem. Responsible for component logic, routing, UI/UX consistency, and core application rendering engines.",
    color: "from-indigo-500 to-violet-500",
    shadowColor: "shadow-indigo-500/10",
    hoverShadow: "hover:shadow-indigo-500/20",
    glowColor: "group-hover:border-indigo-500/40 dark:group-hover:border-indigo-500/30",
    textGradient:
      "from-indigo-500 to-violet-500 dark:from-indigo-400 dark:to-violet-400",
    projects: [
      {
        name: "educative-viewer",
        type: "Public Repository",
        icon: Lock,
        iconColor:
          "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/25 border border-amber-200/50 dark:border-amber-500/20",
        href: "https://github.com/Biraj2004/educative-viewer",
        isCurrent: true,
      },
    ],
  },
  {
    name: "Anilabha Datta",
    role: "Developer",
    github: "anilabhadatta",
    avatar: "https://github.com/anilabhadatta.png",
    bio: "Mastermind behind the data extraction pipeline. Developed the robust scraping engine ensuring seamless content portability into structured JSON formats.",
    color: "from-violet-500 to-fuchsia-500",
    shadowColor: "shadow-violet-500/10",
    hoverShadow: "hover:shadow-violet-500/20",
    glowColor: "group-hover:border-violet-500/40 dark:group-hover:border-violet-500/30",
    textGradient:
      "from-violet-500 to-fuchsia-500 dark:from-violet-400 dark:to-fuchsia-400",
    projects: [
      {
        name: "educative.io_scraper",
        type: "GitHub Repository",
        icon: Code2,
        iconColor:
          "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/25 border border-blue-200/50 dark:border-blue-500/20",
        href: "https://github.com/anilabhadatta/educative.io_scraper",
        isCurrent: false,
      },
    ],
  },
];

const unsupportedComponents = [
  {
    name: "TerminalWidget",
    icon: Terminal,
    description:
      "Requires live, secure SSH connections to backend compute instances. Provisioning remote servers is out of scope for a static viewer.",
  },
  {
    name: "LiveApp",
    icon: ServerOff,
    description:
      "Needs container orchestration (like Kubernetes) to run and expose live server ports dynamically for web applications.",
  },
  {
    name: "ProjectCodeContent",
    icon: Code2,
    description:
      "Demands a full server-side IDE backend to execute and validate code in real-time within an isolated environment.",
  },
  {
    name: "VNC",
    icon: MonitorPlay,
    description:
      "Requires spinning up headless Linux VMs and streaming the desktop environment via WebSockets, which is massively resource-intensive.",
  },
  {
    name: "VideoRecorder",
    icon: Video,
    description:
      "Requires cloud streaming servers and massive storage infrastructure for real-time media encoding and playback.",
  },
  {
    name: "HubspotForm",
    icon: FileText,
    description:
      "A proprietary marketing and CRM integration tool that serves no educational purpose in a standalone open-source viewer.",
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function AboutPage() {
  return (
    <HomeAuthProvider>
      <div className="min-h-screen bg-[#fafafa] dark:bg-[#030712] text-gray-900 dark:text-gray-100 font-sans selection:bg-indigo-500/30 flex flex-col overflow-x-hidden">
        <AppNavbar
          crumbs={[{ label: "About Us" }]}
          backHref="/"
          backLabel="Home"
        />

        {/* ── Hero Section ───────────────────────────────────────────────── */}
        <section className="relative flex flex-col justify-center overflow-hidden border-b border-gray-200/50 dark:border-white/5 pt-24 pb-20">
          {/* Animated Glow Blobs */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(99,102,241,0.12),transparent)] dark:bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(99,102,241,0.22),transparent)] pointer-events-none" />
          
          <div className="absolute top-1/4 left-1/4 w-80 h-80 bg-indigo-500/10 dark:bg-indigo-500/15 rounded-full blur-3xl pointer-events-none animate-pulse" style={{ animationDuration: "7s" }} />
          <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-purple-500/10 dark:bg-purple-500/15 rounded-full blur-3xl pointer-events-none animate-pulse" style={{ animationDuration: "9s", animationDelay: "1.5s" }} />

          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="relative max-w-4xl mx-auto px-6 text-center z-10"
          >
            <motion.div
              variants={itemVariants}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-650 dark:text-indigo-400 text-xs font-bold uppercase tracking-wider mb-6 border border-indigo-500/25"
            >
              <Zap className="w-3.5 h-3.5 text-indigo-500 fill-indigo-500/20" />
              <span>Project Overview</span>
            </motion.div>

            <motion.h1
              variants={itemVariants}
              className="text-4xl sm:text-6xl font-extrabold tracking-tight text-gray-900 dark:text-white mb-6 leading-[1.1]"
            >
              Empowering Devs with <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 dark:from-indigo-400 dark:via-purple-400 dark:to-pink-400">
                Open-Source Learning
              </span>
            </motion.h1>
            <motion.p
              variants={itemVariants}
              className="text-lg sm:text-xl text-gray-650 dark:text-gray-400 max-w-2xl mx-auto leading-relaxed"
            >
              Edu-Viewer PRO is a community-driven open-source initiative
              dedicated to bringing rich, interactive, code-first educational
              content to everyone. Build locally, host seamlessly, and learn
              flawlessly.
            </motion.p>
          </motion.div>
        </section>

        {/* ── Unsupported Components Section ────────────────────────────────────────── */}
        <section className="py-20 border-t border-gray-200/50 dark:border-white/5 relative bg-white/20 dark:bg-gray-950/10">
          <div className="max-w-6xl mx-auto px-6">
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              className="text-center mb-16"
            >
              <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-455 text-xs font-bold uppercase tracking-wider mb-4 border border-rose-200/60 dark:border-rose-500/20">
                <ServerOff className="w-3.5 h-3.5" />
                <span>Architectural Boundaries</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-4 tracking-tight">
                Unsupported Components
              </h2>
              <p className="text-base sm:text-lg text-gray-600 dark:text-gray-450 max-w-3xl mx-auto leading-relaxed">
                While Edu-Viewer PRO faithfully replicates the vast majority of
                the learning experience, certain components from the original
                platform fundamentally require{" "}
                <span className="font-semibold text-gray-800 dark:text-gray-200">
                  heavy, paid cloud infrastructure
                </span>{" "}
                and cannot be replicated in a static, offline-first open-source
                viewer.
              </p>
            </motion.div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {unsupportedComponents.map((item, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  whileHover={{ y: -6, scale: 1.02 }}
                  transition={{ type: "spring", stiffness: 150, damping: 20 }}
                  className="p-6 rounded-3xl border border-gray-200/60 dark:border-white/5 bg-white/60 dark:bg-[#0c101b]/50 backdrop-blur-md shadow-xs hover:shadow-lg hover:border-rose-500/25 dark:hover:border-rose-500/20 transition-all duration-300 group"
                >
                  <div className="flex items-center gap-3.5 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-800/80 flex items-center justify-center shrink-0 text-gray-650 dark:text-gray-400 border border-gray-200/50 dark:border-gray-750/50 group-hover:bg-rose-500/10 group-hover:text-rose-500 dark:group-hover:text-rose-400 group-hover:border-rose-500/20 transition-colors">
                      <item.icon className="w-5 h-5" />
                    </div>
                    <h3 className="font-bold text-gray-900 dark:text-white text-base">
                      {item.name}
                    </h3>
                  </div>
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                    {item.description}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Contributors Section ────────────────────────────────────────── */}
        <section className="py-20 relative flex-1">
          <div className="max-w-5xl mx-auto px-6">
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              className="text-center mb-16"
            >
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-650 dark:text-indigo-400 text-xs font-bold uppercase tracking-wider mb-4 border border-indigo-500/25">
                <User className="w-3.5 h-3.5" />
                <span>The Minds Behind</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-4 tracking-tight">
                Meet the Builders
              </h2>
              <p className="text-base sm:text-lg text-gray-500 dark:text-gray-400 max-w-2xl mx-auto leading-relaxed">
                The core maintainers and visionaries driving the ecosystem
                behind{" "}
                <span className="whitespace-nowrap font-semibold text-gray-700 dark:text-gray-300">
                  Edu-Viewer PRO.
                </span>
              </p>
            </motion.div>

            <motion.div
              variants={containerVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-50px" }}
              className="grid md:grid-cols-2 gap-8"
            >
              {builders.map((col, idx) => (
                <motion.div
                  key={idx}
                  variants={itemVariants}
                  whileHover={{ y: -6 }}
                  className={`flex flex-col group relative rounded-3xl border border-gray-200/50 dark:border-white/5 bg-white/40 dark:bg-[#0c101b]/45 backdrop-blur-xl p-8 shadow-sm hover:shadow-xl transition-all duration-300 ${col.glowColor} ${col.hoverShadow}`}
                >
                  {/* Floating Large GitHub Logo in background */}
                  <div className="absolute top-0 right-0 p-6 opacity-3 group-hover:opacity-[0.07] text-gray-650 dark:text-white transition-opacity duration-300 pointer-events-none">
                    <IconGitHub className="w-24 h-24" />
                  </div>

                  <div className="relative z-10 flex flex-col flex-1">
                    <div className="flex items-center gap-5 mb-6 shrink-0">
                      {/* Avatar with dynamic glow ring */}
                      <div
                        className={`w-16 h-16 rounded-full bg-gradient-to-tr ${col.color} p-[2px] shrink-0 shadow-lg ${col.shadowColor} group-hover:scale-105 transition-transform duration-300`}
                      >
                        <div className="w-full h-full rounded-full bg-white dark:bg-gray-950 flex items-center justify-center overflow-hidden border border-white/5">
                          <Image
                            src={col.avatar}
                            alt={col.name}
                            width={64}
                            height={64}
                            className="object-cover no-dark-invert"
                            unoptimized
                          />
                        </div>
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">
                          {col.name}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          <p
                            className={`text-sm font-bold bg-clip-text text-transparent bg-linear-to-r ${col.textGradient}`}
                          >
                            {col.role}
                          </p>
                          <span className="text-gray-350 dark:text-gray-700 text-[10px]">
                            •
                          </span>
                          <a
                            href={`https://github.com/${col.github}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-400 transition-colors cursor-pointer"
                          >
                            <IconGitHub className="w-3.5 h-3.5" />@{col.github}
                          </a>
                        </div>
                      </div>
                    </div>

                    <p className="text-sm sm:text-base text-gray-600 dark:text-gray-405 leading-relaxed mb-8 flex-1">
                      {col.bio}
                    </p>

                    <div className="space-y-3 mt-auto shrink-0">
                      {col.projects.map((proj, pIdx) => (
                        <a
                          key={pIdx}
                          href={proj.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between group/link p-3.5 rounded-2xl bg-white/60 dark:bg-gray-950/40 border border-gray-200/50 dark:border-white/5 hover:bg-white dark:hover:bg-gray-900 hover:border-indigo-300/60 dark:hover:border-indigo-500/25 transition-all cursor-pointer shadow-xs shadow-black/5 dark:shadow-none hover:shadow-md"
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${proj.iconColor}`}
                            >
                              <proj.icon className="w-4 h-4" />
                            </div>
                            <div className="min-w-0 pr-2">
                              <div className="flex items-center flex-wrap gap-2">
                                <span className="text-sm font-bold max-w-37.5 truncate text-gray-900 dark:text-gray-100 group-hover/link:text-indigo-600 dark:group-hover/link:text-indigo-400 transition-colors">
                                  {proj.name}
                                </span>
                                {proj.isCurrent && (
                                  <span className="inline-flex items-center shrink-0 gap-1.5 px-2 py-0.5 rounded font-bold uppercase tracking-wider text-[9px] bg-indigo-500/10 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-500/20">
                                    <span className="relative flex h-1.5 w-1.5 shrink-0">
                                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-indigo-500"></span>
                                    </span>
                                    Active
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-500 mt-0.5 truncate font-medium">
                                {proj.type}
                              </div>
                            </div>
                          </div>
                          <ExternalLink className="w-4 h-4 text-gray-400 group-hover/link:text-indigo-500 transition-colors shrink-0" />
                        </a>
                      ))}
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>

            {/* Official Guide Banner card */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="mt-12 text-center"
            >
              <a
                href="https://educative-viewer-guide.vercel.app/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-4.5 px-8 py-4.5 bg-white/40 dark:bg-[#0c101b]/45 border border-gray-200/55 dark:border-white/5 backdrop-blur-xl rounded-2xl hover:bg-white/80 dark:hover:bg-gray-900/80 hover:border-indigo-500/25 dark:hover:border-indigo-500/25 transition-all shadow-sm hover:shadow-md text-gray-900 dark:text-white font-bold group"
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 overflow-hidden border border-gray-200/50 dark:border-white/10 shadow-sm bg-white p-0.5">
                  <Image
                    src="https://raw.githubusercontent.com/Biraj2004/Educative-Viewer-Guide/main/public/logo.jpg"
                    alt="Guide Logo"
                    width={40}
                    height={40}
                    className="w-full h-full object-cover rounded-lg no-dark-invert"
                    unoptimized
                  />
                </div>
                <span>Read the Official Setup Guide</span>
                <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-indigo-500 transition-colors shrink-0 ml-1" />
              </a>
            </motion.div>
          </div>
        </section>

        {/* ── Contact Section ────────────────────────────────────────────── */}
        <section className="py-20 border-t border-gray-200/50 dark:border-white/5 bg-gray-50/50 dark:bg-[#030712]/50 relative overflow-hidden flex items-center justify-center">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom,rgba(99,102,241,0.06),transparent_45%)] pointer-events-none" />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ type: "spring", stiffness: 100, damping: 20 }}
            className="relative max-w-4xl mx-auto px-6 text-center z-10 border border-indigo-500/15 dark:border-white/5 bg-white/40 dark:bg-[#080d19]/40 backdrop-blur-2xl rounded-3xl p-10 sm:p-14 shadow-2xl mx-6"
          >
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-650 dark:text-indigo-400 text-xs font-bold uppercase tracking-wider mb-6 border border-indigo-500/25">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Get in Touch</span>
            </div>
            <h2 className="text-3xl md:text-5xl font-extrabold text-gray-900 dark:text-white mb-6 tracking-tight leading-[1.15]">
              Have Questions or Feedback?
            </h2>
            <p className="text-base sm:text-lg text-gray-650 dark:text-gray-405 mb-10 leading-relaxed max-w-2xl mx-auto">
              We&apos;re constantly evolving Edu-Viewer PRO based on community
              input. Whether you&apos;ve found a bug, have a feature idea, or
              just want to say hi, we&apos;re all ears.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => (window.location.href = "/contact")}
                className="px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold transition-all shadow-lg shadow-indigo-500/25 flex items-center gap-2 cursor-pointer"
              >
                <span>Contact Support</span>
                <ExternalLink className="w-4.5 h-4.5" />
              </motion.button>
              <motion.a
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                href="https://github.com/Biraj2004/educative-viewer"
                target="_blank"
                rel="noopener noreferrer"
                className="px-8 py-4 bg-white dark:bg-[#030712] text-gray-900 dark:text-white border border-gray-200 dark:border-white/5 backdrop-blur-md rounded-2xl font-bold transition-all hover:bg-gray-50 dark:hover:bg-gray-900 hover:border-indigo-300 dark:hover:border-indigo-500/50 flex items-center gap-2 cursor-pointer shadow-xs"
              >
                <IconGitHub className="w-4.5 h-4.5" />
                <span>View on GitHub</span>
              </motion.a>
            </div>
          </motion.div>
        </section>

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <footer className="border-t border-zinc-200/50 dark:border-zinc-900/50 bg-white/40 dark:bg-[#030712]/40 backdrop-blur-md mt-auto">
          <div className="max-w-6xl mx-auto px-6 py-16">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-10 md:gap-8 pb-12 border-b border-zinc-200/50 dark:border-zinc-900/50">
              
              {/* Brand & Tagline */}
              <div className="md:col-span-4 flex flex-col gap-4">
                <div className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-indigo-500 fill-indigo-500/20" />
                  <span className="font-extrabold text-zinc-950 dark:text-white tracking-tight">
                    Edu-Viewer <span className="text-indigo-500">PRO</span>
                  </span>
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed font-medium">
                  A high-performance offline content viewer for developer documentation, code playpens, and interactive course components.
                </p>
              </div>

              {/* Navigation */}
              <div className="md:col-span-2 flex flex-col gap-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-300">Navigation</h4>
                <ul className="flex flex-col gap-2">
                  <li>
                    <Link href="/" className="text-xs text-zinc-500 hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-indigo-400 transition-colors font-semibold">
                      Home
                    </Link>
                  </li>
                  <li>
                    <Link href="/about" className="text-xs text-zinc-500 hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-indigo-400 transition-colors font-semibold">
                      About Project
                    </Link>
                  </li>
                  <li>
                    <Link href="/dashboard" className="text-xs text-zinc-500 hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-indigo-400 transition-colors font-semibold">
                      Dashboard
                    </Link>
                  </li>
                </ul>
              </div>

              {/* Resources */}
              <div className="md:col-span-2 flex flex-col gap-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-300">Resources</h4>
                <ul className="flex flex-col gap-2">
                  <li>
                    <a href="https://github.com/Biraj2004/educative-viewer" target="_blank" rel="noopener noreferrer" className="group inline-flex items-center gap-1 text-xs text-zinc-550 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors font-semibold">
                      GitHub Repository
                      <ExternalLink className="w-3 h-3 opacity-60 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                    </a>
                  </li>
                  <li>
                    <a href="https://educative-viewer-guide.vercel.app/" target="_blank" rel="noopener noreferrer" className="group inline-flex items-center gap-1 text-xs text-zinc-550 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors font-semibold">
                      Setup Guide
                      <ExternalLink className="w-3 h-3 opacity-60 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                    </a>
                  </li>
                </ul>
              </div>

              {/* Disclaimer */}
              <div className="md:col-span-4 flex flex-col gap-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-300">Disclaimer</h4>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed font-medium">
                  Edu-Viewer PRO is an independent open-source client viewer. It is not affiliated with, authorized, or endorsed by any proprietary course hosting platforms.
                </p>
              </div>

            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-8 text-xs font-semibold text-zinc-450 dark:text-zinc-500">
              <div>
                © 2026 Crafted with precision. Open-source under the MIT License.
              </div>
              <div className="flex items-center gap-4">
                <span>v1.0.193</span>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </HomeAuthProvider>
  );
}
