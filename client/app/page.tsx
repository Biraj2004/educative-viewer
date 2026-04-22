"use client";

import Link from "next/link";
import AppNavbar from "@/components/edu-viewer/AppNavbar";
import {
  HomeAuthProvider,
  HomeNavSignIn,
  HomeHeroCTA,
  HomeBottomCTA,
} from "@/components/edu-viewer/HomeAuthSection";
import { motion, useScroll, useTransform, Variants } from "framer-motion";
import { useRef } from "react";
import { 
  TerminalSquare, 
  Lightbulb, 
  Layers, 
  Sparkles,
  Zap,
  ExternalLink,
  ChevronRight
} from "lucide-react";

// ─── Data ─────────────────────────────────────────────────────────────────────

const features = [
  {
    icon: TerminalSquare,
    label: "Live Execution",
    desc: "Sandpack-powered execution. Write, compile, and run code entirely in your web browser instantly.",
    color: "from-blue-500 to-indigo-500",
    shadowText: "execution"
  },
  {
    icon: Lightbulb,
    label: "Smart Quizzes",
    desc: "Structured Q&A, drag-and-drop permutations, and instant feedback algorithms that adapt to your pace.",
    color: "from-violet-500 to-fuchsia-500",
    shadowText: "quizzes"
  },
  {
    icon: Layers,
    label: "Visual Content",
    desc: "Canvas animations, native DrawIO maps, LaTeX rendering, dynamic tables, and markdown arrays.",
    color: "from-fuchsia-500 to-rose-500",
    shadowText: "content"
  },
];

const componentTypes = [
  "Sandpack", "Code Blocks", "LaTeX Math", "Canvas Animation",
  "Draw IO", "Quiz", "Structured Quiz", "Permutation",
  "Match Answers", "Tables", "Spoiler", "Markdown Layouts",
  "Columns", "Slate HTML", "InstaCalc", "File Viewer",
  "Educative Array", "API Widget", "Editor Code", "WebpackBin",
  "Video Player", "Stack", "RunJS", "Notepad",
  "Matrix", "NaryTree", "LinkedList", "Graphviz",
  "BinaryTree", "CodeTest", "Chart", "ButtonLink",
  "CodeDrawing", "Adaptive",
];

const stats = [
  { value: "30+", label: "Rich Components" },
  { value: "0ms", label: "Latency Execution" },
  { value: "100%", label: "Dark Mode Native" },
];

// ─── Animations ─────────────────────────────────────────────────────────────

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15, delayChildren: 0.2 },
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

// ─── Components ─────────────────────────────────────────────────────────────

