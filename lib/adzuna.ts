import { normalizeJob, type Job } from "@/lib/jobs";
import { reserveAdzunaRequest } from "@/lib/quota";

type CacheEntry = { expiresAt: number; jobs: Job[] };
const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 15 * 60_000;
const MAX_CACHE_ENTRIES = 200;

export async function searchJobs(title: string): Promise<{ jobs: Job[]; cached: boolean }> {
  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;
  const country = (process.env.ADZUNA_COUNTRY || "ca").toLowerCase();
  if (!appId || !appKey) throw new Error("Adzuna credentials are not configured.");

  const normalizedTitle = title.toLocaleLowerCase().replace(/\s+/g, " ").trim();
  const cacheKey = `${country}:${normalizedTitle}`;
  const now = Date.now();
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > now) return { jobs: cached.jobs, cached: true };

  reserveAdzunaRequest(now);
  const params = new URLSearchParams({ app_id: appId, app_key: appKey, what: title, results_per_page: "20", "content-type": "application/json" });
  const response = await fetch(`https://api.adzuna.com/v1/api/jobs/${encodeURIComponent(country)}/search/1?${params}`, { signal: AbortSignal.timeout(12_000) });
  if (!response.ok) throw new Error(`Adzuna returned HTTP ${response.status}.`);

  const payload = await response.json() as { results?: unknown[] };
  const jobs = Array.isArray(payload.results) ? payload.results.map((item) => normalizeJob(item as Parameters<typeof normalizeJob>[0])) : [];
  cache.set(cacheKey, { expiresAt: now + CACHE_TTL_MS, jobs });
  if (cache.size > MAX_CACHE_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey) cache.delete(oldestKey);
  }
  return { jobs, cached: false };
}
