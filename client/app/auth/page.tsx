"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { clearAuthToken, login, signup, verify2FA, get2FASetup, enable2FA, rollbackSignup, forgotPasswordRequest, forgotPasswordVerify, forgotPasswordReset } from "@/utils/authClient";

// ─── Open-redirect guard ──────────────────────────────────────────────────────
// Only allow same-origin relative paths (starts with "/", not "//").
// Rejects absolute URLs, protocol-relative URLs, and anything off-domain.
function safeRedirect(next: string | null, fallback = "/dashboard/courses"): string {
  if (!next) return fallback;
  if (!next.startsWith("/") || next.startsWith("//")) return fallback;
  // Block attempts like "/auth" to avoid redirect loops
  if (next === "/auth" || next.startsWith("/auth/")) return fallback;
  return next;
}

// ─── Shared input style ───────────────────────────────────────────────────────

const inputCls =
  "w-full px-3.5 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all";

const btnPrimary =
  "w-full py-2.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-gray-950 text-white text-sm font-semibold transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed";

// ─── Eye icon for password toggle ────────────────────────────────────────────

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  ) : (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

// ─── 2FA Step ─────────────────────────────────────────────────────────────────

type TwoFAMode = "verify" | "setup";

function TwoFAStep({
  mode,
  qrUrl,
  notice,
  onSuccess,
  onBack,
}: {
  mode: TwoFAMode;
  qrUrl?: string;
  notice?: string;
  onSuccess: () => void;
  onBack: () => void;
}) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  async function handleVerify(digits: string) {
    if (digits.length !== 6) return;
    setLoading(true);
    setError("");
    try {
      if (mode === "setup") {
        await enable2FA(digits);
      } else {
        await verify2FA(digits);
      }
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid code");
    } finally {
      setLoading(false);
    }
  }

  // Auto-submit when all 6 digits are entered
  useEffect(() => {
    if (code.length === 6) {
      handleVerify(code);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (code.length !== 6) { setError("Enter the 6-digit code"); return; }
    await handleVerify(code);
  }

  return (
    <div className="flex flex-col gap-6">
      {notice && (
        <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-3 py-2.5 text-xs text-amber-700 dark:text-amber-400">
          {notice}
        </div>
      )}

      {mode === "setup" && qrUrl && (
        <div className="flex flex-col items-center gap-3">
          <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
            Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)
          </p>
          <div className="p-3 rounded-xl bg-white border border-gray-200 dark:border-gray-700 shadow-sm inline-block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrUrl} alt="2FA QR Code" width={180} height={180} className="rounded" />
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-600 text-center">
            Then enter the 6-digit code shown in the app to verify.
          </p>
        </div>
      )}

      {mode === "verify" && (
        <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
          Enter the 6-digit code from your authenticator app to continue.
        </p>
      )}

      <form onSubmit={handleSubmit} autoComplete="off" className="flex flex-col gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
            Authenticator Code
          </label>
          <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            value={code}
            onChange={(e) => { setCode(e.target.value.replace(/\D/g, "").slice(0, 6)); setError(""); }}
            placeholder="000000"
            className={`${inputCls} text-center text-xl tracking-[0.5em] font-mono`}
          />
        </div>

        {error && (
          <p className="text-xs text-red-600 dark:text-red-400 text-center">{error}</p>
        )}

        <button type="submit" disabled={loading || code.length !== 6} className={btnPrimary}>
          {loading ? "Verifying…" : "Verify & Continue"}
        </button>
      </form>

      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center justify-center gap-1.5 w-full py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-indigo-300 dark:hover:border-indigo-700 hover:text-indigo-700 dark:hover:text-indigo-400 text-xs font-medium transition-all cursor-pointer"
      >
        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
          <path d="m15 18-6-6 6-6" />
        </svg>
        Go back
      </button>
    </div>
  );
}

// ─── Forgot Password — Email Step ───────────────────────────────────────────

function ForgotEmailForm({ onSuccess, onBack }: { onSuccess: () => void; onBack: () => void }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await forgotPasswordRequest(email.trim().toLowerCase());
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
        Enter your account email. You&apos;ll then verify your identity with your authenticator app.
      </p>
      <form onSubmit={handleSubmit} autoComplete="off" className="flex flex-col gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Email</label>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setError(""); }}
            placeholder="you@example.com"
            className={inputCls}
          />
        </div>
        {error && (
          <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2.5 text-xs text-red-700 dark:text-red-400">
            {error}
          </div>
        )}
        <button type="submit" disabled={loading} className={btnPrimary}>
          {loading ? "Checking…" : "Continue"}
        </button>
      </form>
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center justify-center gap-1.5 w-full py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-indigo-300 dark:hover:border-indigo-700 hover:text-indigo-700 dark:hover:text-indigo-400 text-xs font-medium transition-all cursor-pointer"
      >
        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
          <path d="m15 18-6-6 6-6" />
        </svg>
        Back to sign in
      </button>
    </div>
  );
}

