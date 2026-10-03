import { NextRequest, NextResponse } from "next/server";
import { searchJobs } from "@/lib/adzuna";
import { ApiLimitError } from "@/lib/quota";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const title = request.nextUrl.searchParams.get("title")?.trim();
  if (!title) return NextResponse.json({ error: "Enter a job title to search." }, { status: 400 });
  if (title.length > 100) return NextResponse.json({ error: "Search titles must be 100 characters or less." }, { status: 400 });

  try {
    const result = await searchJobs(title);
    return NextResponse.json({ jobs: result.jobs, cached: result.cached }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof ApiLimitError) {
      return NextResponse.json({ error: error.message }, { status: 429, headers: { "Retry-After": String(error.retryAfterSeconds) } });
    }
    console.error("Adzuna search failed:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "The job search service is temporarily unavailable." }, { status: 502 });
  }
}
