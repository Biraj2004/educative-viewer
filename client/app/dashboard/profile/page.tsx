"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import AppNavbar from "@/components/AppNavbar";
import UserMenu from "@/components/UserMenu";
import { useAuth } from "@/components/AuthProvider";
import { changePassword } from "@/utils/authClient";

function safeFromPath(path: string | null): string | null {
  if (!path) return null;
  if (!path.startsWith("/") || path.startsWith("//")) return null;
  return path;
}

function backLabelFromPath(path: string | null): string {
  if (!path) return "Dashboard";
  if (path.includes("/topics/")) return "Topic";
  if (/^\/dashboard\/courses\/[^/]+\/[^/]+$/.test(path)) return "Course";
  if (path.startsWith("/dashboard/courses")) return "Courses";
  if (path.startsWith("/dashboard/test")) return "Test";
  if (path === "/") return "Home";
  if (path.startsWith("/dashboard")) return "Dashboard";
  return "Back";
}

// ─── Info row ─────────────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value?: string | boolean | null }) {
  if (value === undefined || value === null || value === "") return null;
  return (
    <div className="flex items-center gap-4 py-3 border-b border-gray-100 dark:border-gray-800 last:border-0">
      <span className="text-xs font-medium text-gray-400 dark:text-gray-600 w-32 shrink-0">{label}</span>
      <span className="text-sm text-gray-800 dark:text-gray-200 font-medium">
        {typeof value === "boolean" ? (value ? "Enabled" : "Disabled") : value}
      </span>
    </div>
  );
}

// ─── Badge ────────────────────────────────────────────────────────────────────

function Badge({ color, children }: { color: "green" | "gray" | "indigo"; children: React.ReactNode }) {
  const cls = {
    green: "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
    gray: "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700",
    indigo: "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border-indigo-100 dark:border-indigo-800",
  }[color];
  return (
    <span className={`inline-flex items-center text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${cls}`}>
      {children}
    </span>
  );
}

// ─── Eye toggle icon ────────────────────────────────────────────────────────

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

// ─── Password field ───────────────────────────────────────────────────────────

function PasswordField({
  id, label, value, onChange, show, onToggle, placeholder, autoComplete,
}: {
  id: string; label: string; value: string;
  onChange: (v: string) => void; show: boolean;
  onToggle: () => void; placeholder?: string; autoComplete?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-xs font-medium text-gray-500 dark:text-gray-400">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder ?? ""}
          autoComplete={autoComplete ?? "off"}
          className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-950 px-3 py-2 pr-10 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-transparent transition-shadow"
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={onToggle}
          className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors cursor-pointer"
          aria-label={show ? "Hide password" : "Show password"}
        >
          <EyeIcon open={show} />
        </button>
      </div>
    </div>
  );
}

// ─── Change Password card (collapsible) ──────────────────────────────────────