// ─── Forgot Password — TOTP Step ─────────────────────────────────────────────

function ForgotTOTPStep({ onSuccess, onBack }: { onSuccess: () => void; onBack: () => void }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  async function handleVerify(digits: string) {
    if (digits.length !== 6) return;
    setLoading(true);
    setError("");
    try {
      await forgotPasswordVerify(digits);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid code");
      setCode("");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (code.length === 6) handleVerify(code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
        Enter the 6-digit code from your authenticator app to confirm your identity.
      </p>
      <form onSubmit={(e) => { e.preventDefault(); handleVerify(code); }} autoComplete="off" className="flex flex-col gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Authenticator Code</label>
          <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            value={code}
            onChange={(e) => { setCode(e.target.value.replace(/\D/g, "").slice(0, 6)); setError(""); }}
            placeholder="000000"
            className={`${inputCls} text-center text-xl tracking-[0.5em] font-mono`}
          />
        </div>
        {error && <p className="text-xs text-red-600 dark:text-red-400 text-center">{error}</p>}
        <button type="submit" disabled={loading || code.length !== 6} className={btnPrimary}>
          {loading ? "Verifying…" : "Verify"}
        </button>
      </form>
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center justify-center gap-1.5 w-full py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-indigo-300 dark:hover:border-indigo-700 hover:text-indigo-700 dark:hover:text-indigo-400 text-xs font-medium transition-all cursor-pointer"
      >
        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
          <path d="m15 18-6-6 6-6" />
        </svg>
        Go back
      </button>
    </div>
  );
}

// ─── Forgot Password — New Password Step ─────────────────────────────────────

function ForgotResetForm({ onSuccess, onBack }: { onSuccess: () => void; onBack: () => void }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm]   = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirm) { setError("Passwords do not match"); return; }
    if (password.length < 8)  { setError("Password must be at least 8 characters"); return; }
    setLoading(true);
    try {
      await forgotPasswordReset(password);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
        Choose a new password for your account.
      </p>
      <form onSubmit={handleSubmit} autoComplete="off" className="flex flex-col gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">New Password</label>
          <div className="relative">
            <input
              type={showPass ? "text" : "password"}
              required
              autoComplete="new-password"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              minLength={8}
              maxLength={16}
              data-lpignore="true"
              data-form-type="other"
              value={password}
              onChange={(e) => { setPassword(e.target.value.slice(0, 16)); setError(""); }}
              placeholder="8–16 characters"
              className={`${inputCls} pr-10`}
            />
            <button
              type="button"
              onClick={() => setShowPass((p) => !p)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors cursor-pointer"
            >
              <EyeIcon open={showPass} />
            </button>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Confirm Password</label>
          <input
            type={showPass ? "text" : "password"}
            required
            autoComplete="new-password"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            minLength={8}
            maxLength={16}
            data-lpignore="true"
            data-form-type="other"
            value={confirm}
            onChange={(e) => { setConfirm(e.target.value.slice(0, 16)); setError(""); }}
            placeholder="Re-enter your password"
            className={inputCls}
          />
        </div>
        {error && (
          <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2.5 text-xs text-red-700 dark:text-red-400">
            {error}
          </div>
        )}
        <button type="submit" disabled={loading} className={btnPrimary}>
          {loading ? "Saving…" : "Set New Password"}
        </button>
      </form>
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center justify-center gap-1.5 w-full py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-indigo-300 dark:hover:border-indigo-700 hover:text-indigo-700 dark:hover:text-indigo-400 text-xs font-medium transition-all cursor-pointer"
      >
        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
          <path d="m15 18-6-6 6-6" />
        </svg>
        Go back
      </button>
    </div>
  );
}

// ─── Login Form ───────────────────────────────────────────────────────────────

function LoginForm({
  onSuccess2FA,
  onSuccess2FASetup,
  onForgotPassword,
}: {
  onSuccess2FA: () => void;
  onSuccess2FASetup: (qrUrl: string) => void;
  onForgotPassword: () => void;
}) {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await login(email, password);
      if (data.requiresTwoFactorSetup) {
        const setup = await get2FASetup();
        onSuccess2FASetup(setup.qrCodeUrl);
        return;
      }
      if (data.requiresTwoFactor) {
        onSuccess2FA();
        return;
      }
      window.location.href = safeRedirect(searchParams.get("next"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} autoComplete="off" className="flex flex-col gap-4">
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
          Email
        </label>
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setError(""); }}
          placeholder="you@example.com"
          className={inputCls}
        />
      </div>
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Password</label>
          <button
            type="button"
            onClick={onForgotPassword}
            className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
          >
            Forgot password?
          </button>
        </div>
        <div className="relative">
          <input
            type={showPass ? "text" : "password"}
            required
            autoComplete="new-password"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            minLength={8}
            maxLength={16}
            data-lpignore="true"
            data-form-type="other"
            value={password}
            onChange={(e) => { setPassword(e.target.value.slice(0, 16)); setError(""); }}
            placeholder="8–16 characters"
            className={`${inputCls} pr-10`}
          />
          <button
            type="button"
            onClick={() => setShowPass((p) => !p)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors cursor-pointer"
          >
            <EyeIcon open={showPass} />
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2.5 text-xs text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      <button type="submit" disabled={loading} className={btnPrimary}>
        {loading ? "Signing in…" : "Sign In"}
      </button>
    </form>
  );
}

