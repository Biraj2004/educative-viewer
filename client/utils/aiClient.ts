import { getAuthToken, ApiError } from "./authClient";

const BACKEND = (process.env.NEXT_PUBLIC_BACKEND_API_BASE ?? "").replace(
  /\/$/,
  ""
);
const API = `${BACKEND}/api/ai`;

export const AVAILABLE_MODELS = [
  // ── User Requested Top Models ──
  { id: "gemini-3.1-flash-lite", name: "Gemini 3.1 Flash Lite", provider: "gemini" },
  { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B (Groq)", provider: "groq" },
  { id: "llama-3.1-8b-instant", name: "Llama 3.1 8B Instant (Groq)", provider: "groq" },
  { id: "meta-llama/llama-4-scout-17b-16e-instruct", name: "Llama 4 Scout 17B (Groq)", provider: "groq" },

  // ── Rest of Gemini Models ──
  { id: "gemma-4-26b-a4b-it", name: "Gemma 4 26B (Gemini)", provider: "gemini" },
  { id: "gemma-4-31b-it", name: "Gemma 4 31B (Gemini)", provider: "gemini" },
  { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", provider: "gemini" },
  { id: "gemini-2.5-flash-lite", name: "Gemini 2.5 Flash Lite", provider: "gemini" },
  { id: "gemini-3-flash-preview", name: "Gemini 3 Flash", provider: "gemini" },

  // ── Rest of Groq Models ──
  { id: "allam-2-7b", name: "Allam 2 7B (Groq)", provider: "groq" },
  { id: "groq/compound", name: "Compound (Groq)", provider: "groq" },
  { id: "groq/compound-mini", name: "Compound Mini (Groq)", provider: "groq" },
  { id: "meta-llama/llama-prompt-guard-2-22m", name: "Prompt Guard 2 22M (Groq)", provider: "groq" },
  { id: "meta-llama/llama-prompt-guard-2-86m", name: "Prompt Guard 2 86M (Groq)", provider: "groq" },
  { id: "openai/gpt-oss-120b", name: "GPT-OSS 120B (Groq)", provider: "groq" },
  { id: "openai/gpt-oss-20b", name: "GPT-OSS 20B (Groq)", provider: "groq" },
  { id: "openai/gpt-oss-safeguard-20b", name: "GPT-OSS Safeguard 20B (Groq)", provider: "groq" },
  { id: "qwen/qwen3-32b", name: "Qwen 3 32B (Groq)", provider: "groq" },
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
