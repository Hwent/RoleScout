"use client";

import { FormEvent, useState } from "react";

type Job = {
  id: string;
  title: string;
  company: string;
  location: string;
  description: string;
  url: string;
  created: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
};

function salaryLabel(job: Job) {
  if (job.salaryMin == null && job.salaryMax == null) return null;
  const format = (amount: number) => new Intl.NumberFormat("en-CA", { maximumFractionDigits: 0 }).format(amount);
  if (job.salaryMin != null && job.salaryMax != null) return `$${format(job.salaryMin)}–$${format(job.salaryMax)}`;
  return `From $${format(job.salaryMin ?? job.salaryMax!)}`;
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = query.trim();
    if (!title || loading) return;
    setLoading(true);
    setError("");
    setSearched(true);
    try {
      const response = await fetch(`/api/jobs?title=${encodeURIComponent(title)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Search failed. Please try again.");
      setJobs(data.jobs);
    } catch (caught) {
      setJobs([]);
      setError(caught instanceof Error ? caught.message : "Search failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="shell">
      <header className="topbar"><a className="brand" href="/" aria-label="RoleScout home"><span className="brand-mark">R</span> rolescout</a><span className="top-note">Real jobs. Clearer possibilities.</span></header>

      <section className="hero" aria-labelledby="hero-title">
        <div className="eyebrow"><span className="eyebrow-dot" /> JOB EXPLORER</div>
        <h1 id="hero-title">Find your next<br /><span>kind of work.</span></h1>
        <p className="intro">Search a role and explore real job listings, descriptions, and the skills employers ask for.</p>
        <form className="search-form" onSubmit={search}>
          <label className="sr-only" htmlFor="job-title">Job title</label>
          <span className="search-icon" aria-hidden="true">⌕</span>
          <input id="job-title" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Try “product designer” or “data analyst”" autoComplete="off" />
          <button type="submit" disabled={loading || !query.trim()}>{loading ? "Searching…" : "Search jobs"}<span aria-hidden="true">→</span></button>
        </form>
        <div className="search-hint">Search by job title <span>·</span> Listings provided by Adzuna</div>
      </section>

      <section className="results" aria-live="polite">
        {loading && <div className="state-card"><span className="loader" />Looking for matching roles…</div>}
        {!loading && error && <div className="state-card error-card"><strong>We couldn’t complete that search.</strong><span>{error}</span></div>}
        {!loading && !error && searched && jobs.length === 0 && <div className="state-card"><strong>No listings found for “{query}”.</strong><span>Try a broader job title or another spelling.</span></div>}
        {!loading && !error && jobs.length > 0 && <>
          <div className="results-heading"><div><div className="section-kicker">SEARCH RESULTS</div><h2>Jobs for “{query}”</h2></div><span className="result-count">{jobs.length} listings</span></div>
          <div className="job-list">{jobs.map((job) => <article className="job-card" key={job.id}>
            <div className="job-card-top"><div className="company-mark">{job.company.trim().charAt(0).toUpperCase() || "J"}</div><div className="job-heading"><h3>{job.title}</h3><p>{job.company}</p></div><a className="open-link" href={job.url} target="_blank" rel="noreferrer" aria-label={`Open ${job.title} at ${job.company}`}>↗</a></div>
            <div className="job-meta"><span>⌖ {job.location || "Location not specified"}</span>{salaryLabel(job) && <span>{salaryLabel(job)}</span>}{job.created && <span>Posted {new Date(job.created).toLocaleDateString("en-CA", { month: "short", day: "numeric" })}</span>}</div>
            <details className="description"><summary>View job description <span>＋</span></summary><p>{job.description || "No description was provided for this listing."}</p></details>
          </article>)}</div>
        </>}
        {!searched && <div className="below-fold-note"><span className="note-icon">✳</span><div><strong>Start with a title, explore the roles around it.</strong><p>This first version searches live listings. Skill patterns and connections between related jobs are the next layer.</p></div></div>}
      </section>
      <footer><span>ROLESCOUT</span><span>Job listings via Adzuna</span></footer>
    </main>
  );
}
