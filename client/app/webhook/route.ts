import { revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const secret = process.env.REVALIDATE_SECRET;
  if (secret && body.secret !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tag = body.tag as string | undefined;
  if (!tag) {
    return NextResponse.json({ error: "Missing 'tag'" }, { status: 400 });
  }

  revalidateTag(tag, "default");
  return NextResponse.json({ revalidated: true, tag });
}