import { normalizeJob, type Job } from "@/lib/jobs";
import { reserveAdzunaRequest } from "@/lib/quota";

type CacheEntry = { expiresAt: number; jobs: Job[]; totalResults: number; pageCount: number };
export type JobSearchFilters = { location?: string; schedule?: "full_time" | "part_time"; employment?: "permanent" | "contract" };
const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 15 * 60_000;
const MAX_CACHE_ENTRIES = 200;
const RESULTS_PER_PAGE = 20;

export async function searchJobs(title: string, page: number, filters: JobSearchFilters = {}): Promise<{ jobs: Job[]; cached: boolean; totalResults: number; pageCount: number }> {
  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;
  const country = (process.env.ADZUNA_COUNTRY || "ca").toLowerCase();
  if (!appId || !appKey) throw new Error("Adzuna credentials are not configured.");

  const normalizedTitle = title.toLocaleLowerCase().replace(/\s+/g, " ").trim();
  const normalizedLocation = filters.location?.toLocaleLowerCase().replace(/\s+/g, " ").trim() || "";
  const cacheKey = `${country}:${normalizedTitle}:${normalizedLocation}:${filters.schedule || ""}:${filters.employment || ""}:${page}`;
  const now = Date.now();
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > now) return { jobs: cached.jobs, cached: true, totalResults: cached.totalResults, pageCount: cached.pageCount };

  reserveAdzunaRequest(now);
  const params = new URLSearchParams({ app_id: appId, app_key: appKey, what: title, results_per_page: String(RESULTS_PER_PAGE), "content-type": "application/json" });
  if (filters.location) params.set("where", filters.location);
  if (filters.schedule) params.set(filters.schedule, "1");
  if (filters.employment) params.set(filters.employment, "1");
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

export type MarketSnapshot = {
  histogram: Array<{ salary: number; vacancies: number }>;
  salaryTrend: Array<{ month: string; salary: number }>;
  companies: Array<{ name: string; vacancies: number; averageSalary: number | null }>;
  unavailable: string[];
  scope: "location" | "country";
  cached: boolean;
};

type MarketCacheEntry = { expiresAt: number; value: Omit<MarketSnapshot, "cached"> };
const marketCache = new Map<string, MarketCacheEntry>();
const MARKET_CACHE_TTL_MS = 6 * 60 * 60_000;

async function fetchMarketEndpoint<T>(country: string, endpoint: string, title: string, locationArea: string[], appId: string, appKey: string): Promise<T> {
  const params = new URLSearchParams({ app_id: appId, app_key: appKey, what: title, "content-type": "application/json" });
  locationArea.forEach((location, index) => params.set(`location${index}`, location));
  const response = await fetch(`https://api.adzuna.com/v1/api/jobs/${encodeURIComponent(country)}/${endpoint}?${params}`, { signal: AbortSignal.timeout(12_000) });
  if (!response.ok) throw new Error(`Adzuna ${endpoint} returned HTTP ${response.status}.`);
  return await response.json() as T;
}

export async function getMarketSnapshot(title: string, locationArea: string[] = []): Promise<MarketSnapshot> {
  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;
  const country = (process.env.ADZUNA_COUNTRY || "ca").toLowerCase();
  if (!appId || !appKey) throw new Error("Adzuna credentials are not configured.");

  const area = locationArea.slice(0, 5).map((part) => part.trim()).filter(Boolean);
  const normalizedTitle = title.toLocaleLowerCase().replace(/\s+/g, " ").trim();
  const key = `${country}:${normalizedTitle}:${area.join("|").toLocaleLowerCase()}`;
  const now = Date.now();
  const cached = marketCache.get(key);
  if (cached && cached.expiresAt > now) return { ...cached.value, cached: true };

  reserveAdzunaRequest(now, 3);
  const [histogramResult, historyResult, companyResult] = await Promise.allSettled([
    fetchMarketEndpoint<{ histogram?: Record<string, string | number> }>(country, "histogram", title, area, appId, appKey),
    fetchMarketEndpoint<{ month?: Record<string, string | number> }>(country, "history", title, area, appId, appKey),
    fetchMarketEndpoint<{ leaderboard?: Array<{ canonical_name?: string; count?: number; average_salary?: number }> }>(country, "top_companies", title, area, appId, appKey),
  ]);

  if ([histogramResult, historyResult, companyResult].every((result) => result.status === "rejected")) {
    throw new Error("Adzuna could not load market data right now.");
  }
  const histogram = histogramResult.status === "fulfilled" ? Object.entries(histogramResult.value.histogram ?? {}).map(([salary, vacancies]) => ({ salary: Number(salary), vacancies: Number(vacancies) })).filter((item) => Number.isFinite(item.salary) && Number.isFinite(item.vacancies)).sort((a, b) => a.salary - b.salary) : [];
  const salaryTrend = historyResult.status === "fulfilled" ? Object.entries(historyResult.value.month ?? {}).map(([month, salary]) => ({ month, salary: Number(salary) })).filter((item) => Number.isFinite(item.salary)).sort((a, b) => a.month.localeCompare(b.month)) : [];
  const companies = companyResult.status === "fulfilled" ? (companyResult.value.leaderboard ?? []).map((company) => ({ name: company.canonical_name?.trim() || "Company not listed", vacancies: Number(company.count) || 0, averageSalary: Number.isFinite(company.average_salary) ? company.average_salary! : null })) : [];
  const unavailable = [histogramResult.status === "rejected" ? "histogram" : "", historyResult.status === "rejected" ? "history" : "", companyResult.status === "rejected" ? "companies" : ""].filter(Boolean);
  const value = { histogram, salaryTrend, companies, unavailable, scope: area.length ? "location" as const : "country" as const };
  marketCache.set(key, { expiresAt: now + MARKET_CACHE_TTL_MS, value });
  if (marketCache.size > 100) {
    const oldestKey = marketCache.keys().next().value;
    if (oldestKey) marketCache.delete(oldestKey);
  }
  return { ...value, cached: false };
}