// ─── Signup Form ──────────────────────────────────────────────────────────────

function SignupForm({ onShow2FASetup }: { onShow2FASetup: (qrUrl: string) => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) { setError("Passwords do not match"); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters"); return; }
    if (password.length > 16) { setError("Password must be at most 16 characters"); return; }
    if (!inviteCode.trim()) { setError("Invite code is required"); return; }
    setLoading(true);
    try {
      const data = await signup(email, password, inviteCode.trim(), name.trim() || undefined);
      if (data.requiresTwoFactor || !data.token) {
        // Fetch 2FA setup QR
        const setup = await get2FASetup();
        onShow2FASetup(setup.qrCodeUrl);
        return;
      }
      // If no 2FA required (shouldn't happen in this flow but handle gracefully)
      onShow2FASetup("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign up failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} autoComplete="off" className="flex flex-col gap-4">
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
          Full Name <span className="text-gray-400">(optional)</span>
        </label>
        <input
          type="text"
          autoComplete="name"
          value={name}
          onChange={(e) => { setName(e.target.value); setError(""); }}
          placeholder="Jane Doe"
          className={inputCls}
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Email</label>
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setError(""); }}
          placeholder="you@example.com"
          className={inputCls}
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Password</label>
        <div className="relative">
          <input
            type={showPass ? "text" : "password"}
            required
            autoComplete="new-password"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            minLength={8}
            maxLength={16}
            data-lpignore="true"
            data-form-type="other"
            value={password}
            onChange={(e) => { setPassword(e.target.value.slice(0, 16)); setError(""); }}
            placeholder="8–16 characters"
            className={`${inputCls} pr-10`}
          />
          <button
            type="button"
            onClick={() => setShowPass((p) => !p)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors cursor-pointer"
          >
            <EyeIcon open={showPass} />
          </button>
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Confirm Password</label>
        <input
          type={showPass ? "text" : "password"}
          required
          autoComplete="new-password"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          minLength={8}
          maxLength={16}
          data-lpignore="true"
          data-form-type="other"
          value={confirmPassword}
          onChange={(e) => { setConfirmPassword(e.target.value.slice(0, 16)); setError(""); }}
          placeholder="Re-enter your password"
          className={inputCls}
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
          Invite Code <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          required
          value={inviteCode}
          onChange={(e) => { setInviteCode(e.target.value); setError(""); }}
          placeholder="Enter your invite code"
          className={inputCls}
        />
        <p className="text-[11px] text-gray-400 dark:text-gray-600 mt-1">
          An invite code is required to create an account.
        </p>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2.5 text-xs text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      <button type="submit" disabled={loading} className={btnPrimary}>
        {loading ? "Creating account…" : "Create Account"}
      </button>
    </form>
  );
}

// ─── Main Auth Page ───────────────────────────────────────────────────────────

type Step = "login" | "signup" | "2fa-verify" | "2fa-setup" | "forgot-email" | "forgot-2fa" | "forgot-reset";

function AuthPageInner() {
  const searchParams = useSearchParams();
  const [step, setStep] = useState<Step>("login");
  const [tab, setTab] = useState<"login" | "signup">("login");
  const [setupQrUrl, setSetupQrUrl] = useState("");
  const [twoFASetupSource, setTwoFASetupSource] = useState<"signup" | "login" | null>(null);

  const sessionExpired = searchParams.get("reason") === "session_expired";

  function handleLoginSuccess2FA() {
    setStep("2fa-verify");
  }

  function handleSignupSuccess2FA(qrUrl: string) {
    setSetupQrUrl(qrUrl);
    setTwoFASetupSource("signup");
    setStep("2fa-setup");
  }

  function handleLoginSetup2FA(qrUrl: string) {
    setSetupQrUrl(qrUrl);
    setTwoFASetupSource("login");
    setStep("2fa-setup");
  }

  function handleTwoFASuccess() {
    window.location.href = safeRedirect(searchParams.get("next"));
  }

  async function handleBack() {
    if (step === "2fa-setup") {
      if (twoFASetupSource === "signup") {
        // Delete the partially-created account before going back so the user
        // can re-submit the signup form with the same email without a 409 conflict.
        try { await rollbackSignup(); } catch { /* best-effort */ }
        setTab("signup");
        setStep("signup");
      } else {
        clearAuthToken();
        setTab("login");
        setStep("login");
      }
      setSetupQrUrl("");
      setTwoFASetupSource(null);
      return;
    }

    if (step === "2fa-verify") {
      clearAuthToken();
    }

    setTab("login");
    setStep("login");
  }

  // ── Forgot-password handlers ──────────────────────────────────────────────
  function handleForgotStart()  { setStep("forgot-email"); }
  function handleForgotEmail()  { setStep("forgot-2fa"); }
  function handleForgotTOTP()   { setStep("forgot-reset"); }
  function handleForgotReset()  { clearAuthToken(); setTab("login"); setStep("login"); }
  function handleForgotBack() {
    if (step === "forgot-2fa" || step === "forgot-reset") {
      clearAuthToken();
      setStep("forgot-email");
    } else {
      clearAuthToken();
      setTab("login");
      setStep("login");
    }
  }

  const showTwoFA   = step === "2fa-verify" || step === "2fa-setup";
  const showForgot  = step === "forgot-email" || step === "forgot-2fa" || step === "forgot-reset";

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
      {/* Card */}
      <div className="w-full max-w-md">

        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-lg shadow-gray-100/50 dark:shadow-black/30 overflow-hidden">
        {/* Session expired notice */}
          {sessionExpired && !showForgot && (
            <div className="mx-8 mt-5 mb-0 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-3 py-2.5 text-xs text-amber-700 dark:text-amber-400 flex items-center gap-2">
              <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              Your session was ended by a login from another device. Please sign in again.
            </div>
          )}

          {/* Tab bar (hidden during 2FA / forgot-password) */}
          {!showTwoFA && !showForgot && (
            <div className="flex border-b border-gray-100 dark:border-gray-800">
              {(["login", "signup"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => { setTab(t); setStep(t); }}
                  className={`flex-1 py-3.5 text-sm font-semibold transition-colors cursor-pointer ${
                    tab === t
                      ? "text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400 -mb-px"
                      : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                  }`}
                >
                  {t === "login" ? "Sign In" : "Create Account"}
                </button>
              ))}
            </div>
          )}

          {/* 2FA heading */}
          {showTwoFA && (
            <div className="px-8 pt-7 pb-1">
              <div className="flex items-center gap-3 mb-1">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center">
                  <svg className="w-4 h-4 text-indigo-600 dark:text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <rect x="5" y="11" width="14" height="10" rx="2" />
                    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">
                    {step === "2fa-setup" ? "Set Up Two-Factor Auth" : "Two-Factor Verification"}
                  </h2>
                  <p className="text-xs text-gray-400 dark:text-gray-600">Extra layer of security</p>
                </div>
              </div>
            </div>
          )}

          {/* Forgot-password heading */}
          {showForgot && (
            <div className="px-8 pt-7 pb-1">
              <div className="flex items-center gap-3 mb-1">
                <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/60 flex items-center justify-center">
                  <svg className="w-4 h-4 text-amber-600 dark:text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">
                    {step === "forgot-email" && "Reset Password"}
                    {step === "forgot-2fa"   && "Verify Identity"}
                    {step === "forgot-reset" && "Set New Password"}
                  </h2>
                  <p className="text-xs text-gray-400 dark:text-gray-600">
                    {step === "forgot-email" && "Step 1 of 3 — enter your email"}
                    {step === "forgot-2fa"   && "Step 2 of 3 — authenticator code"}
                    {step === "forgot-reset" && "Step 3 of 3 — choose a new password"}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Body */}
          <div className="px-8 py-7">
            {step === "login" && (
              <LoginForm
                onSuccess2FA={handleLoginSuccess2FA}
                onSuccess2FASetup={handleLoginSetup2FA}
                onForgotPassword={handleForgotStart}
              />
            )}
            {step === "signup" && <SignupForm onShow2FASetup={handleSignupSuccess2FA} />}
            {(step === "2fa-verify" || step === "2fa-setup") && (
              <TwoFAStep
                mode={step === "2fa-setup" ? "setup" : "verify"}
                qrUrl={setupQrUrl}
                notice={step === "2fa-setup" && twoFASetupSource === "login"
                  ? "Your account exists, but two-factor authentication setup was never completed. Scan the QR code below to finish setup before signing in."
                  : undefined}
                onSuccess={handleTwoFASuccess}
                onBack={handleBack}
              />
            )}
            {step === "forgot-email" && <ForgotEmailForm onSuccess={handleForgotEmail} onBack={handleForgotBack} />}
            {step === "forgot-2fa"   && <ForgotTOTPStep  onSuccess={handleForgotTOTP}  onBack={handleForgotBack} />}
            {step === "forgot-reset" && <ForgotResetForm onSuccess={handleForgotReset} onBack={handleForgotBack} />}
          </div>

          {/* Footer link */}
          {!showTwoFA && !showForgot && (
            <div className="px-8 pb-6 text-center">
              <p className="text-xs text-gray-400 dark:text-gray-600">
                {tab === "login" ? (
                  <>Don&apos;t have an account?{" "}
                    <button
                      type="button"
                      onClick={() => { setTab("signup"); setStep("signup"); }}
                      className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium cursor-pointer"
                    >
                      Sign up
                    </button>
                  </>
                ) : (
                  <>Already have an account?{" "}
                    <button
                      type="button"
                      onClick={() => { setTab("login"); setStep("login"); }}
                      className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium cursor-pointer"
                    >
                      Sign in
                    </button>
                  </>
                )}
              </p>
            </div>
          )}
        </div>

        {/* Back to home — hidden during 2FA / forgot-password (go-back inside card replaces it) */}
        {!showTwoFA && !showForgot && (
        <div className="mt-6 flex justify-center">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-indigo-300 dark:hover:border-indigo-700 hover:text-indigo-700 dark:hover:text-indigo-400 text-xs font-medium transition-all"
          >
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6" />
            </svg>
            Back to home
          </Link>
        </div>
        )}
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={
      <div className="flex-1 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" />
      </div>
    }>
      <AuthPageInner />
    </Suspense>
  );
}
