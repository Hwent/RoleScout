"use client";

import { FormEvent, useState } from "react";

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
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [totalResults, setTotalResults] = useState(0);

  async function loadPage(title: string, targetPage: number) {
    if (!title || loading) return;
    setLoading(true);
    setError("");
    setSearched(true);
    try {
      const response = await fetch(`/api/jobs?title=${encodeURIComponent(title)}&page=${targetPage}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Search failed. Please try again.");
      setJobs(data.jobs);
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
    const title = query.trim();
    setSearched(true);
    await loadPage(title, 1);
  }

  async function changePage(targetPage: number) {
    if (targetPage < 1 || targetPage > pageCount || targetPage === page || loading) return;
    await loadPage(query.trim(), targetPage);
  }

  const firstVisiblePage = Math.max(1, Math.min(page - 2, pageCount - 4));
  const visiblePages = Array.from({ length: Math.min(pageCount, 5) }, (_, index) => firstVisiblePage + index);

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
          <div className="results-heading"><div><div className="section-kicker">SEARCH RESULTS</div><h2>Jobs for “{query}”</h2></div><span className="result-count">{totalResults.toLocaleString()} listings</span></div>
          <div className="job-list">{jobs.map((job) => <article className="job-card" key={job.id}>
            <div className="job-card-top"><div className="company-mark">{job.company.trim().charAt(0).toUpperCase() || "J"}</div><div className="job-heading"><h3>{job.title}</h3><p>{job.company}</p></div><a className="open-link" href={job.url} target="_blank" rel="noreferrer" aria-label={`Open ${job.title} at ${job.company}`}>↗</a></div>
            <div className="job-meta"><span>⌖ {job.location || "Location not specified"}</span>{salaryLabel(job) && <span>{salaryLabel(job)}</span>}{job.created && <span>Posted {new Date(job.created).toLocaleDateString("en-CA", { month: "short", day: "numeric" })}</span>}</div>
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
        {!searched && <div className="below-fold-note"><span className="note-icon">✳</span><div><strong>Start with a title, explore the roles around it.</strong><p>This first version searches live listings. Skill patterns and connections between related jobs are the next layer.</p></div></div>}
      </section>
      <footer><span>ROLESCOUT</span><span>Job listings via Adzuna</span></footer>
    </main>
  );
}

function SkillGroup({ label, skills, inferred = false }: { label: string; skills: string[]; inferred?: boolean }) {
  const emptyMessage = inferred ? "No recognizable skill terms found in this excerpt" : "Not specified separately in this excerpt";
  return <div className="skill-group"><div className="skill-group-title">{label}{inferred && <span className="inferred-label">SUMMARY</span>}</div>{skills.length > 0 ? <div className="skill-chips">{skills.map((skill) => <span className="skill-chip" key={skill}>{skill}</span>)}</div> : <span className="skill-empty">{emptyMessage}</span>}</div>;
}
