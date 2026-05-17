import { getAuthToken, ApiError } from "./authClient";

const BACKEND = (process.env.NEXT_PUBLIC_BACKEND_API_BASE ?? "").replace(
  /\/$/,
  ""
);
const API = `${BACKEND}/api/ai`;

export const AVAILABLE_MODELS = [
  // ── Groq Models (Top tier performance & limits) ──
  { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B (Groq)", provider: "groq" }, // 30 RPM, 12K TPM
  { id: "openai/gpt-oss-120b", name: "GPT-OSS 120B (Groq)", provider: "groq" }, // 30 RPM, 8K TPM
  { id: "qwen/qwen3-32b", name: "Qwen 3 32B (Groq)", provider: "groq" }, // 60 RPM, 6K TPM
  
  // ── Gemini Models (High limits) ──
  { id: "gemma-4-31b", name: "Gemma 4 31B (Gemini)", provider: "gemini" }, // 15 RPM, Unlimited TPM
  { id: "gemma-4-26b", name: "Gemma 4 26B (Gemini)", provider: "gemini" }, // 15 RPM, Unlimited TPM
  
  // ── Groq Models (Strong performance) ──
  { id: "meta-llama/llama-4-scout-17b-16e-instruct", name: "Llama 4 Scout 17B (Groq)", provider: "groq" }, // 30 RPM, 30K TPM
  
  // ── Gemini Models (Standard free tier) ──
  { id: "gemini-3.1-flash-lite", name: "Gemini 3.1 Flash Lite", provider: "gemini" }, // 15 RPM, 250K TPM
  { id: "gemini-2.5-flash-lite", name: "Gemini 2.5 Flash Lite", provider: "gemini" }, // 10 RPM, 250K TPM
  
  // ── Groq Models (Fast) ──
  { id: "llama-3.1-8b-instant", name: "Llama 3.1 8B Instant (Groq)", provider: "groq" }, // 30 RPM, 6K TPM
  { id: "openai/gpt-oss-20b", name: "GPT-OSS 20B (Groq)", provider: "groq" }, // 30 RPM, 8K TPM
  { id: "groq/compound", name: "Compound (Groq)", provider: "groq" }, // 30 RPM, 70K TPM
  { id: "groq/compound-mini", name: "Compound Mini (Groq)", provider: "groq" }, // 30 RPM, 70K TPM
  { id: "allam-2-7b", name: "Allam 2 7B (Groq)", provider: "groq" }, // 30 RPM, 6K TPM
  
  // ── Gemini Models (Lower limits) ──
  { id: "gemini-3-flash", name: "Gemini 3 Flash", provider: "gemini" }, // 5 RPM, 250K TPM
  { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", provider: "gemini" }, // 5 RPM, 250K TPM
  
  // ── Gemini Models (0 RPM/RPD fallback) ──
  { id: "gemini-3.1-pro", name: "Gemini 3.1 Pro", provider: "gemini" },
  { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", provider: "gemini" },
  { id: "gemini-2-flash", name: "Gemini 2 Flash", provider: "gemini" },
  { id: "gemini-2-flash-lite", name: "Gemini 2 Flash Lite", provider: "gemini" },
];

export async function generateAIContent(payload: {
  systemPrompt?: string;
  userPrompt: string;
  history?: Array<{ role: string; content: string }>;
  model?: string;
  provider?: string;
  temperature?: number;
}): Promise<string> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API}/generate`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));
  
  if (!res.ok) {
    throw new ApiError(data?.error ?? "Failed to generate AI content", res.status);
  }

  return data.result;
}
