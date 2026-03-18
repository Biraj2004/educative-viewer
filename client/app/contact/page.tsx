"use client";

import React, { useState } from "react";
import AppNavbar from "@/components/edu-viewer/AppNavbar";
import { useAuth } from "@/components/edu-viewer/AuthProvider";

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
      const apiBase = process.env.NEXT_PUBLIC_BACKEND_API_BASE?.replace(/\/$/, "") || "";
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
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
        <AppNavbar crumbs={[{ label: "Contact Us" }]} backHref="/" backLabel="Home" />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-md w-full text-center bg-white dark:bg-gray-900 rounded-3xl p-10 shadow-2xl border border-emerald-100 dark:border-emerald-900/30 animate-in fade-in zoom-in duration-500">
            <div className="w-20 h-20 bg-emerald-50 dark:bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <IconCheck />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Message Sent!</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-8 leading-relaxed">
              Thank you for reaching out. Your message has been beamed directly to our Telegram. We&apos;ll get back to you soon!
            </p>
            <button 
              onClick={() => window.location.href = "/"}
              className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold transition-all shadow-lg shadow-indigo-500/20 active:scale-95 cursor-pointer"
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col text-gray-900 dark:text-gray-100 font-sans">
      <AppNavbar crumbs={[{ label: "Contact Us" }]} backHref="/" backLabel="Home" />

      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-12 md:py-20 grid md:grid-cols-2 gap-12 items-start">
        
        {/* Left Side: Copy */}
        <div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-6">
            Let&apos;s <span className="text-indigo-600 dark:text-indigo-400">Collaborate</span>
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400 mb-8 leading-relaxed">
            Have a question, feedback, or a feature request? Drop us a line and our bot will notify us instantly via Telegram.
          </p>

          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                <IconTelegram />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white">Real-time Support</h3>
                <p className="text-sm text-gray-500 dark:text-gray-500">Your messages reach us immediately via secure Telegram channels.</p>
              </div>
            </div>
            
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white">Community Driven</h3>
                <p className="text-sm text-gray-500 dark:text-gray-500">Built by developers, for developers. We value every piece of feedback.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Form */}
        <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-800 p-8 md:p-10 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 blur-3xl rounded-full -mr-16 -mt-16 group-hover:bg-indigo-500/10 transition-colors" />
          
          <form onSubmit={handleSubmit} className="space-y-6 relative">
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Name</label>
              <input 
                type="text" 
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none text-gray-900 dark:text-white"
                placeholder="Your name"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Email Address</label>
              <input 
                type="email" 
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none text-gray-900 dark:text-white"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Message</label>
              <textarea 
                required
                rows={5}
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                className="w-full bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none text-gray-900 dark:text-white resize-none"
                placeholder="Tell us what&apos;s on your mind..."
              />
            </div>

            {error && (
              <p className="text-sm text-rose-500 font-medium">{error}</p>
            )}

            <button 
              type="submit" 
              disabled={pending}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold transition-all shadow-lg shadow-indigo-500/20 active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
            >
              {pending ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <IconSend />
                  Send Message
                </>
              )}
            </button>
          </form>
        </div>

      </main>

      {/* Footer link to About */}
      <footer className="py-12 border-t border-gray-100 dark:border-gray-800 text-center">
        <p className="text-gray-500 dark:text-gray-500 text-sm">
          Want to know more about the project? <a href="/about" className="text-indigo-600 dark:text-indigo-400 font-medium hover:underline cursor-pointer">Read our story</a>
        </p>
      </footer>
    </div>
  );
}
