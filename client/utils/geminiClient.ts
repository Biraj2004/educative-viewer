import { getAuthToken, ApiError } from "./authClient";

const BACKEND = (process.env.NEXT_PUBLIC_BACKEND_API_BASE ?? "").replace(
  /\/$/,
  ""
);
const API = `${BACKEND}/api/gemini`;

export const AVAILABLE_MODELS = [
  { id: "gemma-4-31b", name: "Gemma 4 31B" },
  { id: "gemma-4-26b", name: "Gemma 4 26B" },
  { id: "gemini-3.1-flash-lite", name: "Gemini 3.1 Flash Lite" },
  { id: "gemini-2.5-flash-lite", name: "Gemini 2.5 Flash Lite" },
  { id: "gemini-3-flash", name: "Gemini 3 Flash" },
  { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash" },
  { id: "gemini-3.1-pro", name: "Gemini 3.1 Pro" },
  { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro" },
  { id: "gemini-2-flash", name: "Gemini 2 Flash" },
  { id: "gemini-2-flash-lite", name: "Gemini 2 Flash Lite" },
];

export async function generateGeminiContent(payload: {
  systemPrompt?: string;
  userPrompt: string;
  history?: Array<{ role: string; content: string }>;
  model?: string;
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
