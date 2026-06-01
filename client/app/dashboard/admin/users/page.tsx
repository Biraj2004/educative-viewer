"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import AppNavbar from "@/components/edu-viewer/AppNavbar";
import UserMenu from "@/components/edu-viewer/UserMenu";
import { useAuth } from "@/components/edu-viewer/AuthProvider";
import ActiveToggle from "@/components/edu-viewer/ActiveToggle";
import {
  adminGetUsers,
  adminCreateUser,
  adminEditUser,
  adminDeleteUser,
  adminResetUserPassword,
  adminGetUserSessions,
  adminClearUserSessions,
  adminCleanupUserReaderState,
  adminCleanupAllReaderState,
  type AdminUser,
  type AdminUserSession,
  type UserReaderCleanupScope,
  type GlobalCleanupScope,
} from "@/utils/authClient";

// ─── Icons ────────────────────────────────────────────────────────────────────

function Icon({ d, className }: { d: string; className?: string }) {
  return (
    <svg className={className ?? "w-4 h-4"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}
const PlusIcon = ({ className }: { className?: string }) => <Icon d="M12 5v14M5 12h14" className={className} />;
const PencilIcon = ({ className }: { className?: string }) => <Icon d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" className={className} />;
const TrashIcon = ({ className }: { className?: string }) => <Icon d="M3 6h18M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2" className={className} />;
const KeyIcon = ({ className }: { className?: string }) => <Icon d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4" className={className} />;
const SearchIcon = ({ className }: { className?: string }) => <svg className={className ?? "w-4 h-4"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>;
const XIcon = ({ className }: { className?: string }) => <Icon d="M18 6L6 18M6 6l12 12" className={className} />;
const ShieldCheckIcon = ({ className }: { className?: string }) => <svg className={className ?? "w-4 h-4"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><polyline points="9 12 11 14 15 10" /></svg>;
const EyeIcon = ({ className }: { className?: string }) => <svg className={className ?? "w-4 h-4"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>;
const EyeOffIcon = ({ className }: { className?: string }) => <svg className={className ?? "w-4 h-4"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>;
const CopyIcon = ({ className }: { className?: string }) => <Icon d="M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2M8 4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2H8z" className={className} />;
const DatabaseIcon = ({ className }: { className?: string }) => <Icon d="M12 2C7 2 3 3.79 3 6v12c0 2.21 4 4 9 4s9-1.79 9-4V6c0-2.21-4-4-9-4zm0 0v16m-9-6c0 2.21 4 4 9 4s9-1.79 9-4" className={className} />;
const SessionIcon = ({ className }: { className?: string }) => <Icon d="M20 16V8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8m16 0H4m16 0 2 3H2l2-3" className={className} />;

// ─── Shared input/button styles ───────────────────────────────────────────────

const inputCls = "w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all";
const btnPrimary = "px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed";
const btnGhost = "px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 text-sm font-medium transition-colors cursor-pointer";
const btnDanger = "px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors cursor-pointer disabled:opacity-60";

// ─── Temp password reveal card ────────────────────────────────────────────────

function TempPasswordCard({ password, expiresAt, onClose }: { password: string; expiresAt: string; onClose: () => void }) {
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(password).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const expiryDate = new Date(expiresAt);
  const expiryStr = expiryDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4 flex flex-col gap-3">
      <div className="flex items-start gap-2">
        <svg className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        <div>
          <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">Copy this password now — it won&apos;t be shown again</p>
          <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">Expires at {expiryStr}. Share it securely with the user.</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex-1 font-mono text-sm bg-white dark:bg-gray-900 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2 text-gray-900 dark:text-gray-100 tracking-wider">
          {show ? password : "•".repeat(password.length)}
        </div>
        <button onClick={() => setShow((s) => !s)} className="p-2 rounded-lg border border-amber-200 dark:border-amber-800 bg-white dark:bg-gray-900 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/30 cursor-pointer transition-colors">
          {show ? <EyeOffIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
        </button>
        <button onClick={handleCopy} className="p-2 rounded-lg border border-amber-200 dark:border-amber-800 bg-white dark:bg-gray-900 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/30 cursor-pointer transition-colors">
          {copied ? (
            <svg className="w-4 h-4 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
          ) : <CopyIcon className="w-4 h-4" />}
        </button>
      </div>

      <button onClick={onClose} className="text-xs text-amber-700 dark:text-amber-400 hover:underline cursor-pointer text-right">
        I&apos;ve copied the password — close
      </button>
    </div>
  );
}

// ─── Modal wrapper ────────────────────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer transition-colors">
            <XIcon className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 flex flex-col gap-4">{children}</div>
      </div>
    </div>
  );
}

// ─── Create User Modal ────────────────────────────────────────────────────────

function CreateUserModal({ onClose, onCreated }: { onClose: () => void; onCreated: (result: { password: string; expiresAt: string }) => void }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [roleId, setRoleId] = useState(1);
  const [maxActiveSessions, setMaxActiveSessions] = useState(1);
  const [maxIpAddresses, setMaxIpAddresses] = useState(2);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await adminCreateUser(
        email.trim().toLowerCase(),
        name.trim() || null,
        roleId,
        maxActiveSessions,
        maxIpAddresses,
      );
      onCreated({ password: result.temp_password, expiresAt: result.temp_password_expires_at });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create user");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title="Add User" onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Email <span className="text-red-500">*</span></label>
          <input type="email" required value={email} onChange={(e) => { setEmail(e.target.value); setError(""); }} placeholder="user@example.com" className={inputCls} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Full Name <span className="text-gray-400">(optional)</span></label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" className={inputCls} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Role</label>
          <select value={roleId} onChange={(e) => setRoleId(Number(e.target.value))} className={inputCls}>
            <option value={1}>User</option>
            <option value={2}>Admin</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Max Active Tokens Allowed</label>
          <input
            type="number"
            min={1}
            max={20}
            value={maxActiveSessions}
            onChange={(e) => setMaxActiveSessions(Math.max(1, Number(e.target.value) || 1))}
            className={inputCls}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Max IP Addresses Per Token</label>
          <input
            type="number"
            min={1}
            max={20}
            value={maxIpAddresses}
            onChange={(e) => setMaxIpAddresses(Math.max(1, Number(e.target.value) || 1))}
            className={inputCls}
          />
        </div>
        {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
        <div className="flex gap-2 justify-end pt-1">
          <button type="button" onClick={onClose} className={btnGhost}>Cancel</button>
          <button type="submit" disabled={loading} className={btnPrimary}>{loading ? "Creating…" : "Create User"}</button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Edit User Modal ──────────────────────────────────────────────────────────

function EditUserModal({
  user,
  currentUser,
  onClose,
  onSaved,
}: {
  user: AdminUser;
  currentUser: { id?: number } | null | undefined;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [email, setEmail] = useState(user.email);
  const [name, setName] = useState(user.name ?? "");
  const [roleId, setRoleId] = useState(user.role_id);
  const [maxActiveSessions, setMaxActiveSessions] = useState(user.max_active_sessions || 1);
  const [maxIpAddresses, setMaxIpAddresses] = useState(user.max_ip_addresses || 2);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const isSelf = !!currentUser && currentUser.id === user.id;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await adminEditUser(
        user.id,
        email.trim().toLowerCase(),
        name.trim() || null,
        isSelf ? undefined : roleId,
        maxActiveSessions,
        maxIpAddresses,
      );
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update user");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title="Edit User" onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Email <span className="text-red-500">*</span></label>
          <input type="email" required value={email} onChange={(e) => { setEmail(e.target.value); setError(""); }} className={inputCls} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Full Name</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="(none)" className={inputCls} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Role</label>
          <select 
            value={roleId} 
            onChange={(e) => setRoleId(Number(e.target.value))} 
            className={inputCls}
            disabled={isSelf}
            title={isSelf ? "You cannot change your own role" : ""}
          >
            <option value={1}>User</option>
            <option value={2}>Admin</option>
          </select>
          {isSelf && <p className="text-[10px] text-gray-500 mt-1">You cannot change your own role.</p>}
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Max Active Tokens Allowed</label>
          <input
            type="number"
            min={1}
            max={20}
            value={maxActiveSessions}
            onChange={(e) => setMaxActiveSessions(Math.max(1, Number(e.target.value) || 1))}
            className={inputCls}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Max IP Addresses Per Token</label>
          <input
            type="number"
            min={1}
            max={20}
            value={maxIpAddresses}
            onChange={(e) => setMaxIpAddresses(Math.max(1, Number(e.target.value) || 1))}
            className={inputCls}
          />
        </div>
        {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
        <div className="flex gap-2 justify-end pt-1">
          <button type="button" onClick={onClose} className={btnGhost}>Cancel</button>
          <button type="submit" disabled={loading} className={btnPrimary}>{loading ? "Saving…" : "Save Changes"}</button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────

function DeleteUserModal({ user, onClose, onDeleted }: { user: AdminUser; onClose: () => void; onDeleted: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleDelete() {
    setLoading(true);
    try {
      await adminDeleteUser(user.id);
      onDeleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete user");
      setLoading(false);
    }
  }

  return (
    <Modal title="Delete User" onClose={onClose}>
      <div className="text-sm text-gray-600 dark:text-gray-400">
        Are you sure you want to delete <strong className="text-gray-900 dark:text-gray-100">{user.name || user.email}</strong>?
        This action is <strong className="text-red-600">permanent</strong> and cannot be undone.
      </div>
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onClose} className={btnGhost}>Cancel</button>
        <button type="button" onClick={handleDelete} disabled={loading} className={btnDanger}>{loading ? "Deleting…" : "Delete"}</button>
      </div>
    </Modal>
  );
}

// ─── Reset Password Modal ─────────────────────────────────────────────────────

function ResetPasswordModal({ user, onClose, onReset }: { user: AdminUser; onClose: () => void; onReset: (result: { password: string; expiresAt: string }) => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleReset() {
    setLoading(true);
    try {
      const result = await adminResetUserPassword(user.id);
      onReset({ password: result.temp_password, expiresAt: result.temp_password_expires_at });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset password");
      setLoading(false);
    }
  }

  return (
    <Modal title="Reset Password" onClose={onClose}>
      <div className="text-sm text-gray-600 dark:text-gray-400">
        This will generate a new temporary password for <strong className="text-gray-900 dark:text-gray-100">{user.name || user.email}</strong> and re-enable the first-login gate. Their existing 2FA will also be cleared.
      </div>
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onClose} className={btnGhost}>Cancel</button>
        <button type="button" onClick={handleReset} disabled={loading} className={btnPrimary}>{loading ? "Resetting…" : "Reset Password"}</button>
      </div>
    </Modal>
  );
}

function UserSessionsModal({ user, onClose, onDone }: { user: AdminUser; onClose: () => void; onDone: () => void }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [sessions, setSessions] = useState<AdminUserSession[]>([]);
  const [lastLoginIp, setLastLoginIp] = useState<string | null>(null);
  const [lastLoginAt, setLastLoginAt] = useState<string | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await adminGetUserSessions(user.id);
      setSessions(result.sessions ?? []);
      setLastLoginIp(result.last_login_ip ?? null);
      setLastLoginAt(result.last_login_at ?? null);
      setSelectedKeys(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load sessions");
    } finally {
      setLoading(false);
    }
  }, [user.id]);

  useEffect(() => {
    void fetchSessions();
  }, [fetchSessions]);

  const selectedCount = selectedKeys.size;
  const allSelected = sessions.length > 0 && selectedCount === sessions.length;

  const toggleAll = () => {
    if (allSelected) {
      setSelectedKeys(new Set());
      return;
    }
    setSelectedKeys(new Set(sessions.map((session) => session.session_key)));
  };

  const toggleOne = (sessionKey: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(sessionKey)) next.delete(sessionKey);
      else next.add(sessionKey);
      return next;
    });
  };

  const clearSelected = async () => {
    if (selectedCount === 0) return;
    setSaving(true);
    setError("");
    try {
      await adminClearUserSessions(user.id, Array.from(selectedKeys), false);
      await fetchSessions();
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to clear selected sessions");
    } finally {
      setSaving(false);
    }
  };

  const clearAll = async () => {
    setSaving(true);
    setError("");
    try {
      await adminClearUserSessions(user.id, [], true);
      await fetchSessions();
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to clear all sessions");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="User Sessions" onClose={onClose}>
      <div className="text-sm text-gray-600 dark:text-gray-400">
        Active sessions for <strong className="text-gray-900 dark:text-gray-100">{user.name || user.email}</strong>.
      </div>
      <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-950/50 px-3 py-2">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Last login IP: <span className="font-medium text-gray-800 dark:text-gray-200">{lastLoginIp || "Unknown"}</span>
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          Last login time: <span className="font-medium text-gray-800 dark:text-gray-200">{lastLoginAt ? new Date(lastLoginAt).toLocaleString() : "Unknown"}</span>
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="w-6 h-6 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" />
        </div>
      ) : sessions.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-700 px-3 py-5 text-xs text-gray-500 dark:text-gray-400 text-center">
          No active sessions found.
        </div>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
          <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            Select all sessions ({sessions.length})
          </label>
          {sessions.map((session) => (
            <label
              key={session.session_key}
              className="flex items-start gap-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2"
            >
              <input
                type="checkbox"
                checked={selectedKeys.has(session.session_key)}
                onChange={() => toggleOne(session.session_key)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <div className="min-w-0">
                <p className="text-xs font-medium text-gray-900 dark:text-gray-100">
                  {session.is_most_recent ? "Most recent session" : "Active session"} - token ...{session.token_hint}
                </p>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                  Issued: {session.issued_at ? new Date(session.issued_at).toLocaleString() : "Unknown"}
                </p>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  IP: {session.ip || "Unknown"}
                </p>
              </div>
            </label>
          ))}
        </div>
      )}

      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      <div className="flex flex-wrap gap-2 justify-end">
        <button type="button" onClick={onClose} className={btnGhost}>Close</button>
        <button
          type="button"
          onClick={clearSelected}
          disabled={saving || selectedCount === 0 || sessions.length === 0}
          className={btnPrimary}
        >
          {saving ? "Clearing..." : `Clear Selected${selectedCount > 0 ? ` (${selectedCount})` : ""}`}
        </button>
        <button
          type="button"
          onClick={clearAll}
          disabled={saving || sessions.length === 0}
          className={btnDanger}
        >
          {saving ? "Clearing..." : "Clear All"}
        </button>
      </div>
    </Modal>
  );
}

const USER_CLEANUP_NON_ALL_KEYS: Array<Exclude<UserReaderCleanupScope, "all">> = ["notes", "highlights", "drawing", "bookmarks"];
const USER_CLEANUP_SCOPE_OPTIONS: Array<{ key: UserReaderCleanupScope; label: string; description: string }> = [
  { key: "all", label: "All", description: "Clear bookmarks, highlights, notes, and drawings." },
  { key: "notes", label: "Notes", description: "Topic notes and course notes." },
  { key: "highlights", label: "Highlights", description: "Highlighted text and attached notes." },
  { key: "drawing", label: "Drawing Board", description: "Saved drawing board canvases." },
  { key: "bookmarks", label: "Bookmarks", description: "All bookmarks saved by the reader." },
];

const GLOBAL_CLEANUP_NON_ALL_KEYS: Array<Exclude<GlobalCleanupScope, "all">> = ["notes", "highlights", "drawing", "bookmarks", "tokens"];
const GLOBAL_CLEANUP_SCOPE_OPTIONS: Array<{ key: GlobalCleanupScope; label: string; description: string }> = [
  { key: "all", label: "All", description: "Clear reader data and revoke every active user token." },
  { key: "notes", label: "Notes", description: "Topic notes and course notes." },
  { key: "highlights", label: "Highlights", description: "Highlighted text and attached notes." },
  { key: "drawing", label: "Drawing Board", description: "Saved drawing board canvases." },
  { key: "bookmarks", label: "Bookmarks", description: "All bookmarks saved by the reader." },
  { key: "tokens", label: "Active Tokens", description: "Force logout for everyone by clearing all active tokens." },
];

const createUserCleanupSelection = (): Record<UserReaderCleanupScope, boolean> => ({
  all: true,
  notes: true,
  highlights: true,
  drawing: true,
  bookmarks: true,
});

const createGlobalCleanupSelection = (): Record<GlobalCleanupScope, boolean> => ({
  all: true,
  notes: true,
  highlights: true,
  drawing: true,
  bookmarks: true,
  tokens: true,
});

const toggleUserCleanupSelection = (
  prev: Record<UserReaderCleanupScope, boolean>,
  key: UserReaderCleanupScope,
): Record<UserReaderCleanupScope, boolean> => {
  const next = { ...prev };
  if (key === "all") {
    const nextValue = !prev.all;
    USER_CLEANUP_SCOPE_OPTIONS.forEach((option) => {
      next[option.key] = nextValue;
    });
    return next;
  }
  next[key] = !prev[key];
  next.all = USER_CLEANUP_NON_ALL_KEYS.every((scope) => next[scope]);
  return next;
};

const toggleGlobalCleanupSelection = (
  prev: Record<GlobalCleanupScope, boolean>,
  key: GlobalCleanupScope,
): Record<GlobalCleanupScope, boolean> => {
  const next = { ...prev };
  if (key === "all") {
    const nextValue = !prev.all;
    GLOBAL_CLEANUP_SCOPE_OPTIONS.forEach((option) => {
      next[option.key] = nextValue;
    });
    return next;
  }
  next[key] = !prev[key];
  next.all = GLOBAL_CLEANUP_NON_ALL_KEYS.every((scope) => next[scope]);
  return next;
};

const getSelectedUserCleanupScopes = (selection: Record<UserReaderCleanupScope, boolean>) =>
  USER_CLEANUP_NON_ALL_KEYS.filter((scope) => selection[scope]);

const getSelectedGlobalCleanupScopes = (selection: Record<GlobalCleanupScope, boolean>) =>
  GLOBAL_CLEANUP_NON_ALL_KEYS.filter((scope) => selection[scope]);

function CleanupUserReaderDataModal({ user, onClose, onDone }: { user: AdminUser; onClose: () => void; onDone: () => void }) {
  const [scopeSelection, setScopeSelection] = useState<Record<UserReaderCleanupScope, boolean>>(createUserCleanupSelection);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const selectedScopes = getSelectedUserCleanupScopes(scopeSelection);
  const selectedScopeCount = selectedScopes.length;
  const useAll = selectedScopeCount === USER_CLEANUP_NON_ALL_KEYS.length;

  async function handleCleanup() {
    if (selectedScopeCount === 0) return;
    setLoading(true);
    setError("");
    try {
      const scopesToRun: UserReaderCleanupScope[] = useAll ? ["all"] : selectedScopes;
      for (const nextScope of scopesToRun) {
        await adminCleanupUserReaderState(user.id, nextScope);
      }
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cleanup reader data");
      setLoading(false);
    }
  }

  return (
    <Modal title="Cleanup User Reader Data" onClose={onClose}>
      <div className="text-sm text-gray-600 dark:text-gray-400">
        Select what to clear for <strong className="text-gray-900 dark:text-gray-100">{user.name || user.email}</strong> across all courses.
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Cleanup Scope</label>
        <div className="space-y-2">
          {USER_CLEANUP_SCOPE_OPTIONS.map((option) => (
            <label key={option.key} className="flex items-start gap-3 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3">
              <input
                type="checkbox"
                checked={scopeSelection[option.key]}
                onChange={() => setScopeSelection((prev) => toggleUserCleanupSelection(prev, option.key))}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span>
                <span className="block text-sm font-medium text-gray-900 dark:text-gray-100">{option.label}</span>
                <span className="block text-xs text-gray-500 dark:text-gray-400">{option.description}</span>
              </span>
            </label>
          ))}
        </div>
      </div>
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onClose} className={btnGhost}>Cancel</button>
        <button type="button" onClick={handleCleanup} disabled={loading || selectedScopeCount === 0} className={btnDanger}>
          {loading ? "Cleaning..." : "Cleanup"}
        </button>
      </div>
    </Modal>
  );
}

function GlobalCleanupReaderDataModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [scopeSelection, setScopeSelection] = useState<Record<GlobalCleanupScope, boolean>>(createGlobalCleanupSelection);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const selectedScopes = getSelectedGlobalCleanupScopes(scopeSelection);
  const selectedScopeCount = selectedScopes.length;
  const useAll = selectedScopeCount === GLOBAL_CLEANUP_NON_ALL_KEYS.length;

  async function handleCleanup() {
    if (selectedScopeCount === 0) return;
    setLoading(true);
    setError("");
    try {
      const scopesToRun: GlobalCleanupScope[] = useAll ? ["all"] : selectedScopes;
      for (const nextScope of scopesToRun) {
        await adminCleanupAllReaderState(nextScope);
      }
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to run global cleanup");
      setLoading(false);
    }
  }

  return (
    <Modal title="Global Maintenance Cleanup" onClose={onClose}>
      <div className="text-sm text-gray-600 dark:text-gray-400">
        This will run selected maintenance actions for every user and every course.
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Cleanup Scope</label>
        <div className="space-y-2">
          {GLOBAL_CLEANUP_SCOPE_OPTIONS.map((option) => (
            <label key={option.key} className="flex items-start gap-3 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3">
              <input
                type="checkbox"
                checked={scopeSelection[option.key]}
                onChange={() => setScopeSelection((prev) => toggleGlobalCleanupSelection(prev, option.key))}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span>
                <span className="block text-sm font-medium text-gray-900 dark:text-gray-100">{option.label}</span>
                <span className="block text-xs text-gray-500 dark:text-gray-400">{option.description}</span>
              </span>
            </label>
          ))}
        </div>
      </div>
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onClose} className={btnGhost}>Cancel</button>
        <button type="button" onClick={handleCleanup} disabled={loading || selectedScopeCount === 0} className={btnDanger}>
          {loading ? "Cleaning..." : "Cleanup All"}
        </button>
      </div>
    </Modal>
  );
}

