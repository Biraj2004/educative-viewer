import { NextResponse } from "next/server";

function getBackendApiBase(): string {
  const raw = (process.env.NEXT_PUBLIC_BACKEND_API_BASE ?? "").trim();
  if (!raw) {
    return "";
  }

  try {
    const url = new URL(raw);
    return url.toString().replace(/\/$/, "");
  } catch {
    return "";
  }
}

async function proxyToBackend(request: Request, method: "GET" | "POST") {
  const backendApiBase = getBackendApiBase();
  if (!backendApiBase) {
    return NextResponse.json(
      { error: "Backend API base URL is not configured" },
      { status: 500 },
    );
  }

  const incomingUrl = new URL(request.url);
  const provider = incomingUrl.searchParams.get("provider");
  const targetUrl = new URL(`${backendApiBase}/api/code-test/execute`);
  if (provider) {
    targetUrl.searchParams.set("provider", provider);
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const authHeader = request.headers.get("authorization");
  if (authHeader) headers["Authorization"] = authHeader;
  const fingerprintHeader = request.headers.get("x-device-fingerprint");
  if (fingerprintHeader) headers["X-Device-Fingerprint"] = fingerprintHeader;

  const upstream = await fetch(targetUrl.toString(), {
    method,
    headers,
    body: method === "POST" ? await request.text() : undefined,
    cache: "no-store",
  });

  const responseText = await upstream.text();
  const contentType = upstream.headers.get("content-type") ?? "application/json";
  return new NextResponse(responseText, {
    status: upstream.status,
    headers: {
      "Content-Type": contentType,
    },
  });
}

export async function GET(request: Request) {
  try {
    return await proxyToBackend(request, "GET");
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to reach backend code test service",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 502 },
    );
  }
}

export async function POST(request: Request) {
  try {
    return await proxyToBackend(request, "POST");
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to reach backend code test service",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 502 },
    );
  }
}
