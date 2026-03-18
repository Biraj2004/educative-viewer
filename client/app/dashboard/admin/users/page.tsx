"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import AppNavbar from "@/components/edu-viewer/AppNavbar";
import UserMenu from "@/components/edu-viewer/UserMenu";
import { useAuth } from "@/components/edu-viewer/AuthProvider";
import { getAuthToken } from "@/utils/authClient";
import ActiveToggle from "@/components/edu-viewer/ActiveToggle";

// ─── Icons ────────────────────────────────────────────────────────────────────

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function MailIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  );
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function LoaderIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

function AlertIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

const BACKEND = (process.env.NEXT_PUBLIC_BACKEND_API_BASE ?? "").replace(/\/$/, "");

interface UserAccount {
  id: number;
  email: string;
  name: string | null;
  username: string | null;
  role_id: number;
  role_name: string;
  is_active: boolean;
  created_at: string;
}

export default function AdminUsersPage() {
  const { user, loading: authLoading } = useAuth();
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const isAdmin = user?.role === "admin";
  const authToken = getAuthToken() ?? "";

  const handleUserToggle = useCallback((userId: number, newValue: boolean) => {
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, is_active: newValue } : u))
    );
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!isAdmin) {
      setError("Forbidden: Admin access required");
      setLoading(false);
      return;
    }

    async function fetchUsers() {
      try {
        const res = await fetch(`${BACKEND}/api/admin/users`, {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        });

        if (!res.ok) {
          if (res.status === 403) throw new Error("Forbidden: Admin access required");
          throw new Error("Failed to fetch users");
        }

        const data = await res.json();
        setUsers(data);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "An unknown error occurred");
      } finally {
        setLoading(false);
      }
    }

    fetchUsers();
  }, [isAdmin, authLoading, authToken]);

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const search = searchQuery.toLowerCase();
      return (
        u.email.toLowerCase().includes(search) ||
        (u.name?.toLowerCase().includes(search) ?? false) ||
        (u.username?.toLowerCase().includes(search) ?? false)
      );
    });
  }, [users, searchQuery]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-black flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <LoaderIcon className="w-8 h-8 text-indigo-500 animate-spin" />
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Loading user accounts...</p>
        </div>
      </div>
    );
  }

  if (error && !isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-black">
        <AppNavbar crumbs={[{ label: "Admin" }, { label: "Users" }]} actions={<UserMenu />} backHref="/dashboard" backLabel="Dashboard" />
        <div className="max-w-7xl mx-auto px-4 py-20 flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-red-50 dark:bg-red-950/30 rounded-full flex items-center justify-center mb-6">
            <ShieldIcon className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">Access Denied</h1>
          <p className="text-gray-600 dark:text-gray-400 max-w-md">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black">
      <AppNavbar crumbs={[{ label: "Admin" }, { label: "Users" }]} actions={<UserMenu />} backHref="/dashboard" backLabel="Dashboard" />

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">User Management</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Manage all registered user accounts and their access status.
            </p>
          </div>

          <div className="relative w-full md:w-80">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, email or username..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
            />
          </div>
        </div>

        {error ? (
          <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-xl p-4 flex items-start gap-3">
            <AlertIcon className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-12 text-center">
            <div className="w-12 h-12 bg-gray-50 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <SearchIcon className="w-6 h-6 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">No users found</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {searchQuery ? `No users match "${searchQuery}"` : "There are no registered accounts in the system."}
            </p>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden overflow-x-auto shadow-sm">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50 dark:bg-gray-800/50 border-bottom border-gray-200 dark:border-gray-800">
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-12">ID</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">User</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Role</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Joined</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors">
                    <td className="px-6 py-4 text-sm text-gray-400 dark:text-gray-600 font-mono italic">{u.id}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-100 dark:border-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold shrink-0">
                          {u.name?.[0] || u.email[0].toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate flex items-center gap-1.5">
                            {u.name || u.username || "Anonymous"}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate flex items-center gap-1">
                            <MailIcon className="w-3 h-3" />
                            {u.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={[
                        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border",
                        u.role_name === "admin" 
                          ? "bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800/50"
                          : "bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800/50"
                      ].join(" ")}>
                        <ShieldIcon className="w-3 h-3 child-fill-current" />
                        {u.role_name}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                        <CalendarIcon className="w-3.5 h-3.5" />
                        {new Date(u.created_at).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end">
                        <ActiveToggle 
                          entity="user"
                          entityId={u.id}
                          isActive={u.is_active}
                          authToken={authToken}
                          disabled={u.role_name === "admin"}
                          onToggle={(v) => handleUserToggle(u.id, v)}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