function ChangePasswordCard() {
  const [open, setOpen]         = useState(false);
  const [current, setCurrent]   = useState("");
  const [next, setNext]         = useState("");
  const [confirm, setConfirm]   = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext]       = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const handleToggle = () => {
    setOpen(o => !o);
    if (open) {
      setCurrent(""); setNext(""); setConfirm("");
      setShowCurrent(false); setShowNext(false); setShowConfirm(false);
      setStatus("idle"); setMessage("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");

    if (!current) { setStatus("error"); setMessage("Enter your current password."); return; }
    if (next.length < 8) { setStatus("error"); setMessage("New password must be at least 8 characters."); return; }
    if (next !== confirm) { setStatus("error"); setMessage("New passwords do not match."); return; }

    setStatus("loading");
    try {
      const res = await changePassword(current, next);
      setStatus("success");
      setMessage(res.message ?? "Password updated successfully.");
      setCurrent(""); setNext(""); setConfirm("");
    } catch (err: unknown) {
      setStatus("error");
      setMessage((err as { message?: string })?.message ?? "Failed to update password.");
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
      <button
        type="button"
        onClick={handleToggle}
        className="w-full px-5 py-4 flex items-center justify-between gap-2 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Change Password</h3>
        </div>
        <svg
          className={`w-4 h-4 text-gray-400 dark:text-gray-500 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <form onSubmit={handleSubmit} className="px-5 pb-5 pt-1 space-y-4 border-t border-gray-100 dark:border-gray-800">
          <PasswordField
            id="cp-current" label="Current Password" value={current}
            onChange={setCurrent} show={showCurrent} onToggle={() => setShowCurrent(s => !s)}
            placeholder="Enter current password"
          />
          <PasswordField
            id="cp-new" label="New Password" value={next}
            onChange={setNext} show={showNext} onToggle={() => setShowNext(s => !s)}
            placeholder="At least 8 characters" autoComplete="new-password"
          />
          <PasswordField
            id="cp-confirm" label="Confirm New Password" value={confirm}
            onChange={setConfirm} show={showConfirm} onToggle={() => setShowConfirm(s => !s)}
            placeholder="Repeat new password" autoComplete="new-password"
          />

          {message && (
            <p className={`text-xs font-medium ${
              status === "success"
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-red-500 dark:text-red-400"
            }`}>
              {message}
            </p>
          )}

          <div className="pt-1">
            <button
              type="submit"
              disabled={status === "loading"}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer text-white text-xs font-semibold transition-colors"
            >
              {status === "loading" ? (
                <>
                  <span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  Updating…
                </>
              ) : "Update Password"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/auth?next=/dashboard/profile");
    }
  }, [loading, user, router]);

  useEffect(() => {
    document.title = "Profile · Edu-Viewer PRO";
  }, []);

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" />
      </div>
    );
  }

  const displayName = user.name ?? user.username ?? user.email ?? "User";
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w: string) => w[0].toUpperCase())
    .join("");

  const joinedDate = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    : null;
  const fromPath = safeFromPath(searchParams.get("from"));
  const backHref = fromPath && fromPath !== "/dashboard/profile" ? fromPath : "/dashboard";
  const backLabel = backLabelFromPath(fromPath);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <AppNavbar
        crumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Profile" }]}
        backHref={backHref}
        backLabel={backLabel}
        actions={<UserMenu />}
      />

      {/* Sub-header */}
      <div className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="max-w-3xl mx-auto px-6 py-5">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">My Profile</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">View and manage your account details</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">

        {/* Avatar card */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-2xl bg-indigo-600 flex items-center justify-center shrink-0 select-none shadow-md shadow-indigo-200 dark:shadow-indigo-900/30">
              {user.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.avatar} alt={displayName} className="w-16 h-16 rounded-2xl object-cover" />
              ) : (
                <span className="text-white font-bold text-xl">{initials || "?"}</span>
              )}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 truncate">{displayName}</h2>
                {user.role && (
                  <Badge color="indigo">{user.role}</Badge>
                )}
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 truncate">{user.email}</p>
              {joinedDate && (
                <p className="text-xs text-gray-400 dark:text-gray-600 mt-1">Member since {joinedDate}</p>
              )}
            </div>
          </div>
        </div>

        {/* Account details */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2">
            <svg className="w-4 h-4 text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
            </svg>
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Account Details</h3>
          </div>
          <div className="px-5">
            <InfoRow label="Full Name" value={user.name} />
            <InfoRow label="Username" value={user.username} />
            <InfoRow label="Email" value={user.email} />
            <InfoRow label="Role" value={user.role} />
            <InfoRow label="Member Since" value={joinedDate ?? undefined} />
            <InfoRow label="Account ID" value={String(user.id ?? "")} />
          </div>
        </div>

        {/* Security */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2">
            <svg className="w-4 h-4 text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <rect x="5" y="11" width="14" height="10" rx="2" />
              <path d="M8 11V7a4 4 0 0 1 8 0v4" />
            </svg>
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Security</h3>
          </div>
          <div className="px-5 py-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Two-Factor Authentication</p>
              <p className="text-xs text-gray-400 dark:text-gray-600 mt-0.5">
                {user.twoFactorEnabled
                  ? "Your account is protected with 2FA."
                  : "Add an extra layer of security to your account."}
              </p>
            </div>
            <Badge color={user.twoFactorEnabled ? "green" : "gray"}>
              {user.twoFactorEnabled ? "Enabled" : "Disabled"}
            </Badge>
          </div>
        </div>

        {/* Change Password */}
        <ChangePasswordCard />

        {/* Actions */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2">
            <svg className="w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Actions</h3>
          </div>
          <div className="px-5 py-4">
            <Link
              href="/auth"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-red-600 dark:hover:text-red-400 hover:border-red-200 dark:hover:border-red-800 transition-all"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              Sign Out
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}
