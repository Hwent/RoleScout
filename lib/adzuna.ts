import { normalizeJob, type Job } from "@/lib/jobs";
import { reserveAdzunaRequest } from "@/lib/quota";

type CacheEntry = { expiresAt: number; jobs: Job[]; totalResults: number; pageCount: number };
const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 15 * 60_000;
const MAX_CACHE_ENTRIES = 200;
const RESULTS_PER_PAGE = 20;

export async function searchJobs(title: string, page: number): Promise<{ jobs: Job[]; cached: boolean; totalResults: number; pageCount: number }> {
  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;
  const country = (process.env.ADZUNA_COUNTRY || "ca").toLowerCase();
  if (!appId || !appKey) throw new Error("Adzuna credentials are not configured.");

  const normalizedTitle = title.toLocaleLowerCase().replace(/\s+/g, " ").trim();
  const cacheKey = `${country}:${normalizedTitle}:${page}`;
  const now = Date.now();
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > now) return { jobs: cached.jobs, cached: true, totalResults: cached.totalResults, pageCount: cached.pageCount };

  reserveAdzunaRequest(now);
  const params = new URLSearchParams({ app_id: appId, app_key: appKey, what: title, results_per_page: String(RESULTS_PER_PAGE), "content-type": "application/json" });
  const response = await fetch(`https://api.adzuna.com/v1/api/jobs/${encodeURIComponent(country)}/search/${page}?${params}`, { signal: AbortSignal.timeout(12_000) });
  if (!response.ok) throw new Error(`Adzuna returned HTTP ${response.status}.`);

  const payload = await response.json() as { results?: unknown[]; count?: number };
  const jobs = Array.isArray(payload.results) ? payload.results.map((item) => normalizeJob(item as Parameters<typeof normalizeJob>[0])) : [];
  const totalResults = Number.isFinite(payload.count) ? payload.count! : (page - 1) * RESULTS_PER_PAGE + jobs.length;
  const pageCount = Math.min(100, Math.max(page, Math.ceil(totalResults / RESULTS_PER_PAGE)));
  cache.set(cacheKey, { expiresAt: now + CACHE_TTL_MS, jobs, totalResults, pageCount });
  if (cache.size > MAX_CACHE_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey) cache.delete(oldestKey);
  }
  return { jobs, cached: false, totalResults, pageCount };
}
