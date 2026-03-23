"use client";

import { useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface RequestBody {
  content_type: string;
  value: string;
}

interface RequestHeader {
  key: string;
  value: string;
}

interface RequestParam {
  key: string;
  value: string;
}

interface ApiRequest {
  body: RequestBody;
  headers: RequestHeader[];
  method: string;
  parameters: RequestParam[];
  url: string;
}

interface CollectionItem {
  id: string;
  name: string;
  request: ApiRequest;
  type: string;
}

interface Collection {
  id: string;
  name: string;
  items: CollectionItem[];
  type: string;
}

export interface ApiWidgetData {
  comp_id: string;
  caption: string;
  collections: Collection[];
  primaryRequestId: string;
  version: number;
}

interface ApiResponse {
  status: number;
  statusText: string;
  body: string;
  time: number;
  size: number;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asArray<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function normalizeParams(value: unknown): RequestParam[] {
  return asArray(value).map((v) => {
    const rec = asRecord(v);
    return { key: asString(rec.key), value: asString(rec.value) };
  });
}

function normalizeHeaders(value: unknown): RequestHeader[] {
  return asArray(value).map((v) => {
    const rec = asRecord(v);
    return { key: asString(rec.key), value: asString(rec.value) };
  });
}

function normalizeRequest(value: unknown): ApiRequest {
  const rec = asRecord(value);
  const bodyRec = asRecord(rec.body);
  return {
    body: {
      content_type: asString(bodyRec.content_type) || asString(bodyRec.contentType) || "None",
      value: asString(bodyRec.value),
    },
    headers: normalizeHeaders(rec.headers),
    method: asString(rec.method) || "GET",
    parameters: normalizeParams(rec.parameters ?? rec.params ?? rec.queryParams),
    url: asString(rec.url),
  };
}

function normalizeCollectionItem(value: unknown, index: number): CollectionItem {
  const rec = asRecord(value);
  return {
    id: asString(rec.id) || `item-${index}`,
    name: asString(rec.name) || `Request ${index + 1}`,
    request: normalizeRequest(rec.request),
    type: asString(rec.type),
  };
}

function normalizeCollections(value: unknown): Collection[] {
  return asArray(value).map((collection, cIndex) => {
    const rec = asRecord(collection);
    const items = asArray(rec.items).map((item, i) => normalizeCollectionItem(item, i));
    return {
      id: asString(rec.id) || `collection-${cIndex}`,
      name: asString(rec.name) || `Collection ${cIndex + 1}`,
      items,
      type: asString(rec.type),
    };
  });
}

function normalizeApiWidgetData(input: unknown): ApiWidgetData {
  const root = asRecord(input);
  const content = asRecord(root.content);
  const source = Array.isArray(content.collections) ? content : root;
  const rec = asRecord(source);

  return {
    comp_id: asString(rec.comp_id),
    caption: asString(rec.caption),
    collections: normalizeCollections(rec.collections),
    primaryRequestId: asString(rec.primaryRequestId),
    version: asNumber(rec.version),
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];

const METHOD_COLORS: Record<string, string> = {
  GET:    "text-green-600",
  POST:   "text-blue-600",
  PUT:    "text-yellow-600",
  PATCH:  "text-orange-500",
  DELETE: "text-red-600",
};

function flattenItems(collections: Collection[]): CollectionItem[] {
  return collections.flatMap((c) => c.items);
}

function formatBody(body: string) {
  try { return JSON.stringify(JSON.parse(body), null, 2); }
  catch { return body; }
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(2)} KB`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function APIWidget({ data }: { data: ApiWidgetData }) {
  const safeData = normalizeApiWidgetData(data);
  const allItems = flattenItems(safeData.collections);
  const primary = allItems.find((i) => i.id === safeData.primaryRequestId) ?? allItems[0];

  const [selectedId, setSelectedId] = useState(primary?.id ?? "");
  const [activeTab, setActiveTab] = useState<"Parameters" | "Headers" | "Body">("Parameters");
  const [response, setResponse] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [method, setMethod] = useState(primary?.request.method ?? "GET");
  const [url, setUrl] = useState(primary?.request.url ?? "");

  const selected = allItems.find((i) => i.id === selectedId) ?? primary;
  if (!selected) return null;

  const req = selected.request;

  const handleSend = async () => {
    setLoading(true);
    setError(null);
    setResponse(null);
    const start = Date.now();
    try {
      const target = new URL(url, window.location.origin);
      req.parameters.forEach((p) => { if (p.key) target.searchParams.set(p.key, p.value); });
      const headers: Record<string, string> = {};
      req.headers.forEach((h) => { if (h.key) headers[h.key] = h.value; });
      const init: RequestInit = { method };
      if (req.body.value && req.body.content_type !== "None") {
        (init as RequestInit & { body: string }).body = req.body.value;
        if (req.body.content_type === "JSON") headers["Content-Type"] = "application/json";
      }
      init.headers = headers;
      const res = await fetch(target.toString(), init);
      const text = await res.text();
      setResponse({
        status: res.status,
        statusText: res.statusText,
        body: text,
        time: Date.now() - start,
        size: new TextEncoder().encode(text).length,
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // When selecting a different request item, sync url/method
  const handleSelect = (item: CollectionItem) => {
    setSelectedId(item.id);
    setMethod(item.request.method);
    setUrl(item.request.url);
    setResponse(null);
    setError(null);
  };

  const statusColor = response
    ? response.status < 300 ? "text-green-600"
    : response.status < 400 ? "text-yellow-600"
    : "text-red-600"
    : "text-gray-400";

  return (
    <div className="max-w-4xl mx-auto px-6 py-2">
      <div className="rounded-lg border border-gray-200 shadow-sm overflow-hidden flex" style={{ minHeight: 420 }}>

        {/* ── Left sidebar: Collection ── */}
        <div className="w-56 shrink-0 border-r border-gray-200 bg-gray-50 flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
            <span className="text-sm font-semibold text-gray-700">Collection</span>
            <div className="flex items-center gap-2 text-gray-400">
              {/* Save icon */}
              <svg className="w-4 h-4 hover:text-gray-600 cursor-pointer" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V7l-4-4z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 21v-8H7v8M7 3v5h8" />
              </svg>
              {/* Refresh icon */}
              <svg className="w-4 h-4 hover:text-gray-600 cursor-pointer" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h5M20 20v-5h-5M4.93 14A8 8 0 1019.07 10" />
              </svg>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {allItems.map((item) => (
              <button
                key={item.id}
                onClick={() => handleSelect(item)}
                className={`w-full text-left px-4 py-2.5 text-sm transition-colors truncate cursor-pointer ${
                  item.id === selectedId
                    ? "bg-indigo-50 text-indigo-600 font-medium"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                {item.name}
              </button>
            ))}
          </div>
        </div>

        {/* ── Right Panel ── */}
        <div className="flex-1 flex flex-col min-w-0">

          {/* URL Bar */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200 bg-white">
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className={`text-sm font-semibold border border-gray-300 rounded px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400 ${METHOD_COLORS[method] ?? "text-gray-700"}`}
            >
              {METHODS.map((m) => (
                <option key={m} value={m} className="text-gray-800">{m}</option>
              ))}
            </select>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="flex-1 min-w-0 border border-gray-300 rounded px-3 py-1.5 text-sm font-mono text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-400"
              placeholder="Enter URL"
            />
            <button
              onClick={handleSend}
              disabled={loading}
              className="shrink-0 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-semibold px-5 py-1.5 rounded transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              {loading ? (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
              ) : "Send"}
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-200 bg-white px-4">
            {(["Parameters", "Headers", "Body"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
                  activeTab === tab
                    ? "border-indigo-600 text-gray-900 font-semibold"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 bg-white px-4 py-3 overflow-y-auto">
            {activeTab === "Parameters" && (
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="text-left text-gray-400 text-xs">
                    <th className="pb-2 pr-8 font-medium">Key</th>
                    <th className="pb-2 pr-8 font-medium">Value</th>
                    <th className="pb-2 font-medium">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {req.parameters.map((p, i) => (
                    <tr key={i} className="border-t border-gray-100">
                      <td className="py-1.5 pr-8 font-mono text-xs text-gray-700">{p.key}</td>
                      <td className="py-1.5 pr-8 font-mono text-xs text-gray-600">{p.value}</td>
                      <td className="py-1.5 text-xs text-gray-400"></td>
                    </tr>
                  ))}
                  {/* Add row hint */}
                  <tr className="border-t border-gray-100">
                    <td className="py-2 pr-8 text-xs text-gray-300">Add Key</td>
                    <td className="py-2 pr-8 text-xs text-gray-300">Add Value</td>
                    <td className="py-2 text-xs text-gray-300">Add Description</td>
                  </tr>
                </tbody>
              </table>
            )}
            {activeTab === "Headers" && (
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="text-left text-gray-400 text-xs">
                    <th className="pb-2 pr-8 font-medium">Key</th>
                    <th className="pb-2 font-medium">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {req.headers.map((h, i) => (
                    <tr key={i} className="border-t border-gray-100">
                      <td className="py-1.5 pr-8 font-mono text-xs text-gray-700">{h.key}</td>
                      <td className="py-1.5 font-mono text-xs text-gray-600">{h.value}</td>
                    </tr>
                  ))}
                  {req.headers.length === 0 && (
                    <tr className="border-t border-gray-100">
                      <td className="py-2 pr-8 text-xs text-gray-300">Add Key</td>
                      <td className="py-2 text-xs text-gray-300">Add Value</td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
            {activeTab === "Body" && (
              req.body.value ? (
                <pre className="text-xs font-mono text-gray-700 whitespace-pre-wrap bg-gray-50 rounded p-3">
                  {req.body.value}
                </pre>
              ) : (
                <p className="text-sm text-gray-300 italic py-2">No request body</p>
              )
            )}
          </div>

          {/* Response section */}
          <div className="border-t border-gray-200">
            <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-100">
              <span className="text-xs font-bold text-gray-600 tracking-widest uppercase">Response</span>
              <div className="flex items-center gap-3 text-xs text-gray-400">
                <span>
                  Status:{" "}
                  <span className={`font-semibold ${statusColor}`}>
                    {response ? `${response.status} ${response.statusText}` : "---"}
                  </span>
                </span>
                <span className="text-gray-300">|</span>
                <span>Size: <span className="text-gray-600">{response ? formatSize(response.size) : "---"}</span></span>
                <span className="text-gray-300">|</span>
                <span>Time: <span className="text-gray-600">{response ? `${response.time} ms` : "---"}</span></span>
              </div>
            </div>

            <div className="min-h-24 max-h-48 overflow-y-auto bg-white px-4 py-3">
              {!response && !error && !loading && (
                <p className="text-sm text-indigo-400 text-center pt-4">
                  Enter the URL and click Send to get a response
                </p>
              )}
              {loading && (
                <p className="text-sm text-gray-400 text-center pt-4">Sending request…</p>
              )}
              {error && (
                <p className="text-sm text-red-500 font-medium">{error}</p>
              )}
              {response && (
                <pre className="text-xs font-mono text-gray-700 whitespace-pre-wrap">
                  {formatBody(response.body)}
                </pre>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Caption */}
      {safeData.caption && (
        <p className="text-center text-sm text-gray-500 mt-3">{safeData.caption}</p>
      )}
    </div>
  );
}


