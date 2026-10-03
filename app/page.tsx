"use client";

import { FormEvent, useState } from "react";
import { correctJobTitle } from "@/lib/title-matching";

type Job = {
  id: string;
  title: string;
  company: string;
  location: string;
  description: string;
  requiredSkills: string[];
  preferredSkills: string[];
  mentionedSkills: string[];
  url: string;
  created: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryIsPredicted: boolean | null;
  locationArea: string[];
};

type Filters = { location: string; schedule: "" | "full_time" | "part_time"; employment: "" | "permanent" | "contract" };
type MarketSnapshot = {
  histogram: Array<{ salary: number; vacancies: number }>;
  salaryTrend: Array<{ month: string; salary: number }>;
  companies: Array<{ name: string; vacancies: number; averageSalary: number | null }>;
  unavailable: string[];
  scope: "location" | "country";
  cached: boolean;
};

function salaryLabel(job: Job) {
  if (job.salaryMin == null && job.salaryMax == null) return null;
  const format = (amount: number) => new Intl.NumberFormat("en-CA", { maximumFractionDigits: 0 }).format(amount);
  const amount = job.salaryMin != null && job.salaryMax != null ? `$${format(job.salaryMin)}–$${format(job.salaryMax)}` : `From $${format(job.salaryMin ?? job.salaryMax!)}`;
  const kind = job.salaryIsPredicted === true ? "Adzuna estimate" : job.salaryIsPredicted === false ? "Advertised salary" : "Salary type not identified";
  return { amount, kind };
}

