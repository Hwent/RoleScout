import { NextRequest, NextResponse } from "next/server";
import { getMarketSnapshot } from "@/lib/adzuna";
import { ApiLimitError } from "@/lib/quota";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const title = request.nextUrl.searchParams.get("title")?.trim();
  if (!title) return NextResponse.json({ error: "Search for a job title before loading market data." }, { status: 400 });
  if (title.length > 100) return NextResponse.json({ error: "Search titles must be 100 characters or less." }, { status: 400 });

  const locationArea: string[] = [];
  for (let index = 0; index < 5; index++) {
    const part = request.nextUrl.searchParams.get(`loc${index}`)?.trim();
    if (part) {
      if (part.length > 100) return NextResponse.json({ error: "Location entries must be 100 characters or less." }, { status: 400 });
      locationArea.push(part);
    }
  }

  try {
    const snapshot = await getMarketSnapshot(title, locationArea);
    return NextResponse.json(snapshot, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof ApiLimitError) {
      return NextResponse.json({ error: error.message }, { status: 429, headers: { "Retry-After": String(error.retryAfterSeconds) } });
    }
    console.error("Adzuna market snapshot failed:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "The market snapshot is temporarily unavailable." }, { status: 502 });
  }
}
