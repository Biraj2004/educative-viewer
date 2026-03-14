import { NextResponse } from "next/server";
import JSZip from "jszip";

const JUDGE0_EXECUTE_URL = "https://ce.judge0.com/submissions/?base64_encoded=false&wait=true";
const JUDGE0_LANGUAGES_URL = "https://ce.judge0.com/languages";
const JUDGE0_LANGUAGES_CACHE_TTL_MS = 10 * 60 * 1000;

let cachedLanguages: Array<{ id: number; name: string }> | null = null;
let cachedLanguagesAtMs = 0;

interface ExecuteSubmission {
  language_id?: number;
  source_code?: string;
  stdin?: string;
  additional_files?: Record<string, string> | string;
}

interface ExecuteRequestBody {
  submissions?: ExecuteSubmission[];
  sharedAdditionalFiles?: Record<string, string>;
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

  const response = await fetch(JUDGE0_EXECUTE_URL, {
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

async function getLanguages(): Promise<Array<{ id: number; name: string }>> {
  const now = Date.now();
  if (cachedLanguages && now - cachedLanguagesAtMs < JUDGE0_LANGUAGES_CACHE_TTL_MS) {
    return cachedLanguages;
  }

  const response = await fetch(JUDGE0_LANGUAGES_URL, {
    method: "GET",
    headers: {
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

  cachedLanguages = languages;
  cachedLanguagesAtMs = now;
  return languages;
}

export async function GET() {
  try {
    const languages = await getLanguages();
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
          const { ok, payload } = await executeSingle({
            ...submission,
            additional_files: submission.additional_files ?? sharedAdditionalFiles,
          });
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
