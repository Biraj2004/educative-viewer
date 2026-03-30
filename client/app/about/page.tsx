"use client";

import React from "react";
import Image from "next/image";
import AppNavbar from "@/components/edu-viewer/AppNavbar";
import { HomeAuthProvider } from "@/components/edu-viewer/HomeAuthSection";
import { motion, Variants } from "framer-motion";
import { ExternalLink, Globe, Lock, Code2, Layers } from "lucide-react";

function IconGitHub({ className }: { className?: string }) {
  return (
    <svg className={className || "w-5 h-5"} viewBox="0 0 24 24" fill="currentColor">
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
    transition: { staggerChildren: 0.15, delayChildren: 0.1 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { type: "spring", stiffness: 100, damping: 20 }
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
    textGradient: "from-indigo-500 to-violet-500 dark:from-indigo-400 dark:to-violet-400",
    projects: [
      {
        name: "EducativeViewer",
        type: "Public Release",
        icon: Globe,
        iconColor: "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20",
        href: "https://github.com/Biraj2004/EducativeViewer",
        isCurrent: true,
      },
      {
        name: "educative-viewer",
        type: "Private Repository",
        icon: Lock,
        iconColor: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20",
        href: "https://github.com/Biraj2004/educative-viewer",
        isCurrent: true,
      }
    ]
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
    textGradient: "from-violet-500 to-fuchsia-500 dark:from-violet-400 dark:to-fuchsia-400",
    projects: [
      {
        name: "educative.io_scraper",
        type: "Data Extraction Tool",
        icon: Code2,
        iconColor: "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20",
        href: "https://github.com/anilabhadatta/educative.io_scraper",
        isCurrent: false,
      },
      {
        name: "educative-viewer",
        type: "Legacy Viewer",
        icon: Layers,
        iconColor: "text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20",
        href: "https://github.com/anilabhadatta/educative-viewer",
        isCurrent: false,
      }
    ]
  }
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function AboutPage() {
  return (
    <HomeAuthProvider>
      <div className="min-h-screen bg-[#fafafa] dark:bg-[#030712] text-gray-900 dark:text-gray-100 font-sans selection:bg-indigo-500/30 flex flex-col">
        <AppNavbar crumbs={[{ label: "About Us" }]} backHref="/" backLabel="Home" />

        {/* ── Hero Section ───────────────────────────────────────────────── */}
        <section className="relative flex flex-col justify-center overflow-hidden border-b border-gray-200/50 dark:border-white/5 pt-20 pb-24">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(99,102,241,0.08),transparent)] dark:bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(99,102,241,0.15),transparent)] pointer-events-none" />
          
          <motion.div 
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="relative max-w-4xl mx-auto px-6 text-center z-10"
          >
            <motion.h1 
              variants={itemVariants}
              className="text-4xl sm:text-6xl font-extrabold tracking-tight text-gray-900 dark:text-white mb-6"
            >
              Empowering Devs with <br className="hidden sm:block" />
              <span className="text-transparent bg-clip-text bg-linear-to-r from-indigo-500 to-violet-500 dark:from-indigo-400 dark:to-violet-400">
                Open-Source Learning
              </span>
            </motion.h1>
            <motion.p 
              variants={itemVariants}
              className="text-lg sm:text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto leading-relaxed"
            >
              Edu-Viewer PRO is a community-driven open-source initiative dedicated to bringing rich, 
              interactive, code-first educational content to everyone. Build locally, host seamlessly, and learn flawlessly.
            </motion.p>
          </motion.div>
        </section>

        {/* ── Contributors Section ────────────────────────────────────────── */}
        <section className="py-24 relative flex-1">
          <div className="max-w-5xl mx-auto px-6">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              className="text-center mb-16"
            >
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-4">Meet the Builders</h2>
              <p className="text-lg text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
                The core maintainers and visionaries driving the ecosystem behind <span className="whitespace-nowrap font-medium text-gray-700 dark:text-gray-300">Edu-Viewer PRO.</span>
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
                  whileHover={{ y: -4 }}
                  className={`flex flex-col group relative rounded-3xl border border-gray-200/50 dark:border-white/5 bg-white/40 dark:bg-[#080b14]/50 backdrop-blur-xl p-8 shadow-sm transition-all duration-300 ${col.hoverShadow}`}
                >
                  <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                    <IconGitHub className="w-24 h-24" />
                  </div>
                  
                  <div className="relative z-10 flex flex-col flex-1">
                    <div className="flex items-center gap-5 mb-6 shrink-0">
                      <div className={`w-16 h-16 rounded-full bg-linear-to-br ${col.color} p-0.5 shrink-0 shadow-lg ${col.shadowColor}`}>
                        <div className="w-full h-full rounded-full bg-white dark:bg-gray-900 flex items-center justify-center overflow-hidden">
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
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white">{col.name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <p className={`text-sm font-bold bg-clip-text text-transparent bg-linear-to-r ${col.textGradient}`}>{col.role}</p>
                          <span className="text-gray-300 dark:text-gray-700 text-[10px]">•</span>
                          <a href={`https://github.com/${col.github}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 transition-colors cursor-pointer">
                            <IconGitHub className="w-3.5 h-3.5" />
                            @{col.github}
                          </a>
                        </div>
                      </div>
                    </div>
                    
                    <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 leading-relaxed mb-8 flex-1">
                      {col.bio}
                    </p>

                    <div className="space-y-3 mt-auto shrink-0">
                      {col.projects.map((proj, pIdx) => (
                        <a 
                          key={pIdx}
                          href={proj.href} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center justify-between group/link p-3 rounded-2xl bg-white/50 dark:bg-gray-950/40 border border-gray-200/50 dark:border-white/5 hover:bg-white dark:hover:bg-gray-900 hover:border-indigo-300/50 dark:hover:border-indigo-500/30 transition-all cursor-pointer shadow-xs shadow-black/5 dark:shadow-none hover:shadow-md"
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${proj.iconColor}`}>
                              <proj.icon className="w-4 h-4" />
                            </div>
                            <div className="min-w-0 pr-2">
                              {/* Parent provides gap-2, but inside gap-2 min-w-0 wrapper allows truncate */}
                              <div className="flex items-center flex-wrap gap-2">
                                <span className="text-sm font-semibold max-w-37.5 truncate text-gray-900 dark:text-gray-100 group-hover/link:text-indigo-600 dark:group-hover/link:text-indigo-400 transition-colors">{proj.name}</span>
                                {proj.isCurrent && (
                                  <span className="inline-flex items-center shrink-0 gap-1.5 px-2 py-0.5 rounded font-bold uppercase tracking-wider text-[9px] bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20">
                                    <span className="relative flex h-1.5 w-1.5 shrink-0">
                                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-indigo-500"></span>
                                    </span>
                                    This Project
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-500 mt-0.5 truncate">{proj.type}</div>
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
          </div>
        </section>

        {/* ── Contact Section ────────────────────────────────────────────── */}
        <section className="py-24 border-t border-gray-200/50 dark:border-white/5 bg-gray-50/50 dark:bg-[#030712]/50 relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom,rgba(99,102,241,0.05),transparent_40%)] pointer-events-none" />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ type: "spring", stiffness: 100, damping: 20 }}
            className="relative max-w-4xl mx-auto px-6 text-center z-10"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-bold uppercase tracking-wider mb-6 border border-indigo-200/50 dark:border-indigo-500/20">
              Get in Touch
            </div>
            <h2 className="text-3xl md:text-5xl font-bold text-gray-900 dark:text-white mb-6">Have Questions or Feedback?</h2>
            <p className="text-lg text-gray-600 dark:text-gray-400 mb-10 leading-relaxed max-w-2xl mx-auto">
              We&apos;re constantly evolving Edu-Viewer PRO based on community input. 
              Whether you&apos;ve found a bug, have a feature idea, or just want to say hi, we&apos;re all ears.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => window.location.href = "/contact"}
                className="px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold transition-all shadow-lg shadow-indigo-500/25 flex items-center gap-2"
              >
                Contact Support
                <ExternalLink className="w-5 h-5" />
              </motion.button>
              <motion.a 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                href="https://github.com/Biraj2004/EducativeViewer" 
                target="_blank" 
                rel="noopener noreferrer"
                className="px-8 py-4 bg-white dark:bg-[#030712] text-gray-900 dark:text-white border border-gray-200 dark:border-white/5 backdrop-blur-md rounded-2xl font-bold transition-all hover:bg-gray-50 dark:hover:bg-gray-900 hover:border-indigo-300 dark:hover:border-indigo-500/50 flex items-center gap-2"
              >
                <IconGitHub className="w-5 h-5" />
                View on GitHub
              </motion.a>
            </div>
          </motion.div>
        </section>
      </div>
    </HomeAuthProvider>
  );
}
