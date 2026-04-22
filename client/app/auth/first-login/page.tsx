"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { motion, AnimatePresence, Variants } from "framer-motion";
import { 
  Eye, 
  EyeOff, 
  ShieldCheck, 
  KeyRound, 
  QrCode, 
  AlertCircle, 
  CheckCircle2, 
  Loader2,
  LockKeyhole
} from "lucide-react";
import {
  getAuthToken,
  changePassword,
  get2FASetup,
  enable2FA,
  getUser,
} from "@/utils/authClient";

// ─── Shared Styles ─────────────────────────────────────────────────────────────

const inputCls =
  "w-full px-4 py-3 rounded-xl border border-gray-200/50 dark:border-white/5 bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all shadow-sm";

const btnPrimary =
  "w-full py-3 px-4 rounded-xl bg-indigo-600 bg-linear-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:ring-offset-2 dark:focus:ring-offset-gray-950 text-white text-sm font-bold transition-all shadow-lg shadow-indigo-500/25 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2";

const cardVariants: Variants = {
  hidden: { opacity: 0, scale: 0.95, filter: "blur(10px)" },
  visible: { 
    opacity: 1, 
    scale: 1, 
    filter: "blur(0px)",
    transition: { type: "spring", stiffness: 100, damping: 20 }
  },
  exit: { 
    opacity: 0, 
    scale: 0.95, 
    filter: "blur(10px)",
    transition: { duration: 0.2 }
  }
};

// ─── Step 1: Change Password ──────────────────────────────────────────────────

