# RoleScout

A small job-title search app backed by the Adzuna job search API.

## Local setup

1. Install Node.js 20.9 or newer and npm.
2. Add the variables from `.env.example` to `.env.local` (merge with an existing file rather than overwriting it).
3. Fill `ADZUNA_APP_ID` and `ADZUNA_APP_KEY` in `.env.local` using newly rotated Adzuna credentials. Do not commit `.env.local` or paste credentials into source files.
4. Set `ADZUNA_COUNTRY` to the two-letter Adzuna country code to search (the template defaults to `ca`).
5. Run `npm install`, then `npm run dev`, and open the local URL printed by Next.js.

The Adzuna credentials are used only by the server routes at `/api/jobs` and `/api/market`; they are not sent to the browser. Job searches are cached in process memory for 15 minutes. Market snapshots are fetched only when requested and cached in process memory for 6 hours. An uncached snapshot makes 3 upstream API calls; a process-local quota guard checks the supplied per-minute, daily, weekly, and monthly limits before those calls.

## Current scope

- Search job listings by title with optional valid location dropdown, full-time/part-time, and permanent/contract filters. Run an initial broad search to populate location choices from actual Adzuna listings.
- Correct obvious misspellings in common job-title words and explain the correction before showing results.
- Sort listings newest first.
- Display employer, location, date, description excerpt, and original listing link. Label salary figures as advertised, Adzuna-predicted, or unknown based on the API's `salary_is_predicted` field.
- Optionally load Adzuna salary distribution, average salary by month, and top-five employers for a role.
- Page through results using Adzuna's search pages; uncached page requests each use API quota.
- Identify required and preferred skills when the listing labels those sections; otherwise summarize recognizable skill terms found in the excerpt.
- Show common skill signals and title variations across jobs on the current results page.
- Keep the provider integration and normalized job shape separate from the interface so richer related-role analysis can be added later.

Adzuna's public search endpoint returns a short description excerpt rather than the complete job post. The expanded card shows the full excerpt returned by the API and links to the source listing for its complete version. Salary figures are shown as supplied; currency and pay period may not be standardized across listings. See [Adzuna's search documentation](https://developer.adzuna.com/docs/search).

Location choices are drawn from locations present in the job results already loaded in the current browser session. This guarantees the dropdown only offers observed Adzuna locations, but means users need to run a broad role search before choosing a location. Title correction uses a small vocabulary of common role terms and edit distance; it does not recognize every typo, abbreviation, or equivalent title.

The role-pattern panel analyzes only the jobs on the currently displayed page (up to 20), not every result in the total count. Skill identification uses a small built-in vocabulary and simple text matching; it can miss relevant skills, include contextual mentions, or fail to distinguish mandatory from optional skills when the excerpt does not label sections. Treat it as a quick signal, not a verified job-market analysis. Verify requirements in the employer's full posting.

The Market snapshot is broader than the live search filters: its salary history is average salary by month, not monthly hiring volume, and it does not apply schedule or employment-type filters. A typed location is applied to market endpoints only when a matching location hierarchy can be found in the current listings; otherwise the snapshot is country-level. Market data is cached only in this Node.js process.

Review [Adzuna's API terms](https://developer.adzuna.com/docs/terms_of_service) before publishing or relying on this app beyond personal research. The terms specify Adzuna branding for published ads and state that ongoing publication of aggregated data such as vacancy counts or average salaries beyond the trial period requires written consent.

## Quota and deployment note

The first version's cache and quota counters live in the Node.js process. This works for local development or a single long-running instance. Multiple instances, serverless cold starts, or process restarts need a shared cache and durable quota counter (for example, a database or Redis) before relying on the guard to enforce account-wide API limits.
