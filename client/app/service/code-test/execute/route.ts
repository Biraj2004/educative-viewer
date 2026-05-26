import { NextResponse } from "next/server";
import JSZip from "jszip";

type Judge0Provider = "ce" | "rapidapi";

const JUDGE0_PROVIDER_DEFAULT: Judge0Provider = "ce";
const JUDGE0_CE_EXECUTE_URL = "https://ce.judge0.com/submissions/?base64_encoded=false&wait=true";
const JUDGE0_CE_LANGUAGES_URL = "https://ce.judge0.com/languages";
const JUDGE0_RAPIDAPI_BASE_URL = process.env.JUDGE0_RAPIDAPI_BASE_URL ?? "https://judge029.p.rapidapi.com";
const JUDGE0_RAPIDAPI_HOST = process.env.JUDGE0_RAPIDAPI_HOST ?? "judge029.p.rapidapi.com";
const JUDGE0_RAPIDAPI_KEY = process.env.JUDGE0_RAPIDAPI_KEY;
const JUDGE0_LANGUAGES_CACHE_TTL_MS = 10 * 60 * 1000;
const RAPIDAPI_POLL_MAX_ATTEMPTS = 15;
const RAPIDAPI_POLL_INTERVAL_MS = 650;

const cachedLanguagesByProvider = new Map<Judge0Provider, {
  languages: Array<{ id: number; name: string }>;
  cachedAtMs: number;
}>();

interface ExecuteSubmission {
  language_id?: number;
  source_code?: string;
  stdin?: string;
  additional_files?: Record<string, string> | string;
}

interface ExecuteRequestBody {
  provider?: Judge0Provider;
  submissions?: ExecuteSubmission[];
  sharedAdditionalFiles?: Record<string, string>;
}

function parseProvider(value: unknown): Judge0Provider {
  return value === "rapidapi" ? "rapidapi" : JUDGE0_PROVIDER_DEFAULT;
}

function getRapidApiHeaders(): Record<string, string> {
  if (!JUDGE0_RAPIDAPI_KEY) {
    throw new Error("RapidAPI provider is not configured. Set JUDGE0_RAPIDAPI_KEY.");
  }

  return {
    "Content-Type": "application/json",
    "x-rapidapi-host": JUDGE0_RAPIDAPI_HOST,
    "x-rapidapi-key": JUDGE0_RAPIDAPI_KEY,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function encodeAdditionalFiles(
  additionalFiles: ExecuteSubmission["additional_files"],
): Promise<string | undefined> {
  if (!additionalFiles) return undefined;

  if (typeof additionalFiles === "string") {
    return additionalFiles;
  }

  const entries = Object.entries(additionalFiles).filter(([fileName, content]) => (
    Boolean(fileName) && typeof content === "string"
  ));

  if (!entries.length) return undefined;

  const zip = new JSZip();
  for (const [fileName, content] of entries) {
    zip.file(fileName, content);
  }

  const buffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
  });

  return buffer.toString("base64");
}

async function executeSingle(submission: ExecuteSubmission): Promise<{
  ok: boolean;
  payload: Record<string, unknown>;
}> {
  const encodedAdditionalFiles = await encodeAdditionalFiles(submission.additional_files);

  const response = await fetch(JUDGE0_CE_EXECUTE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      language_id: submission.language_id,
      source_code: submission.source_code,
      stdin: submission.stdin ?? "",
      additional_files: encodedAdditionalFiles,
    }),
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: response.ok, payload };
}

