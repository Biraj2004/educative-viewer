import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) {
    return new Response("Missing url parameter", { status: 400 });
  }

  // Forward incoming headers (especially Range for video streaming)
  const headers = new Headers(req.headers);
  headers.delete("host"); // Let fetch set the correct host

  try {
    const res = await fetch(url, {
      headers,
      redirect: "manual",
    });

    const responseHeaders = new Headers(res.headers);
    // Inject wildcard CORS headers so Sandpack iframe can read it
    const origin = req.headers.get("origin") || "*";
    responseHeaders.set("Access-Control-Allow-Origin", origin);
    responseHeaders.set("Access-Control-Allow-Methods", "GET, OPTIONS");
    responseHeaders.set("Access-Control-Allow-Private-Network", "true");
    responseHeaders.set("Access-Control-Expose-Headers", "Content-Length, Content-Range");

    return new Response(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers: responseHeaders,
    });
  } catch (err) {
    console.error("[asset-proxy] Error proxying asset:", err);
    return new Response("Error proxying asset", { status: 500 });
  }
}

export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get("origin") || "*";
  const reqHeaders = req.headers.get("Access-Control-Request-Headers") || "Range";
  
  return new Response(null, {
    status: 204, // 204 No Content is better for OPTIONS
    headers: {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": reqHeaders,
      "Access-Control-Allow-Private-Network": "true",
      "Access-Control-Max-Age": "86400",
    },
  });
}
