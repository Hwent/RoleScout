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
- Display employer, location, salary when supplied, date, description, and original listing link.
- Keep the provider integration and normalized job shape separate from the interface so skill summaries and related-role analysis can be added later.

## Quota and deployment note

The first version's cache and quota counters live in the Node.js process. This works for local development or a single long-running instance. Multiple instances, serverless cold starts, or process restarts need a shared cache and durable quota counter (for example, a database or Redis) before relying on the guard to enforce account-wide API limits.