// ─── Badges ───────────────────────────────────────────────────────────────────

function Badge({ label, color }: { label: string; color: "green" | "red" | "yellow" | "gray" | "blue" }) {
  const colors = {
    green: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400",
    red: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400",
    yellow: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400",
    gray: "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400",
    blue: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400",
  };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${colors[color]}`}>{label}</span>;
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminUsersPage() {
  const { user: currentUser, authToken } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  // Modal state
  const [showCreate, setShowCreate] = useState(false);
  const [editUser, setEditUser] = useState<AdminUser | null>(null);
  const [deleteUser, setDeleteUser] = useState<AdminUser | null>(null);
  const [resetUser, setResetUser] = useState<AdminUser | null>(null);
  const [cleanupUser, setCleanupUser] = useState<AdminUser | null>(null);
  const [sessionUser, setSessionUser] = useState<AdminUser | null>(null);
  const [showGlobalCleanup, setShowGlobalCleanup] = useState(false);
  const [tempPwResult, setTempPwResult] = useState<{ password: string; expiresAt: string } | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await adminGetUsers();
      setUsers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.email.toLowerCase().includes(q) ||
        (u.name ?? "").toLowerCase().includes(q) ||
        u.role_name.toLowerCase().includes(q),
    );
  }, [users, search]);


  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-950">
      {/* Navbar */}
      <AppNavbar
        crumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Admin", href: "/dashboard/admin" },
          { label: "Users" },
        ]}
        actions={<UserMenu />}
      />

      <main className="flex-1 container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-7xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">User Management</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {users.length} user{users.length !== 1 ? "s" : ""} registered
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowGlobalCleanup(true)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-red-500/40 text-red-400 hover:bg-red-500/10 text-sm font-semibold transition-colors cursor-pointer"
            >
              <DatabaseIcon className="w-4 h-4" />
              Global Maintenance
            </button>
            <button
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors cursor-pointer"
            >
              <PlusIcon className="w-4 h-4" />
              Add User
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email or role…"
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>

        {/* Temp password reveal after create/reset */}
        {tempPwResult && (
          <div className="mb-4">
            <TempPasswordCard
              password={tempPwResult.password}
              expiresAt={tempPwResult.expiresAt}
              onClose={() => setTempPwResult(null)}
            />
          </div>
        )}

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" />
          </div>
        ) : error ? (
          <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">{error}</div>
        ) : (
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">User</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden md:table-cell">Role</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden lg:table-cell">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden xl:table-cell">2FA</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden xl:table-cell">Setup</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Active</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-sm text-gray-400 dark:text-gray-600">
                        {search ? "No users match your search." : "No users found."}
                      </td>
                    </tr>
                  ) : (
                    filtered.map((u) => {
                      const isSelf = currentUser?.id === u.id;
                      return (
                        <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                          {/* User cell */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center shrink-0">
                                <span className="text-xs font-bold text-indigo-700 dark:text-indigo-400">
                                  {(u.name ?? u.email).charAt(0).toUpperCase()}
                                </span>
                              </div>
                              <div>
                                <p className="font-medium text-gray-900 dark:text-gray-100 leading-tight">
                                  {u.name || <span className="text-gray-400 italic">No name</span>}
                                  {isSelf && <span className="ml-1.5 text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-1.5 py-0.5 rounded-full">You</span>}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">{u.email}</p>
                              </div>
                            </div>
                          </td>

                          {/* Role */}
                          <td className="px-4 py-3 hidden md:table-cell">
                            <Badge label={u.role_name} color={u.role_name === "admin" ? "blue" : "gray"} />
                          </td>

                          {/* Status */}
                          <td className="px-4 py-3 hidden lg:table-cell">
                            {u.locked_until ? (
                              <Badge label="Locked" color="red" />
                            ) : u.is_first_login ? (
                              <Badge label="Setup Pending" color="yellow" />
                            ) : (
                              <Badge label="Active" color="green" />
                            )}
                          </td>

                          {/* 2FA */}
                          <td className="px-4 py-3 hidden xl:table-cell">
                            {u.two_factor_enabled ? (
                              <span className="inline-flex items-center gap-1 text-green-700 dark:text-green-400">
                                <ShieldCheckIcon className="w-3.5 h-3.5" />
                                <span className="text-xs font-medium">Enabled</span>
                              </span>
                            ) : (
                              <span className="text-xs text-gray-400 dark:text-gray-600">—</span>
                            )}
                          </td>

                          {/* First login */}
                          <td className="px-4 py-3 hidden xl:table-cell">
                            {u.is_first_login ? (
                              <Badge label="Pending" color="yellow" />
                            ) : (
                              <Badge label="Done" color="green" />
                            )}
                          </td>

                          {/* Active toggle */}
                          <td className="px-4 py-3 text-right">
                            {isSelf ? (
                              <div className="relative inline-flex items-center justify-center">
                                {/* Hidden placeholder to match width of ActiveToggle */}
                                <div className="inline-flex items-center gap-2 px-1.5 py-0.5 text-[10px] font-semibold opacity-0 select-none pointer-events-none">
                                  <span className="h-5 w-9 shrink-0 border border-transparent" />
                                  <span className="uppercase tracking-wider">Active</span>
                                </div>
                                <span className="absolute inset-0 flex items-center justify-center text-xs text-gray-400">—</span>
                              </div>
                            ) : (
                              <ActiveToggle
                                entity="user"
                                entityId={u.id}
                                isActive={u.is_active}
                                authToken={authToken ?? ""}
                                onToggle={(newVal) => setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, is_active: newVal } : x)))}
                              />
                            )}
                          </td>

                          {/* Action buttons */}
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => setEditUser(u)}
                                title="Edit user"
                                className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 cursor-pointer transition-colors"
                              >
                                <PencilIcon className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setResetUser(u)}
                                title="Reset password"
                                className="p-1.5 rounded-lg text-gray-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 cursor-pointer transition-colors"
                              >
                                <KeyIcon className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setCleanupUser(u)}
                                title="Cleanup reader data"
                                className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 cursor-pointer transition-colors"
                              >
                                <DatabaseIcon className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setSessionUser(u)}
                                title="Manage sessions"
                                className="p-1.5 rounded-lg text-gray-400 hover:text-cyan-600 dark:hover:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-900/20 cursor-pointer transition-colors"
                              >
                                <SessionIcon className="w-4 h-4" />
                              </button>
                              {isSelf ? (
                                <div className="p-1.5 opacity-0 select-none pointer-events-none shrink-0" aria-hidden="true">
                                  <TrashIcon className="w-4 h-4" />
                                </div>
                              ) : (
                                <button
                                  onClick={() => setDeleteUser(u)}
                                  title="Delete user"
                                  className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 cursor-pointer transition-colors"
                                >
                                  <TrashIcon className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Modals */}
      {showCreate && (
        <CreateUserModal
          onClose={() => setShowCreate(false)}
          onCreated={(result) => {
            setShowCreate(false);
            setTempPwResult(result);
            fetchUsers();
          }}
        />
      )}
      {editUser && (
        <EditUserModal
          user={editUser}
          currentUser={currentUser}
          onClose={() => setEditUser(null)}
          onSaved={() => { setEditUser(null); fetchUsers(); }}
        />
      )}
      {deleteUser && (
        <DeleteUserModal
          user={deleteUser}
          onClose={() => setDeleteUser(null)}
          onDeleted={() => { setDeleteUser(null); fetchUsers(); }}
        />
      )}
      {resetUser && (
        <ResetPasswordModal
          user={resetUser}
          onClose={() => setResetUser(null)}
          onReset={(result) => { setResetUser(null); setTempPwResult(result); fetchUsers(); }}
        />
      )}
      {cleanupUser && (
        <CleanupUserReaderDataModal
          user={cleanupUser}
          onClose={() => setCleanupUser(null)}
          onDone={() => { setCleanupUser(null); fetchUsers(); }}
        />
      )}
      {sessionUser && (
        <UserSessionsModal
          user={sessionUser}
          onClose={() => setSessionUser(null)}
          onDone={() => { fetchUsers(); }}
        />
      )}
      {showGlobalCleanup && (
        <GlobalCleanupReaderDataModal
          onClose={() => setShowGlobalCleanup(false)}
          onDone={() => { setShowGlobalCleanup(false); fetchUsers(); }}
        />
      )}
    </div>
  );
}
