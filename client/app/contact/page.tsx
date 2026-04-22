"use client";

import React, { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import AppNavbar from "@/components/edu-viewer/AppNavbar";
import { useAuth } from "@/components/edu-viewer/AuthProvider";
import { getBackendApiBase } from "@/utils/runtime-config";

// ─── Icons ────────────────────────────────────────────────────────────────────

function IconSend() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg className="w-8 h-8 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function IconTelegram() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.11.02-1.93 1.23-5.46 3.62-.51.35-.98.53-1.39.52-.46-.01-1.33-.26-1.98-.48-.8-.27-1.43-.42-1.37-.89.03-.25.38-.51 1.05-.78 4.1-1.79 6.83-2.97 8.2-3.55 3.89-1.61 4.7-1.89 5.23-1.9.11 0 .37.03.54.17.14.12.18.28.2.45-.02.07-.02.13-.03.22z"/>
    </svg>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ContactPage() {
  const { user, authToken } = useAuth();
  const [formData, setFormData] = useState({
    name: user?.name || "",
    email: user?.email || "",
    message: "",
  });
  const [pending, setPending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    setError(null);

    try {
      const apiBase = getBackendApiBase();
      const res = await fetch(`${apiBase}/api/contact`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send message");

      setSuccess(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setError(message);
    } finally {
      setPending(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
        <AppNavbar crumbs={[{ label: "Contact Us" }]} backHref="/" backLabel="Home" />
        <div className="relative flex-1 overflow-hidden p-6">
          <motion.div
            initial={{ opacity: 0.3 }}
            animate={{ opacity: [0.26, 0.4, 0.26], x: [0, 8, 0], y: [0, -8, 0] }}
            transition={{ duration: 11, repeat: Infinity, ease: "easeInOut" }}
            className="pointer-events-none absolute left-1/2 top-6 h-80 w-80 -translate-x-[135%] rounded-full bg-cyan-400/15 blur-3xl dark:bg-cyan-500/20"
          />
          <motion.div
            initial={{ opacity: 0.26 }}
            animate={{ opacity: [0.22, 0.36, 0.22], x: [0, -10, 0], y: [0, 10, 0] }}
            transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
            className="pointer-events-none absolute bottom-0 right-1/2 h-72 w-72 translate-x-[145%] rounded-full bg-indigo-400/15 blur-3xl dark:bg-indigo-500/20"
          />
          <div className="relative z-10 flex h-full items-center justify-center">
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="max-w-md w-full rounded-3xl border border-emerald-200/70 bg-white/85 p-10 text-center shadow-[0_36px_90px_-45px_rgba(15,23,42,0.45)] backdrop-blur-xl dark:border-emerald-900/50 dark:bg-slate-900/75"
            >
              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-500/10">
                <IconCheck />
              </div>
              <h2 className="mb-4 text-2xl font-bold text-slate-900 dark:text-slate-100">Message Sent!</h2>
              <p className="mb-8 leading-relaxed text-slate-600 dark:text-slate-300">
                Thanks for reaching out. Your message was delivered to our support channel and we will reply soon.
              </p>
              <motion.button
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.985 }}
                onClick={() => window.location.href = "/"}
                className="rounded-xl bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500 px-8 py-3 font-semibold text-white shadow-[0_12px_30px_-16px_rgba(37,99,235,0.9)] transition-all cursor-pointer"
              >
                Back to Home
              </motion.button>
            </motion.div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <AppNavbar crumbs={[{ label: "Contact Us" }]} backHref="/" backLabel="Home" />

      <main className="relative overflow-hidden">
        <motion.div
          initial={{ opacity: 0.28 }}
          animate={{ opacity: [0.22, 0.38, 0.22], x: [0, 10, 0], y: [0, -8, 0] }}
          transition={{ duration: 11, repeat: Infinity, ease: "easeInOut" }}
          className="pointer-events-none absolute left-1/2 top-8 h-80 w-80 -translate-x-[140%] rounded-full bg-cyan-400/15 blur-3xl dark:bg-cyan-500/20"
        />
        <motion.div
          initial={{ opacity: 0.22 }}
          animate={{ opacity: [0.18, 0.34, 0.18], x: [0, -12, 0], y: [0, 10, 0] }}
          transition={{ duration: 13, repeat: Infinity, ease: "easeInOut" }}
          className="pointer-events-none absolute bottom-0 right-1/2 h-72 w-72 translate-x-[145%] rounded-full bg-indigo-400/15 blur-3xl dark:bg-indigo-500/20"
        />

        <div className="relative z-10 mx-auto grid w-full max-w-6xl gap-10 px-6 py-12 md:grid-cols-2 md:gap-14 md:py-20">
          <motion.section
            initial={{ opacity: 0, x: -18 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.35 }}
            className="space-y-8"
          >
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-700 dark:text-cyan-300">Support Desk</p>
              <h1 className="text-4xl font-black tracking-tight text-slate-900 dark:text-slate-100 md:text-5xl">
                Let&apos;s build a better
                <span className="block bg-gradient-to-r from-cyan-600 via-blue-500 to-indigo-500 bg-clip-text text-transparent">learning workflow</span>
              </h1>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-600 dark:text-slate-300 md:text-lg">
                Questions, bugs, or ideas are all welcome. Your message reaches us instantly and gets triaged by priority.
              </p>
            </div>

            <AnimatePresence>
              <div className="space-y-4">
                {[
                  {
                    title: "Real-time updates",
                    copy: "Messages are forwarded to our internal Telegram support pipeline.",
                    icon: <IconTelegram />,
                  },
                  {
                    title: "Human follow-up",
                    copy: "A developer reviews context and replies with actionable next steps.",
                    icon: (
                      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                      </svg>
                    ),
                  },
                ].map((item, index) => (
                  <motion.div
                    key={item.title}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.08 * index, duration: 0.25 }}
                    className="rounded-2xl border border-slate-200/80 bg-white/70 p-4 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/55"
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600 dark:bg-cyan-500/10 dark:text-cyan-300">
                        {item.icon}
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{item.title}</h3>
                        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{item.copy}</p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </AnimatePresence>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, x: 18 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.35 }}
            className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white/80 p-8 shadow-[0_36px_90px_-45px_rgba(15,23,42,0.45)] backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/70 md:p-10"
          >
            <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-cyan-400/10 blur-3xl dark:bg-cyan-500/15" />
            <form onSubmit={handleSubmit} className="relative space-y-6">
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full rounded-xl border border-slate-300/70 bg-white/85 px-4 py-3 text-slate-900 outline-none transition-all focus:border-cyan-400/70 focus:ring-2 focus:ring-cyan-400/70 dark:border-slate-700 dark:bg-slate-950/65 dark:text-slate-100 dark:focus:border-cyan-600 dark:focus:ring-cyan-500/60"
                  placeholder="Your name"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Email Address</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full rounded-xl border border-slate-300/70 bg-white/85 px-4 py-3 text-slate-900 outline-none transition-all focus:border-cyan-400/70 focus:ring-2 focus:ring-cyan-400/70 dark:border-slate-700 dark:bg-slate-950/65 dark:text-slate-100 dark:focus:border-cyan-600 dark:focus:ring-cyan-500/60"
                  placeholder="you@example.com"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Message</label>
                <textarea
                  required
                  rows={5}
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  className="w-full resize-none rounded-xl border border-slate-300/70 bg-white/85 px-4 py-3 text-slate-900 outline-none transition-all focus:border-cyan-400/70 focus:ring-2 focus:ring-cyan-400/70 dark:border-slate-700 dark:bg-slate-950/65 dark:text-slate-100 dark:focus:border-cyan-600 dark:focus:ring-cyan-500/60"
                  placeholder="Tell us what's on your mind..."
                />
              </div>

              {error && <p className="text-sm font-medium text-rose-500">{error}</p>}

              <motion.button
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.985 }}
                type="submit"
                disabled={pending}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500 py-4 font-bold text-white shadow-[0_12px_30px_-16px_rgba(37,99,235,0.9)] transition-all disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
              >
                {pending ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                ) : (
                  <>
                    <IconSend />
                    Send Message
                  </>
                )}
              </motion.button>
            </form>
          </motion.section>
        </div>
      </main>

      <footer className="border-t border-slate-200/80 py-10 text-center dark:border-slate-800">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Want to know more about the project?{" "}
          <a href="/about" className="font-medium text-cyan-700 hover:underline dark:text-cyan-300">
            Read our story
          </a>
        </p>
      </footer>
    </div>
  );
}