function FeatureCard({ feature }: { feature: typeof features[0] }) {
  const Icon = feature.icon;
  
  return (
    <motion.div
      variants={itemVariants}
      whileHover={{ y: -8, scale: 1.01 }}
      className="group relative rounded-3xl overflow-hidden bg-white/40 dark:bg-gray-900/40 backdrop-blur-xl border border-gray-200/50 dark:border-white/10 p-8 shadow-2xl shadow-gray-200/20 dark:shadow-none transition-all duration-500"
    >
      <div className={`absolute top-0 left-0 w-full h-1 bg-linear-to-r ${feature.color} opacity-50 group-hover:opacity-100 transition-opacity`} />
      
      {/* Decorative large low-opacity text */}
      <div className="absolute -bottom-6 -right-4 text-7xl font-black text-gray-900/3 dark:text-white/2 select-none pointer-events-none uppercase tracking-tighter">
        {feature.shadowText}
      </div>

      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-8 bg-linear-to-br ${feature.color} text-white shadow-lg shadow-indigo-500/20 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-500`}>
        <Icon strokeWidth={2} />
      </div>
      
      <h3 className="font-bold text-gray-950 dark:text-white text-xl mb-3">{feature.label}</h3>
      <p className="text-gray-600 dark:text-gray-400 leading-relaxed font-medium">
        {feature.desc}
      </p>
    </motion.div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const yBg = useTransform(scrollYProgress, [0, 1], ["0%", "50%"]);
  const opacityText = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  return (
    <HomeAuthProvider>
      <div className="min-h-screen bg-[#fafafa] dark:bg-[#030712] text-gray-900 dark:text-gray-100 selection:bg-indigo-500/30 font-sans flex flex-col">
        
        {/* Navbar */}
        <AppNavbar actions={<div className="flex items-center gap-4"><HomeNavSignIn /></div>} />

        {/* ── Hero Section ────────────────────────────────────────────────── */}
        <section ref={heroRef} className="relative min-h-[90vh] flex flex-col justify-center items-center overflow-hidden pt-20 pb-32">
          {/* Animated Background Mesh - Premium Lighting */}
          <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
            {/* Ultra-smooth radial ambient lights (replaces banding-prone CSS blur) */}
            <div className="absolute top-0 right-1/4 w-full h-[80%] opacity-40 dark:opacity-20 bg-[radial-gradient(ellipse_at_center,var(--tw-gradient-stops))] from-indigo-500/30 via-transparent to-transparent animate-[float_10s_ease-in-out_infinite]" />
            <div className="absolute bottom-0 left-1/4 w-full h-[80%] opacity-40 dark:opacity-20 bg-[radial-gradient(ellipse_at_center,var(--tw-gradient-stops))] from-fuchsia-500/20 via-transparent to-transparent animate-[float_12s_ease-in-out_infinite_reverse]" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] opacity-30 dark:opacity-10 bg-[radial-gradient(circle_at_center,var(--tw-gradient-stops))] from-cyan-400/20 via-transparent to-transparent" />
            
            {/* Refined Grid Pattern */}
            <div 
              className="absolute inset-0 opacity-10 dark:opacity-[0.03]"
              style={{
                backgroundImage: "linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)",
                backgroundSize: "60px 60px",
                maskImage: "radial-gradient(ellipse 70% 70% at 50% 50%, #000 30%, transparent 100%)",
                WebkitMaskImage: "radial-gradient(ellipse 70% 70% at 50% 50%, #000 30%, transparent 100%)"
              }}
            />
          </div>

          <motion.div 
            className="relative z-10 max-w-5xl mx-auto px-6 text-center"
            style={{ y: yBg, opacity: opacityText }}
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {/* Pill */}
            <motion.div variants={itemVariants} className="flex justify-center mb-8">
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/60 dark:bg-gray-900/40 backdrop-blur-md border border-gray-200/50 dark:border-gray-800/50 text-sm font-semibold text-gray-700 dark:text-gray-300 shadow-sm shadow-indigo-500/5 hover:scale-105 transition-transform cursor-default">
                <Sparkles className="w-4 h-4 text-indigo-500" />
                <span className="bg-linear-to-r from-indigo-500 to-fuchsia-500 bg-clip-text text-transparent">Next-Gen Learning Space</span>
              </span>
            </motion.div>

            {/* Headline */}
            <motion.h1 
              variants={itemVariants}
              className="text-6xl sm:text-8xl font-black tracking-tighter leading-none text-gray-950 dark:text-white mb-8"
            >
              Explore. Code. <br className="hidden sm:block" />
              <span className="relative inline-block">
                Master 
                <span className="absolute -inset-1 block bg-linear-to-r from-indigo-500 via-fuchsia-500 to-cyan-500 blur-2xl opacity-30 dark:opacity-50 animate-pulse" />
                <span className="relative text-transparent bg-clip-text bg-linear-to-r from-indigo-500 via-fuchsia-500 to-cyan-500"> Everything.</span>
              </span>
            </motion.h1>

            {/* Sub */}
            <motion.p 
              variants={itemVariants}
              className="max-w-2xl mx-auto text-xl text-gray-600 dark:text-gray-400 font-medium leading-relaxed mb-12"
            >
              The most advanced, power-packed open-source content viewer.
              Live sandboxes, complex quizzes, embedded LaTeX, and visually rich tools—rendered instantly.
            </motion.p>

            {/* CTAs */}
            <motion.div variants={itemVariants} className="flex flex-col sm:flex-row items-center justify-center gap-6">
              <HomeHeroCTA />
              <Link
                href="/about"
                className="group flex items-center gap-2 text-gray-600 dark:text-gray-400 font-semibold hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                Discover the architecture
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </motion.div>
          </motion.div>
        </section>

        {/* ── Floating Stats Banner ───────────────────────────────────────── */}
        <section className="relative z-20 -mt-16 max-w-4xl mx-auto px-6">
          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="flex flex-col sm:flex-row justify-between items-center rounded-3xl bg-white/80 dark:bg-gray-900/60 backdrop-blur-xl border border-white/40 dark:border-white/10 p-2 shadow-2xl shadow-indigo-500/10 dark:shadow-none divide-y sm:divide-y-0 sm:divide-x divide-gray-200 dark:divide-gray-800"
          >
            {stats.map(({ value, label }) => (
              <div key={label} className="w-full text-center px-8 py-6 sm:py-4">
                <div className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">{value}</div>
                <div className="text-sm font-semibold text-gray-500 dark:text-gray-400 mt-1">{label}</div>
              </div>
            ))}
          </motion.div>
        </section>

        {/* ── Bento Features ──────────────────────────────────────────────── */}
        <section className="py-32 relative">
          <div className="max-w-6xl mx-auto px-6">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-16"
            >
              <h2 className="text-4xl md:text-5xl font-extrabold text-gray-900 dark:text-white tracking-tight mb-4">
                Engineered for deep learning
              </h2>
              <p className="text-lg text-gray-500 dark:text-gray-400 max-w-2xl mx-auto font-medium">
                We&apos;ve combined the velocity of modern web capabilities with a meticulously crafted educational toolkit.
              </p>
            </motion.div>

            <motion.div 
              variants={containerVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              className="grid md:grid-cols-3 gap-6 lg:gap-8"
            >
              {features.map((feature, i) => (
                <FeatureCard key={i} feature={feature} />
              ))}
            </motion.div>
          </div>
        </section>

        {/* ── Marquee Components ──────────────────────────────────────────── */}
        <section id="components" className="py-24 bg-white dark:bg-[#060a15] border-y border-gray-100 dark:border-gray-900 overflow-hidden">
          <div className="max-w-5xl mx-auto px-6 mb-12 text-center">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 tracking-tight">
              One runtime. Every component.
            </h2>
            <p className="text-gray-500 dark:text-gray-400 font-medium">
              Seamlessly rendering specialized interactive formats out of the box.
            </p>
          </div>
          
          {/* Marquee Container */}
          <div className="relative w-full overflow-hidden flex flex-col gap-4 max-w-[100vw]">
            {/* Left/Right Fade Masks */}
            <div className="absolute inset-y-0 left-0 w-32 bg-linear-to-r from-white dark:from-[#060a15] to-transparent z-10" />
            <div className="absolute inset-y-0 right-0 w-32 bg-linear-to-l from-white dark:from-[#060a15] to-transparent z-10" />
            
            {/* Strip 1 */}
            <div className="flex w-max animate-[marquee_50s_linear_infinite] hover:[animation-play-state:paused] cursor-grab">
              {[...componentTypes, ...componentTypes].map((name, i) => (
                <div
                  key={`${name}-${i}`}
                  className="mx-2 px-6 py-3 rounded-2xl border border-gray-200/80 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 text-sm font-semibold text-gray-700 dark:text-gray-300 backdrop-blur-sm whitespace-nowrap shadow-sm"
                >
                  {name}
                </div>
              ))}
            </div>
            
            {/* Strip 2 (Reverse) */}
            <div className="flex w-max animate-[marquee_60s_linear_infinite_reverse] hover:[animation-play-state:paused] cursor-grab">
              {[...componentTypes].reverse().concat([...componentTypes].reverse()).map((name, i) => (
                <div
                  key={`${name}-${i}-rev`}
                  className="mx-2 px-6 py-3 rounded-2xl border border-gray-200/80 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 text-sm font-semibold text-gray-700 dark:text-gray-300 backdrop-blur-sm whitespace-nowrap shadow-sm"
                >
                  {name}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Bottom CTA ─────────────────────────────────────────────────── */}
        <section className="py-32 relative overflow-hidden">
          {/* subtle background glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-200 h-200 bg-indigo-500/5 dark:bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none" />
          
          <div className="relative z-10 px-6 text-center">
            <HomeBottomCTA />
          </div>
        </section>

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <footer className="border-t border-gray-200/50 dark:border-white/5 bg-white dark:bg-transparent backdrop-blur-md">
          <div className="max-w-6xl mx-auto px-6 py-10 flex flex-col sm:flex-row items-center justify-between gap-6">
            
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-indigo-500 fill-indigo-500/20" />
              <span className="font-bold text-gray-900 dark:text-white tracking-tight">
                Edu-Viewer <span className="text-indigo-500">PRO</span>
              </span>
            </div>

            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
              © 2026 Crafted with precision
            </div>

            <div className="flex items-center gap-6">
              <Link
                href="/about"
                className="group inline-flex items-center gap-1.5 text-sm font-semibold text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
              >
                About Project
                <ExternalLink className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </Link>
            </div>
          </div>
        </footer>

      </div>
    </HomeAuthProvider>
  );
}