function currency(amount: number) {
  return `$${new Intl.NumberFormat("en-CA", { maximumFractionDigits: 0 }).format(amount)}`;
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [searchedTitle, setSearchedTitle] = useState("");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);
  const [searchCorrection, setSearchCorrection] = useState<{ from: string; to: string } | null>(null);
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [totalResults, setTotalResults] = useState(0);
  const [location, setLocation] = useState("");
  const [availableLocations, setAvailableLocations] = useState<string[]>([]);
  const [schedule, setSchedule] = useState<Filters["schedule"]>("");
  const [employment, setEmployment] = useState<Filters["employment"]>("");
  const [activeFilters, setActiveFilters] = useState<Filters>({ location: "", schedule: "", employment: "" });
  const [market, setMarket] = useState<MarketSnapshot | null>(null);
  const [marketError, setMarketError] = useState("");
  const [marketLoading, setMarketLoading] = useState(false);
  const [marketOpen, setMarketOpen] = useState(false);

  async function loadPage(title: string, targetPage: number, filters: Filters) {
    if (!title || loading) return;
    setLoading(true);
    setError("");
    setSearched(true);
    try {
      const params = new URLSearchParams({ title, page: String(targetPage) });
      if (filters.location.trim()) params.set("location", filters.location.trim());
      if (filters.schedule) params.set("schedule", filters.schedule);
      if (filters.employment) params.set("employment", filters.employment);
      const response = await fetch(`/api/jobs?${params}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Search failed. Please try again.");
      setJobs(data.jobs);
      setAvailableLocations((current) => [...new Set([...current, ...data.jobs.map((job: Job) => job.location).filter(Boolean)])].sort((a, b) => a.localeCompare(b)));
      setPage(targetPage);
      setPageCount(data.pageCount || 1);
      setTotalResults(data.totalResults || data.jobs.length);
    } catch (caught) {
      setJobs([]);
      setPageCount(1);
      setTotalResults(0);
      setError(caught instanceof Error ? caught.message : "Search failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const originalTitle = query.trim();
    const correction = correctJobTitle(originalTitle);
    const title = correction.title;
    setSearched(true);
    setSearchedTitle(title);
    setSearchCorrection(correction.corrected ? { from: originalTitle, to: title } : null);
    const filters = { location, schedule, employment };
    setActiveFilters(filters);
    setMarket(null);
    setMarketError("");
    setMarketOpen(false);
    await loadPage(title, 1, filters);
  }

  async function changePage(targetPage: number) {
    if (targetPage < 1 || targetPage > pageCount || targetPage === page || loading) return;
    await loadPage(searchedTitle, targetPage, activeFilters);
  }

  async function toggleMarket() {
    if (market) { setMarketOpen((open) => !open); return; }
    setMarketLoading(true);
    setMarketError("");
    setMarketOpen(true);
    try {
      const params = new URLSearchParams({ title: searchedTitle });
      const requestedLocation = activeFilters.location.trim().toLocaleLowerCase();
      if (requestedLocation) {
        const terms = requestedLocation.split(/[\s,]+/).filter(Boolean);
        const match = jobs.find((job) => job.locationArea.some((part) => {
          const normalizedPart = part.toLocaleLowerCase();
          return normalizedPart === requestedLocation || terms.some((term) => term.length > 1 && normalizedPart.includes(term));
        }));
        match?.locationArea.slice(0, 5).forEach((part, index) => params.set(`loc${index}`, part));
      }
      const response = await fetch(`/api/market?${params}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Market data could not be loaded.");
      setMarket(data as MarketSnapshot);
    } catch (caught) {
      setMarketError(caught instanceof Error ? caught.message : "Market data could not be loaded.");
    } finally {
      setMarketLoading(false);
    }
  }

  const firstVisiblePage = Math.max(1, Math.min(page - 2, pageCount - 4));
  const visiblePages = Array.from({ length: Math.min(pageCount, 5) }, (_, index) => firstVisiblePage + index);
  const skillCounts = new Map<string, { count: number; titles: Set<string> }>();
  const titleCounts = new Map<string, { title: string; count: number }>();
  for (const job of jobs) {
    const skills = new Set([...job.requiredSkills, ...job.preferredSkills, ...job.mentionedSkills]);
    const titleKey = job.title.trim().toLocaleLowerCase();
    const existingTitle = titleCounts.get(titleKey);
    titleCounts.set(titleKey, { title: existingTitle?.title ?? job.title.trim(), count: (existingTitle?.count ?? 0) + 1 });
    for (const skill of skills) {
      const existingSkill = skillCounts.get(skill) ?? { count: 0, titles: new Set<string>() };
      existingSkill.count++;
      existingSkill.titles.add(titleKey);
      skillCounts.set(skill, existingSkill);
    }
  }
  const commonSkills = [...skillCounts].sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0])).slice(0, 6);
  const relatedTitles = [...titleCounts.values()].sort((a, b) => b.count - a.count || a.title.localeCompare(b.title)).slice(0, 5);

  return (
    <main className="shell">
      <header className="topbar"><a className="brand" href="/" aria-label="RoleScout home"><span className="brand-mark">R</span> rolescout</a><span className="top-note">Real jobs. Clearer possibilities.</span></header>

      <section className="hero" aria-labelledby="hero-title">
        <div className="eyebrow"><span className="eyebrow-dot" /> JOB EXPLORER</div>
        <h1 id="hero-title">Find your next<br /><span>kind of work.</span></h1>
        <p className="intro">Search a role and explore real job listings, descriptions, and the skills employers ask for.</p>
        <form className="search-form" onSubmit={search}>
          <div className="search-row">
          <label className="sr-only" htmlFor="job-title">Job title</label>
          <span className="search-icon" aria-hidden="true">⌕</span>
          <input id="job-title" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Try “product designer” or “data analyst”" autoComplete="off" />
          <button type="submit" disabled={loading || !query.trim()}>{loading ? "Searching…" : "Search jobs"}<span aria-hidden="true">→</span></button>
          </div>
          <div className="search-filters">
            <label>Location<select value={location} onChange={(event) => setLocation(event.target.value)} disabled={availableLocations.length === 0}><option value="">Any location</option>{availableLocations.map((place) => <option key={place} value={place}>{place}</option>)}</select></label>
            <label>Hours<select value={schedule} onChange={(event) => setSchedule(event.target.value as Filters["schedule"])}><option value="">Any schedule</option><option value="full_time">Full-time</option><option value="part_time">Part-time</option></select></label>
            <label>Employment<select value={employment} onChange={(event) => setEmployment(event.target.value as Filters["employment"])}><option value="">Any type</option><option value="permanent">Permanent</option><option value="contract">Contract</option></select></label>
          </div>
        </form>
        <div className="search-hint">Search by job title <span>·</span>{availableLocations.length ? " Choose from locations in Adzuna results" : " Run a broad search to load valid location choices"}</div>
      </section>

      <section className="results" aria-live="polite">
        {loading && <div className="state-card"><span className="loader" />Looking for matching roles…</div>}
        {!loading && error && <div className="state-card error-card"><strong>We couldn’t complete that search.</strong><span>{error}</span></div>}
        {!loading && !error && searched && jobs.length === 0 && <div className="state-card"><strong>No listings found for “{searchedTitle}”.</strong><span>{searchCorrection ? `We also tried the corrected title from “${searchCorrection.from}”.` : "Try a broader job title or another spelling."}</span></div>}
        {!loading && !error && jobs.length > 0 && <>
          {searchCorrection && <div className="search-correction" role="status">Approximate title match: “{searchCorrection.from}” → “{searchCorrection.to}”</div>}
          <div className="results-heading"><div><div className="section-kicker">SEARCH RESULTS</div><h2>Jobs for “{searchedTitle}”</h2></div><span className="result-count">{totalResults.toLocaleString()} listings</span></div>
          <div className="market-action"><p>Explore broader salary and employer patterns for this role.</p><button type="button" onClick={toggleMarket} disabled={marketLoading}>{marketLoading ? "Loading snapshot…" : market ? (marketOpen ? "Hide market snapshot" : "Show market snapshot") : "Load market snapshot"}<span aria-hidden="true">{marketOpen || marketLoading ? "⌃" : "⌄"}</span></button></div>
          {marketOpen && <MarketPanel market={market} loading={marketLoading} error={marketError} />}
          <section className="patterns-card" aria-label="Patterns in these job results">
            <div className="patterns-heading"><div><div className="section-kicker">CURRENT PAGE · {jobs.length} JOBS</div><h3>Patterns across these roles</h3></div><span className="patterns-mark" aria-hidden="true">✳</span></div>
            <div className="patterns-columns">
              <div className="pattern-group"><h4>Shared skill signals</h4>{commonSkills.length ? <ul>{commonSkills.map(([skill, data]) => <li key={skill}><span>{skill}</span><span>{data.count} {data.count === 1 ? "job" : "jobs"} · {data.titles.size} {data.titles.size === 1 ? "title" : "titles"}</span></li>)}</ul> : <p className="pattern-empty">No recognizable skill terms found in these excerpts.</p>}</div>
              <div className="pattern-group"><h4>Role titles in this search</h4>{relatedTitles.length ? <ul>{relatedTitles.map(({ title, count }) => <li key={title}><span>{title}</span><span>{count} {count === 1 ? "job" : "jobs"}</span></li>)}</ul> : <p className="pattern-empty">No role titles available.</p>}</div>
            </div>
            <p className="pattern-limit">These are patterns in the jobs on this page only. Adzuna provides description excerpts, and skill terms are automatically identified; they may miss skills or misread context. Confirm requirements in the employer’s full posting.</p>
          </section>
          <div className="job-list">{jobs.map((job) => <article className="job-card" key={job.id}>
            <div className="job-card-top"><div className="company-mark">{job.company.trim().charAt(0).toUpperCase() || "J"}</div><div className="job-heading"><h3>{job.title}</h3><p>{job.company}</p></div><a className="open-link" href={job.url} target="_blank" rel="noreferrer" aria-label={`Open ${job.title} at ${job.company}`}>↗</a></div>
            <div className="job-meta"><span>⌖ {job.location || "Location not specified"}</span>{salaryLabel(job) && <span className="salary-info"><strong>{salaryLabel(job)!.amount}</strong><span className={`salary-kind${job.salaryIsPredicted === true ? " estimated" : ""}`}>{salaryLabel(job)!.kind}</span></span>}{job.created && <span>Posted {new Date(job.created).toLocaleDateString("en-CA", { month: "short", day: "numeric" })}</span>}</div>
            <section className="skill-summary" aria-label="Skills in this job description">
              {job.requiredSkills.length > 0 || job.preferredSkills.length > 0 ? <>
                <SkillGroup label="Required skills" skills={job.requiredSkills} />
                <SkillGroup label="Preferred skills" skills={job.preferredSkills} />
              </> : <SkillGroup label="Skills mentioned in description" skills={job.mentionedSkills} inferred />}
            </section>
            <details className="description"><summary>Expand job description <span>＋</span></summary><p>{job.description || "No description was provided for this listing."}</p><p className="description-note">Adzuna provides a short description excerpt. Open the listing for the complete posting.</p><a className="source-link" href={job.url} target="_blank" rel="noreferrer">Open full posting at source ↗</a></details>
          </article>)}</div>
          {pageCount > 1 && <nav className="pagination" aria-label="Job result pages">
            <button type="button" className="page-step" onClick={() => changePage(page - 1)} disabled={page <= 1 || loading}>← Previous</button>
            <div className="page-numbers">{visiblePages.map((pageNumber) => <button type="button" key={pageNumber} className={`page-number${pageNumber === page ? " active" : ""}`} aria-current={pageNumber === page ? "page" : undefined} onClick={() => changePage(pageNumber)} disabled={loading}>{pageNumber}</button>)}{pageCount > visiblePages[visiblePages.length - 1] && <span className="page-ellipsis">…</span>}</div>
            <button type="button" className="page-step" onClick={() => changePage(page + 1)} disabled={page >= pageCount || loading}>Next →</button>
          </nav>}
        </>}
        {!searched && <div className="below-fold-note"><span className="note-icon">✳</span><div><strong>Start with a title, explore the roles around it.</strong><p>Search live listings, compare skill signals, and optionally open a cached market snapshot.</p></div></div>}
      </section>
      <footer><span>ROLESCOUT</span><a className="adzuna-credit" href="https://www.adzuna.ca/" target="_blank" rel="noreferrer">Jobs by Adzuna</a></footer>
    </main>
  );
}

