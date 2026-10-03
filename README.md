# RoleScout

A small job-title search app backed by the Adzuna job search API.

## Local setup

1. Install Node.js 20.9 or newer and npm.
2. Add the variables from `.env.example` to `.env.local` (merge with an existing file rather than overwriting it).
3. Fill `ADZUNA_APP_ID` and `ADZUNA_APP_KEY` in `.env.local` using newly rotated Adzuna credentials. Do not commit `.env.local` or paste credentials into source files.
4. Set `ADZUNA_COUNTRY` to the two-letter Adzuna country code to search (the template defaults to `ca`).
5. Run `npm install`, then `npm run dev`, and open the local URL printed by Next.js.

The Adzuna credentials are used only by the server route at `/api/jobs`; they are not sent to the browser. Searches are cached in process memory for 15 minutes, and a process-local quota guard enforces the supplied per-minute, daily, weekly, and monthly limits before making upstream calls.

## Current scope

- Search job listings by title.
- Display employer, location, salary when supplied, date, description excerpt, and original listing link.
- Page through results using Adzuna's search pages; uncached page requests each use API quota.
- Identify required and preferred skills when the listing labels those sections; otherwise summarize recognizable skill terms found in the excerpt.
- Keep the provider integration and normalized job shape separate from the interface so related-role analysis can be added later.

Adzuna's public search endpoint returns a short description excerpt rather than the complete job post. The expanded card shows the full excerpt returned by the API and links to the source listing for its complete version. See [Adzuna's search documentation](https://developer.adzuna.com/docs/search).

## Quota and deployment note

The first version's cache and quota counters live in the Node.js process. This works for local development or a single long-running instance. Multiple instances, serverless cold starts, or process restarts need a shared cache and durable quota counter (for example, a database or Redis) before relying on the guard to enforce account-wide API limits.
