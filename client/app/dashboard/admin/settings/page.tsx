"use client";

import { useState, useEffect, type ChangeEvent } from "react";
import AppNavbar from "@/components/edu-viewer/AppNavbar";
import UserMenu from "@/components/edu-viewer/UserMenu";
import { adminGetSettings, adminSaveSettings } from "@/utils/authClient";
import LoadingSpinner from "@/components/edu-viewer/LoadingSpinner";

type AdminSettings = Record<string, string>;

const EyeIcon = ({ className, open }: { className?: string, open: boolean }) => (
  open ? (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )
);

function PasswordInput({ name, value, onChange, label }: { name: string, value: string, onChange: (e: ChangeEvent<HTMLInputElement>) => void, label: string }) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
      <div className="relative mt-1">
        <input 
          type={show ? "text" : "password"} 
          name={name} 
          value={value} 
          onChange={onChange} 
          className="block w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 py-2 pl-3 pr-10 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm dark:text-white" 
        />
        <button 
          type="button" 
          onClick={() => setShow(!show)} 
          className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
        >
          <EyeIcon className="w-4 h-4" open={show} />
        </button>
      </div>
    </div>
  );
}

export default function GlobalSettingsPage() {
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [jsonError, setJsonError] = useState("");
  const [featureFlagsJsonError, setFeatureFlagsJsonError] = useState("");
  const [roleOverridesJsonError, setRoleOverridesJsonError] = useState("");

  useEffect(() => {
    adminGetSettings()
      .then(data => {
        try {
          // Prettify JSON if it's an array
          if (data.course_sqlite_db_paths_json) {
            data.course_sqlite_db_paths_json = JSON.stringify(JSON.parse(data.course_sqlite_db_paths_json), null, 2);
          }
          if (data.viewer_feature_flags_json) {
            data.viewer_feature_flags_json = JSON.stringify(JSON.parse(data.viewer_feature_flags_json), null, 2);
          }
          if (data.viewer_feature_role_overrides_json) {
            data.viewer_feature_role_overrides_json = JSON.stringify(JSON.parse(data.viewer_feature_role_overrides_json), null, 2);
          }
        } catch {}
        setSettings(data);
      })
      .catch(console.error);
  }, []);

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setSettings({ ...settings, [e.target.name]: e.target.value });
    if (e.target.name === "course_sqlite_db_paths_json") {
      try {
        JSON.parse(e.target.value);
        setJsonError("");
      } catch {
        setJsonError("Invalid JSON format");
      }
    }
    if (e.target.name === "viewer_feature_flags_json") {
      try {
        JSON.parse(e.target.value);
        setFeatureFlagsJsonError("");
      } catch {
        setFeatureFlagsJsonError("Invalid JSON format");
      }
    }
    if (e.target.name === "viewer_feature_role_overrides_json") {
      try {
        JSON.parse(e.target.value);
        setRoleOverridesJsonError("");
      } catch {
        setRoleOverridesJsonError("Invalid JSON format");
      }
    }
  };

  const handleJsonFormat = (fieldName: string) => {
    if (!settings) return;
    try {
      const formatted = JSON.stringify(JSON.parse(settings[fieldName] || ""), null, 2);
      setSettings({ ...settings, [fieldName]: formatted });
      if (fieldName === "course_sqlite_db_paths_json") setJsonError("");
      if (fieldName === "viewer_feature_flags_json") setFeatureFlagsJsonError("");
      if (fieldName === "viewer_feature_role_overrides_json") setRoleOverridesJsonError("");
    } catch {
      if (fieldName === "course_sqlite_db_paths_json") setJsonError("Cannot format invalid JSON");
      if (fieldName === "viewer_feature_flags_json") setFeatureFlagsJsonError("Cannot format invalid JSON");
      if (fieldName === "viewer_feature_role_overrides_json") setRoleOverridesJsonError("Cannot format invalid JSON");
    }
  };

  const handleSave = async () => {
    if (!settings) return;
    setLoading(true);
    try {
      // Validate JSON before saving
      const finalSettings = { ...settings };
      if (finalSettings.course_sqlite_db_paths_json) {
        // Compact JSON for saving to env compactly
        finalSettings.course_sqlite_db_paths_json = JSON.stringify(JSON.parse(finalSettings.course_sqlite_db_paths_json));
      }
      if (finalSettings.viewer_feature_flags_json) {
        finalSettings.viewer_feature_flags_json = JSON.stringify(JSON.parse(finalSettings.viewer_feature_flags_json));
      }
      if (finalSettings.viewer_feature_role_overrides_json) {
        finalSettings.viewer_feature_role_overrides_json = JSON.stringify(JSON.parse(finalSettings.viewer_feature_role_overrides_json));
      }
      // Legacy key; avoid sending stale value that can override JSON flags.
      delete finalSettings.highlights_enabled;

      await adminSaveSettings(finalSettings);
      alert("Settings saved successfully.");
    } catch (e: unknown) {
      console.error(e);
      alert(e instanceof Error ? e.message : "Failed to save settings.");
    }
    setLoading(false);
  };

  if (!settings) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-950">
        <AppNavbar crumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Admin", href: "/dashboard/admin" }, { label: "Settings" }]} actions={<UserMenu />} />
        <main className="flex-1 flex items-center justify-center p-8">
          <LoadingSpinner label="Loading settings..." size="lg" />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-950">
      <AppNavbar crumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Admin", href: "/dashboard/admin" }, { label: "Settings" }]} actions={<UserMenu />} />
      <main className="flex-1 container mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12 max-w-7xl">
        <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white mb-6">Global Settings</h1>
        
        <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 space-y-6">
          
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Auth / JWT</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <PasswordInput name="jwt_secret" value={settings.jwt_secret || ''} onChange={handleChange} label="JWT Secret" />
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">JWT Expires (Days)</label>
              <input type="number" name="jwt_expires_days" value={settings.jwt_expires_days || ''} onChange={handleChange} className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 py-2 px-3 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm dark:text-white" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Invite Codes (Comma-separated)</label>
              <input type="text" name="invite_codes" value={settings.invite_codes || ''} onChange={handleChange} className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 py-2 px-3 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm dark:text-white" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">TOTP Issuer</label>
              <input type="text" name="totp_issuer" value={settings.totp_issuer || ''} onChange={handleChange} className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 py-2 px-3 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm dark:text-white" />
            </div>
          </div>

          <hr className="border-gray-200 dark:border-gray-800 my-6" />
          
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">AI / External APIs</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <PasswordInput name="gemini_api_key" value={settings.gemini_api_key || ''} onChange={handleChange} label="Gemini API Key" />
            <PasswordInput name="groq_api_key" value={settings.groq_api_key || ''} onChange={handleChange} label="Groq API Key" />
            <PasswordInput name="judge0_rapidapi_key" value={settings.judge0_rapidapi_key || ''} onChange={handleChange} label="Judge0 RapidAPI Key" />
          </div>

          <hr className="border-gray-200 dark:border-gray-800 my-6" />

          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Reader Features</h2>
          <div className="grid grid-cols-1 gap-4">
            <div>
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Global Viewer Feature Flags (JSON Object)</label>
                <button type="button" onClick={() => handleJsonFormat("viewer_feature_flags_json")} className="text-xs text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 font-medium">Format JSON</button>
              </div>
              <textarea
                name="viewer_feature_flags_json"
                rows={5}
                value={settings.viewer_feature_flags_json || ""}
                onChange={handleChange}
                className={`mt-1 block w-full rounded-md border ${featureFlagsJsonError ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 dark:border-gray-700 focus:border-indigo-500 focus:ring-indigo-500'} bg-gray-50 dark:bg-gray-950 py-3 px-4 shadow-sm sm:text-sm dark:text-gray-300 font-mono resize-y`}
                placeholder='{"highlights_enabled":true,"bookmarks_enabled":true,"notes_enabled":true,"search_enabled":true,"drawings_enabled":true}'
              />
              {featureFlagsJsonError && <p className="mt-1 text-xs text-red-500">{featureFlagsJsonError}</p>}
            </div>
            <div>
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Per-Role Feature Overrides (JSON Object)</label>
                <button type="button" onClick={() => handleJsonFormat("viewer_feature_role_overrides_json")} className="text-xs text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 font-medium">Format JSON</button>
              </div>
              <textarea
                name="viewer_feature_role_overrides_json"
                rows={6}
                value={settings.viewer_feature_role_overrides_json || ""}
                onChange={handleChange}
                className={`mt-1 block w-full rounded-md border ${roleOverridesJsonError ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 dark:border-gray-700 focus:border-indigo-500 focus:ring-indigo-500'} bg-gray-50 dark:bg-gray-950 py-3 px-4 shadow-sm sm:text-sm dark:text-gray-300 font-mono resize-y`}
                placeholder='{"admin":{"search_enabled":true,"drawings_enabled":true},"user":{"notes_enabled":false,"drawings_enabled":false}}'
              />
              {roleOverridesJsonError && <p className="mt-1 text-xs text-red-500">{roleOverridesJsonError}</p>}
            </div>
          </div>

          <hr className="border-gray-200 dark:border-gray-800 my-6" />
          
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Database</h2>
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Database Engine</label>
              <select name="course_db_engine" value={settings.course_db_engine || ''} onChange={handleChange} className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 py-2 px-3 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm dark:text-white">
                <option value="sqlite">SQLite</option>
                {/* Expand later if more options */}
              </select>
            </div>
            <div>
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Course SQLite DB Paths (JSON Array)</label>
                <button type="button" onClick={() => handleJsonFormat("course_sqlite_db_paths_json")} className="text-xs text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 font-medium">Format JSON</button>
              </div>
              <textarea name="course_sqlite_db_paths_json" rows={5} value={settings.course_sqlite_db_paths_json || ''} onChange={handleChange} className={`mt-1 block w-full rounded-md border ${jsonError ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 dark:border-gray-700 focus:border-indigo-500 focus:ring-indigo-500'} bg-gray-50 dark:bg-gray-950 py-3 px-4 shadow-sm sm:text-sm dark:text-gray-300 font-mono resize-y`} placeholder="[\n  &quot;C:\\path\\to\\db.sqlite3&quot;\n]" />
              {jsonError && <p className="mt-1 text-xs text-red-500">{jsonError}</p>}
            </div>
          </div>

          <div className="mt-8">
            <button onClick={handleSave} disabled={loading || !!jsonError || !!featureFlagsJsonError || !!roleOverridesJsonError} className="inline-flex justify-center rounded-md border border-transparent bg-indigo-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed">
              {loading ? "Saving..." : "Save Settings"}
            </button>
          </div>
          
        </div>
      </main>
    </div>
  );
}