function SkillGroup({ label, skills, inferred = false }: { label: string; skills: string[]; inferred?: boolean }) {
  const emptyMessage = inferred ? "No recognizable skill terms found in this excerpt" : "Not specified separately in this excerpt";
  return <div className="skill-group"><div className="skill-group-title">{label}{inferred && <span className="inferred-label">SUMMARY</span>}</div>{skills.length > 0 ? <div className="skill-chips">{skills.map((skill) => <span className="skill-chip" key={skill}>{skill}</span>)}</div> : <span className="skill-empty">{emptyMessage}</span>}</div>;
}

function MarketPanel({ market, loading, error }: { market: MarketSnapshot | null; loading: boolean; error: string }) {
  if (loading) return <div className="market-panel state-card"><span className="loader" />Loading salary distribution, history, and top employers…</div>;
  if (error) return <div className="market-panel state-card error-card"><strong>Market snapshot unavailable.</strong><span>{error}</span></div>;
  if (!market) return null;
  const maxVacancies = Math.max(1, ...market.histogram.map((item) => item.vacancies));
  const salaryValues = market.salaryTrend.map((item) => item.salary);
  const minSalary = salaryValues.length ? Math.min(...salaryValues) : 0;
  const maxSalary = salaryValues.length ? Math.max(...salaryValues) : 0;
  return <section className="market-panel" aria-label="Adzuna market snapshot">
    <div className="market-title"><div><div className="section-kicker">ADZUNA MARKET DATA · {market.scope === "location" ? "MATCHED LOCATION" : "COUNTRY LEVEL"}</div><h3>Market snapshot</h3></div><span className="cache-tag">{market.cached ? "Cached · 6 hours" : "Loaded on demand"}</span></div>
    <div className="market-grid">
      <section className="market-block"><h4>Current salary distribution</h4>{market.histogram.length ? <ul className="histogram-list">{market.histogram.map(({ salary, vacancies }) => <li key={salary}><span className="histogram-label">From {currency(salary)}</span><span className="histogram-track"><span style={{ width: `${Math.max(4, vacancies / maxVacancies * 100)}%` }} /></span><span className="histogram-value">{vacancies}</span></li>)}</ul> : <p className="pattern-empty">{market.unavailable.includes("histogram") ? "Salary distribution could not be loaded." : "No salary bands available for this search."}</p>}</section>
      <section className="market-block"><h4>Average salary by month</h4>{market.salaryTrend.length ? <ul className="trend-list">{market.salaryTrend.map(({ month, salary }) => {
        const spread = Math.max(1, maxSalary - minSalary);
        const width = Math.max(8, (salary - minSalary) / spread * 100);
        return <li key={month}><span>{month}</span><span className="trend-track"><span style={{ width: `${width}%` }} /></span><strong>{currency(salary)}</strong></li>;
      })}</ul> : <p className="pattern-empty">{market.unavailable.includes("history") ? "Historical salary data could not be loaded." : "No historical salary data available for this search."}</p>}</section>
      <section className="market-block market-companies"><h4>Top employers by vacancy count</h4>{market.companies.length ? <ul>{market.companies.map((company) => <li key={company.name}><span>{company.name}</span><span>{company.vacancies.toLocaleString()} vacancies{company.averageSalary != null ? ` · avg ${currency(company.averageSalary)}` : ""}</span></li>)}</ul> : <p className="pattern-empty">{market.unavailable.includes("companies") ? "Company data could not be loaded." : "No company data available for this search."}</p>}</section>
    </div>
    <p className="market-limit">Monthly history reports average salary, not hiring volume. Market data uses the role and a matched location when available; it does not apply the hours or employment-type filters. If the location could not be matched from the listings, data is country-wide. The snapshot costs 3 API hits when uncached and is cached for 6 hours in this server process. <a href="https://www.adzuna.ca/" target="_blank" rel="noreferrer">Source: The Adzuna API</a></p>
  </section>;
}