async function executeSingleViaRapidApi(submission: ExecuteSubmission): Promise<{
  ok: boolean;
  payload: Record<string, unknown>;
}> {
  const encodedAdditionalFiles = await encodeAdditionalFiles(submission.additional_files);
  const headers = getRapidApiHeaders();

  const createResponse = await fetch(`${JUDGE0_RAPIDAPI_BASE_URL}/submissions?base64_encoded=false`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      language_id: submission.language_id,
      source_code: submission.source_code,
      stdin: submission.stdin ?? "",
      additional_files: encodedAdditionalFiles,
    }),
    cache: "no-store",
  });

  const createPayload = (await createResponse.json().catch(() => ({}))) as Record<string, unknown>;
  if (!createResponse.ok) {
    return { ok: false, payload: createPayload };
  }

  const token = typeof createPayload.token === "string" ? createPayload.token : null;
  if (!token) {
    return {
      ok: false,
      payload: {
        error: "RapidAPI Judge0 did not return a submission token.",
        details: createPayload,
      },
    };
  }

  let lastPayload: Record<string, unknown> = createPayload;
  for (let attempt = 0; attempt < RAPIDAPI_POLL_MAX_ATTEMPTS; attempt += 1) {
    const resultResponse = await fetch(
      `${JUDGE0_RAPIDAPI_BASE_URL}/submissions/${encodeURIComponent(token)}?base64_encoded=false&fields=*`,
      {
        method: "GET",
        headers,
        cache: "no-store",
      },
    );

    lastPayload = (await resultResponse.json().catch(() => ({}))) as Record<string, unknown>;
    if (!resultResponse.ok) {
      return { ok: false, payload: lastPayload };
    }

    const status = lastPayload.status as { id?: unknown } | undefined;
    const statusId = typeof status?.id === "number" ? status.id : null;
    if (statusId !== null && statusId > 2) {
      return { ok: true, payload: lastPayload };
    }

    if (attempt < RAPIDAPI_POLL_MAX_ATTEMPTS - 1) {
      await sleep(RAPIDAPI_POLL_INTERVAL_MS);
    }
  }

  return {
    ok: false,
    payload: {
      error: "Timed out while waiting for Judge0 execution result from RapidAPI.",
      details: lastPayload,
    },
  };
}

async function executeSingleWithProvider(
  submission: ExecuteSubmission,
  provider: Judge0Provider,
): Promise<{ ok: boolean; payload: Record<string, unknown> }> {
  if (provider === "rapidapi") {
    return executeSingleViaRapidApi(submission);
  }
  return executeSingle(submission);
}

async function getLanguages(provider: Judge0Provider): Promise<Array<{ id: number; name: string }>> {
  const now = Date.now();
  const cached = cachedLanguagesByProvider.get(provider);
  if (cached && now - cached.cachedAtMs < JUDGE0_LANGUAGES_CACHE_TTL_MS) {
    return cached.languages;
  }

  const response = await fetch(provider === "rapidapi" ? `${JUDGE0_RAPIDAPI_BASE_URL}/languages` : JUDGE0_CE_LANGUAGES_URL, {
    method: "GET",
    headers: provider === "rapidapi"
      ? getRapidApiHeaders()
      : {
        "Content-Type": "application/json",
      },
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => null)) as unknown;
  if (!response.ok || !Array.isArray(payload)) {
    throw new Error("Failed to load language metadata from Judge0.");
  }

  const languages = payload
    .map((item) => {
      if (typeof item !== "object" || item === null) return null;
      const row = item as { id?: unknown; name?: unknown };
      if (typeof row.id === "number" && typeof row.name === "string") {
        return { id: row.id, name: row.name };
      }
      return null;
    })
    .filter((item): item is { id: number; name: string } => item !== null);

  cachedLanguagesByProvider.set(provider, {
    languages,
    cachedAtMs: now,
  });
  return languages;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const provider = parseProvider(searchParams.get("provider"));
    const languages = await getLanguages(provider);
    return NextResponse.json({ languages }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to fetch supported languages",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 502 },
    );
  }
}

export async function POST(request: Request) {
  let body: ExecuteRequestBody;

  try {
    body = (await request.json()) as ExecuteRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const submissions = body.submissions;
  const sharedAdditionalFiles = body.sharedAdditionalFiles;
  const provider = parseProvider(body.provider);

  try {
    if (!Array.isArray(submissions)) {
      return NextResponse.json({ error: "submissions array is required" }, { status: 400 });
    }

    if (!submissions.length) {
      return NextResponse.json({ error: "submissions cannot be empty" }, { status: 400 });
    }

    const results = await Promise.all(
      submissions.map(async (submission) => {
        if (!submission.language_id || !submission.source_code) {
          return {
            error: "language_id and source_code are required for each submission",
          };
        }

        try {
          const { ok, payload } = await executeSingleWithProvider({
            ...submission,
            additional_files: submission.additional_files ?? sharedAdditionalFiles,
          }, provider);
          if (!ok) {
            return {
              error: "Compiler service request failed",
              details: payload,
            };
          }

          return payload;
        } catch (error) {
          return {
            error: "Failed to reach compiler service",
            details: error instanceof Error ? error.message : "Unknown error",
          };
        }
      }),
    );

    return NextResponse.json({ submissions: results }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to reach compiler service",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 502 },
    );
  }
}