function ChangePasswordStep({ onSuccess }: { onSuccess: () => void }) {
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (newPw !== confirmPw) { setError("Passwords do not match"); return; }
    if (newPw.length < 8) { setError("New password must be at least 8 characters"); return; }
    if (newPw.length > 16) { setError("Password must be at most 16 characters"); return; }
    if (newPw === currentPw) { setError("New password must differ from your temporary password"); return; }
    setLoading(true);
    try {
      await changePassword(currentPw, newPw);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Password change failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <motion.div variants={cardVariants} initial="hidden" animate="visible" exit="exit" className="flex flex-col gap-6">
      <div className="rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200/50 dark:border-amber-500/20 p-5 flex gap-4 items-start shadow-sm">
        <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center shrink-0">
          <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
        </div>
        <p className="text-[13px] leading-relaxed text-amber-800 dark:text-amber-300">
          Your account was created with a temporary password. 
          <span className="font-bold block mt-1">You must set a new password before continuing.</span>
        </p>
      </div>

      <form onSubmit={handleSubmit} autoComplete="off" className="space-y-6">
        <div className="space-y-5">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2 ml-1">
              Temporary Password
            </label>
            <div className="relative group">
              <input
                type={showPw ? "text" : "password"}
                required
                autoComplete="current-password"
                value={currentPw}
                onChange={(e) => { setCurrentPw(e.target.value); setError(""); }}
                placeholder="The password provided to you"
                className={`${inputCls} pr-12`}
              />
              <button
                type="button"
                onClick={() => setShowPw((p) => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-1"
              >
                {showPw ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="h-px bg-linear-to-r from-transparent via-gray-200 dark:via-gray-800 to-transparent mx-2" />

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2 ml-1">
                New Password
              </label>
              <input
                type={showPw ? "text" : "password"}
                required
                autoComplete="new-password"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                minLength={8}
                maxLength={16}
                data-lpignore="true"
                value={newPw}
                onChange={(e) => { setNewPw(e.target.value.slice(0, 16)); setError(""); }}
                placeholder="8–16 chars"
                className={inputCls}
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2 ml-1">
                Confirm
              </label>
              <input
                type={showPw ? "text" : "password"}
                required
                autoComplete="new-password"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                minLength={8}
                maxLength={16}
                data-lpignore="true"
                value={confirmPw}
                onChange={(e) => { setConfirmPw(e.target.value.slice(0, 16)); setError(""); }}
                placeholder="Re-enter password"
                className={inputCls}
              />
            </div>
          </div>
        </div>

        <AnimatePresence>
          {error && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <div className="rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200/50 dark:border-red-500/20 p-4 flex items-center gap-3 mt-1">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0" />
                <p className="text-sm font-medium text-red-700 dark:text-red-400">{error}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.button type="submit" disabled={loading} whileHover={{ scale: loading ? 1 : 1.02 }} whileTap={{ scale: loading ? 1 : 0.98 }} className={`${btnPrimary} mt-2`}>
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <LockKeyhole className="w-4 h-4" />}
          {loading ? "Saving Securely..." : "Set New Password"}
        </motion.button>
      </form>
    </motion.div>
  );
}

// ─── Step 2: 2FA Setup ────────────────────────────────────────────────────────

function TwoFASetupStep({ onSuccess }: { onSuccess: () => void }) {
  const [qrUrl, setQrUrl] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetchingQr, setFetchingQr] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    get2FASetup()
      .then((s) => setQrUrl(s.qrCodeUrl))
      .catch(() => setError("Failed to load QR code. Please refresh."))
      .finally(() => setFetchingQr(false));
  }, []);

  useEffect(() => { if (!fetchingQr) inputRef.current?.focus(); }, [fetchingQr]);

  const handleVerify = useCallback(async (digits: string) => {
    if (digits.length !== 6) return;
    setLoading(true);
    setError("");
    try {
      await enable2FA(digits);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid code. Try again.");
      setCode("");
    } finally {
      setLoading(false);
    }
  }, [onSuccess]);

  useEffect(() => {
    if (code.length === 6) handleVerify(code);
  }, [code, handleVerify]);

  if (fetchingQr) {
    return (
      <motion.div variants={cardVariants} initial="hidden" animate="visible" exit="exit" className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
        <p className="text-sm font-medium text-gray-500 animate-pulse">Generating Secure Identity Key...</p>
      </motion.div>
    );
  }

  return (
    <motion.div variants={cardVariants} initial="hidden" animate="visible" exit="exit" className="flex flex-col gap-10">
      <div className="grid md:grid-cols-2 gap-8 items-center">
        <div className="space-y-6">
          <div className="flex gap-4">
            <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 text-xs font-black shrink-0 shadow-inner">1</div>
            <div>
              <h4 className="text-xs font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wide mb-1 flex items-center gap-1.5"><QrCode className="w-3.5 h-3.5"/> Scan Code</h4>
              <p className="text-[13px] text-gray-500 dark:text-gray-400 leading-relaxed">Open your Authenticator app and scan the barcode to register.</p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 text-xs font-black shrink-0 shadow-inner">2</div>
            <div>
              <h4 className="text-xs font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wide mb-1 flex items-center gap-1.5"><KeyRound className="w-3.5 h-3.5" /> Verify Token</h4>
              <p className="text-[13px] text-gray-500 dark:text-gray-400 leading-relaxed">Enter the 6-digit pin generated by the app below to confirm.</p>
            </div>
          </div>
        </div>

        {qrUrl && (
          <div className="flex items-center justify-center relative p-2">
            <div className="absolute inset-0 bg-linear-to-tr from-indigo-500/20 to-purple-500/20 rounded-3xl blur-[30px] opacity-60" />
            <div className="relative p-3 rounded-2xl bg-white border border-gray-200 dark:border-white/10 shadow-xl dark:shadow-indigo-500/10 hover:scale-105 transition-transform duration-500">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrUrl} alt="2FA QR Code" width={160} height={160} className="rounded-xl mix-blend-multiply dark:mix-blend-normal" />
            </div>
          </div>
        )}
      </div>

      <form onSubmit={(e) => { e.preventDefault(); handleVerify(code); }} className="space-y-6">
        <div>
          <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            value={code}
            onChange={(e) => { setCode(e.target.value.replace(/\D/g, "").slice(0, 6)); setError(""); }}
            placeholder="000 000"
            className={`${inputCls} text-center text-4xl tracking-[0.3em] font-mono py-6 shadow-inner`}
          />
        </div>

        <AnimatePresence>
          {error && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <div className="rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200/50 dark:border-red-500/20 p-4 flex items-center justify-center gap-2 mt-1">
                <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
                <p className="text-sm font-semibold text-red-700 dark:text-red-400">{error}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.button type="submit" disabled={loading || code.length !== 6} whileHover={{ scale: loading || code.length !== 6 ? 1 : 1.02 }} whileTap={{ scale: loading || code.length !== 6 ? 1 : 0.98 }} className={btnPrimary}>
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShieldCheck className="w-5 h-5" />}
          {loading ? "Verifying Token..." : "Verify & Secure Account"}
        </motion.button>
      </form>
    </motion.div>
  );
}

// ─── Page Wrapper ─────────────────────────────────────────────────────────────

type Step = "checking" | "change-password" | "2fa-setup";

