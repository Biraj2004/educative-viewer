"use client";

import React from "react";
import Image from "next/image";
import AppNavbar from "@/components/edu-viewer/AppNavbar";
import { HomeAuthProvider } from "@/components/edu-viewer/HomeAuthSection";

// ─── Icons ────────────────────────────────────────────────────────────────────

function IconGitHub() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.699-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.379.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.161 22 16.416 22 12c0-5.523-4.477-10-10-10z"
      />
    </svg>
  );
}

function IconExternal() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

function IconLock() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function IconGlobe() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AboutPage() {
  return (
    <HomeAuthProvider>
      <div className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 font-sans selection:bg-indigo-500/30">
        <AppNavbar crumbs={[{ label: "About Us" }]} backHref="/" backLabel="Home" />

        {/* ── Hero Section ───────────────────────────────────────────────── */}
        <section className="relative overflow-hidden border-b border-gray-200 dark:border-gray-800">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(99,102,241,0.15),transparent)] dark:bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(99,102,241,0.25),transparent)] pointer-events-none" />
          
          <div className="relative max-w-4xl mx-auto px-6 py-20 text-center">
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-gray-900 dark:text-white mb-6">
              Empowering Devs with <br className="hidden sm:block" />
              <span className="text-transparent bg-clip-text bg-linear-to-r from-indigo-500 to-violet-500 dark:from-indigo-400 dark:to-violet-400">
                Open-Source Learning
              </span>
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto leading-relaxed">
              Edu-Viewer PRO is a community-driven open-source initiative dedicated to bringing rich, 
              interactive, code-first educational content to everyone. Build locally, host seamlessly, and learn flawlessly.
            </p>
          </div>
        </section>

        {/* ── Contributors Section ────────────────────────────────────────── */}
        <section className="py-20 relative">
          <div className="max-w-5xl mx-auto px-6">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Meet the Builders</h2>
              <p className="text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
                The core maintainers and visionaries driving the ecosystem behind <span className="whitespace-nowrap">Edu-Viewer PRO.</span>
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              
              {/* Biraj Card */}
              <div className="group relative rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 p-8 hover:shadow-xl dark:hover:shadow-indigo-500/10 transition-all duration-300">
                <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                  <IconGitHub />
                </div>
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-16 h-16 rounded-full bg-linear-to-br from-indigo-500 to-violet-500 p-0.5 shrink-0">
                    <div className="w-full h-full rounded-full bg-white dark:bg-gray-900 flex items-center justify-center overflow-hidden">
                      <Image 
                        src="https://github.com/Biraj2004.png" 
                        alt="Biraj Sarkar" 
                        width={64} 
                        height={64} 
                        className="object-cover no-dark-invert"
                        unoptimized
                      />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">Biraj Sarkar</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400">Developer</p>
                      <span className="text-gray-300 dark:text-gray-700 text-[10px]">•</span>
                      <a href="https://github.com/Biraj2004" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-400 transition-colors cursor-pointer">
                        @Biraj2004
                        <IconExternal />
                      </a>
                    </div>
                  </div>
                </div>
                
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-6">
                  Architect of the Edu-Viewer interface and React ecosystem. Responsible for component logic, routing, UI/UX consistency, and core application rendering engines.
                </p>

                <div className="space-y-3">
                  <a 
                    href="https://github.com/Biraj2004/EducativeViewer" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center justify-between group/link p-3 rounded-lg bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-md bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 flex items-center justify-center">
                        <IconGlobe />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-semibold text-gray-900 dark:text-white group-hover/link:text-indigo-600 dark:group-hover/link:text-indigo-400 transition-colors">EducativeViewer</div>
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded font-bold uppercase tracking-wider text-[9px] bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20">
                            <span className="relative flex h-1.5 w-1.5">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-indigo-500"></span>
                            </span>
                            This Project
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-500 mt-0.5">Public Release</div>
                      </div>
                    </div>
                    <IconExternal />
                  </a>

                  <a 
                    href="https://github.com/Biraj2004/educative-viewer" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center justify-between group/link p-3 rounded-lg bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-md bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                        <IconLock />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-semibold text-gray-900 dark:text-white group-hover/link:text-indigo-600 dark:group-hover/link:text-indigo-400 transition-colors">educative-viewer</div>
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded font-bold uppercase tracking-wider text-[9px] bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20">
                            <span className="relative flex h-1.5 w-1.5">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-indigo-500"></span>
                            </span>
                            This Project
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-500 mt-0.5">Private Repository</div>
                      </div>
                    </div>
                    <IconExternal />
                  </a>
                </div>
              </div>

              {/* Anila Card */}
              <div className="group relative rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 p-8 hover:shadow-xl dark:hover:shadow-violet-500/10 transition-all duration-300">
                <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                  <IconGitHub />
                </div>
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-16 h-16 rounded-full bg-linear-to-br from-violet-500 to-fuchsia-500 p-0.5 shrink-0">
                    <div className="w-full h-full rounded-full bg-white dark:bg-gray-900 flex items-center justify-center overflow-hidden">
                       <Image 
                         src="https://github.com/anilabhadatta.png" 
                         alt="Anilabha Datta" 
                         width={64} 
                         height={64} 
                         className="object-cover no-dark-invert"
                         unoptimized
                       />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">Anilabha Datta</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-sm font-medium text-violet-600 dark:text-violet-400">Developer</p>
                      <span className="text-gray-300 dark:text-gray-700 text-[10px]">•</span>
                      <a href="https://github.com/anilabhadatta" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-violet-600 dark:text-gray-400 dark:hover:text-violet-400 transition-colors cursor-pointer">
                        @anilabhadatta
                        <IconExternal />
                      </a>
                    </div>
                  </div>
                </div>
                
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-6">
                  Mastermind behind the data extraction pipeline. Developed the robust scraping engine ensuring seamless content portability into structured JSON formats.
                </p>

                <div className="space-y-3 mt-auto">
                  <a 
                    href="https://github.com/anilabhadatta/educative.io_scraper" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center justify-between group/link p-3 rounded-lg bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 hover:border-violet-300 dark:hover:border-violet-700 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-md bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="16 18 22 12 16 6" />
                          <polyline points="8 6 2 12 8 18" />
                        </svg>
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-gray-900 dark:text-white group-hover/link:text-violet-600 dark:group-hover/link:text-violet-400 transition-colors">educative.io_scraper</div>
                        <div className="text-xs text-gray-500 dark:text-gray-500">Data Extraction Tool</div>
                      </div>
                    </div>
                    <IconExternal />
                  </a>

                  <a 
                    href="https://github.com/anilabhadatta/educative-viewer" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center justify-between group/link p-3 rounded-lg bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 hover:border-violet-300 dark:hover:border-violet-700 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-md bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                          <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                          <line x1="8" y1="21" x2="16" y2="21" />
                          <line x1="12" y1="17" x2="12" y2="21" />
                        </svg>
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-gray-900 dark:text-white group-hover/link:text-violet-600 dark:group-hover/link:text-violet-400 transition-colors">educative-viewer</div>
                        <div className="text-xs text-gray-500 dark:text-gray-500">Legacy Viewer</div>
                      </div>
                    </div>
                    <IconExternal />
                  </a>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* ── Contact Section ────────────────────────────────────────────── */}
        <section className="py-24 border-t border-gray-100 dark:border-gray-900 bg-gray-50/50 dark:bg-gray-950/50">
          <div className="max-w-4xl mx-auto px-6 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-bold uppercase tracking-wider mb-6 border border-indigo-100 dark:border-indigo-500/20">
              Get in Touch
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-6">Have Questions or Feedback?</h2>
            <p className="text-lg text-gray-600 dark:text-gray-400 mb-10 leading-relaxed max-w-2xl mx-auto">
              We&apos;re constantly evolving Edu-Viewer PRO based on community input. 
              Whether you&apos;ve found a bug, have a feature idea, or just want to say hi, we&apos;re all ears.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <button 
                onClick={() => window.location.href = "/contact"}
                className="px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-indigo-500/25 active:scale-95 flex items-center gap-2 cursor-pointer"
              >
                Contact Support
                <IconExternal />
              </button>
              <a 
                href="https://github.com/Biraj2004/EducativeViewer" 
                target="_blank" 
                rel="noopener noreferrer"
                className="px-8 py-4 bg-white dark:bg-gray-900 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-800 rounded-xl font-bold transition-all hover:border-indigo-300 dark:hover:border-indigo-700 active:scale-95 flex items-center gap-2 cursor-pointer"
              >
                View on GitHub
                <IconGitHub />
              </a>
            </div>
          </div>
        </section>
      </div>
    </HomeAuthProvider>
  );
}