export default function FirstLoginPage() {
  const [step, setStep] = useState<Step>("checking");

  useEffect(() => {
    // No token: go to auth
    if (!getAuthToken()) {
      window.location.replace("/auth");
      return;
    }
    // Check user state to decide where to start
    getUser()
      .then((u) => {
        if (!u.isFirstLogin && u.twoFactorEnabled) {
          // Already fully set up — send to dashboard
          window.location.replace("/dashboard");
          return;
        }
        if (u.isFirstLogin) {
          setStep("change-password");
        } else {
          // Password already changed but 2FA not done
          setStep("2fa-setup");
        }
      })
      .catch(() => {
        // Partial token doesn't work with /me. Start at change-password.
        setStep("change-password");
      });
  }, []);

  function handlePasswordChanged() {
    setStep("2fa-setup");
  }

  function handleSetupComplete() {
    // Full login: go to dashboard
    window.location.replace("/dashboard");
  }

  const steps: Record<Step, number> = {
    "checking": 0,
    "change-password": 1,
    "2fa-setup": 2,
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#030712] flex flex-col relative overflow-hidden font-sans selection:bg-indigo-500/30">
      {/* Background decoration matching Pro Max Landing Page */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 right-1/4 w-full h-[80%] opacity-40 dark:opacity-20 bg-[radial-gradient(ellipse_at_center,var(--tw-gradient-stops))] from-indigo-500/30 via-transparent to-transparent animate-[float_10s_ease-in-out_infinite]" />
        <div className="absolute bottom-0 left-1/4 w-full h-[80%] opacity-40 dark:opacity-20 bg-[radial-gradient(ellipse_at_center,var(--tw-gradient-stops))] from-fuchsia-500/20 via-transparent to-transparent animate-[float_12s_ease-in-out_infinite_reverse]" />
        
        {/* Subtle grid */}
        <div 
          className="absolute inset-0 opacity-10 dark:opacity-[0.03]"
          style={{
            backgroundImage: "linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)",
            backgroundSize: "60px 60px",
            maskImage: "radial-gradient(ellipse 80% 80% at 50% 50%, #000 30%, transparent 100%)",
            WebkitMaskImage: "radial-gradient(ellipse 80% 80% at 50% 50%, #000 30%, transparent 100%)"
          }}
        />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12 relative z-10">
        <div className="w-full max-w-2xl">
          
          {/* Header */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-10 px-4">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-4xl bg-white/40 dark:bg-white/5 backdrop-blur-xl border border-white/50 dark:border-white/10 shadow-xl shadow-indigo-500/5 mb-6 group transition-all duration-500 hover:scale-110 hover:-rotate-3">
               <ShieldCheck className="w-8 h-8 text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform" />
            </div>
            <h1 className="text-4xl font-black tracking-tighter text-gray-900 dark:text-white mb-3">Secure Your Account</h1>
            <p className="text-base text-gray-600 dark:text-gray-400 max-w-sm mx-auto">
              Welcome aboard! Let&apos;s get your workspace fully secured in two simple steps.
            </p>
          </motion.div>

          {/* Card */}
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-white/60 dark:bg-[#030712]/60 backdrop-blur-3xl rounded-[2.5rem] border border-white/50 dark:border-white/10 shadow-2xl shadow-indigo-500/10 dark:shadow-black/50 overflow-hidden">
            
            {/* Step indicator header */}
            {step !== "checking" && (
              <div className="px-8 pt-10 pb-6 border-b border-gray-200/50 dark:border-white/5 bg-white/30 dark:bg-white/1">
                <div className="flex items-center justify-between relative max-w-sm mx-auto">
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1.5 bg-gray-200/50 dark:bg-gray-800 rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-linear-to-r from-indigo-500 to-fuchsia-500" 
                      initial={{ width: "0%" }}
                      animate={{ width: steps[step] === 1 ? "50%" : "100%" }} 
                      transition={{ duration: 1, ease: "easeInOut" }}
                    />
                  </div>
                  {[1, 2].map((num) => (
                    <div key={num} className={`relative w-12 h-12 rounded-2xl flex items-center justify-center text-sm font-bold transition-all duration-700 z-10 ${
                      steps[step] > num ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/30" : steps[step] === num ? "bg-white dark:bg-gray-900 text-indigo-600 dark:text-indigo-400 border-2 border-indigo-500 shadow-xl scale-110" : "bg-gray-100 dark:bg-gray-900 text-gray-400 border border-gray-200 dark:border-gray-800"
                    }`}>
                      {steps[step] > num ? <CheckCircle2 className="w-5 h-5 animate-in zoom-in" /> : num}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="p-8 sm:p-12 relative overflow-hidden">
              <AnimatePresence mode="wait">
                {step === "checking" && (
                  <motion.div key="checking" variants={cardVariants} initial="hidden" animate="visible" exit="exit" className="flex flex-col items-center justify-center py-16 gap-6">
                    <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
                    <p className="text-sm font-semibold text-gray-500 dark:text-gray-400 animate-pulse tracking-wide">Establishing Secure Handshake...</p>
                  </motion.div>
                )}
                {step === "change-password" && <ChangePasswordStep key="pw" onSuccess={handlePasswordChanged} />}
                {step === "2fa-setup" && <TwoFASetupStep key="2fa" onSuccess={handleSetupComplete} />}
              </AnimatePresence>
            </div>
          </motion.div>

          {/* Footer */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="text-center mt-10">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Having trouble?{" "}
              <Link 
                href="/contact" 
                className="font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 underline underline-offset-4 decoration-indigo-200 dark:decoration-indigo-500/30 hover:decoration-indigo-500 transition-all"
              >
                Contact Administrator
              </Link>
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
