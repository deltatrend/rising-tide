# Rising Tide Youth Advocacy

A free, youth-led civic education site that tracks New York State legislation on
oceans, drinking water, wetlands, flooding and water quality — and explains it in
plain language.

Every page is public. There are no accounts, no paywall, no analytics on what you
read, and every claim on the site traces back to an official legislative record.

## What it does

- Tracks New York bills that are genuinely about water, using a transparent
  classifier rather than a keyword grep, and shows the reasoning on each bill page.
- Groups bills into 16 water-policy topics (drinking water, wetlands, flooding and
  resilience, Long Island Sound, wastewater, and so on).
- Follows each bill through its actual legislative stages, with the official action
  history, sponsors, committee referrals, recorded votes and scheduled hearings.
- States plainly when data is stale, incomplete or missing, instead of implying
  the site is more authoritative than it is.

## Stack

| Layer | Choice | Why |
| --- | --- | --- |
| Framework | Next.js App Router, React Server Components, TypeScript | Server rendering keeps pages crawlable and shareable without client-side data fetching |
| Database | Supabase Postgres via the transaction pooler | Free tier, works from serverless functions |
| Data access | Drizzle ORM over postgres.js | Typed queries, explicit SQL where it matters |
| Source data | LegiScan public API | Official New York legislative data, CC BY 4.0 |
| Document cache | Cloudflare R2 (optional) | Keeps bill text out of Postgres and off LegiScan's servers |
| Hosting | Vercel, including Vercel Cron | Free tier, one scheduled sync per day |

No page render ever calls LegiScan. Pages read only this project's own database;
the API is contacted exclusively by the scheduled sync.

## Getting started

Requires Node 20.9 or newer.

```bash
npm install
cp .env.example .env.local   # then fill in the values
npm run db:migrate           # create the schema
npm run db:seed-topics       # load the topic taxonomy
npm run dev
```

The site runs without a database — every page degrades to an honest empty state —
but it will have nothing to show until a sync has run.

### Environment variables

All of them are documented in `.env.example`. Only `DATABASE_URL` is required to
render the site; `LEGISCAN_API_KEY` is required to fetch data; `CRON_SECRET`
protects the scheduled sync route; the `R2_*` variables are optional and only
enable document caching.

No secret is ever exposed to the browser: the only `NEXT_PUBLIC_` variables are
the canonical site URL and the fixture-mode flag.

## Loading data

```bash
npm run sync:legiscan:dry              # discovery only: no writes, no detail fetches
npm run sync:legiscan                  # full run with safe defaults
npm run sync:legiscan -- --max-bills=25
npm run sync:legiscan -- --bill=1234567
```

The sync is incremental and quota-aware. It compares LegiScan change hashes before
spending a query on a bill, records every query it makes, and stops before the
monthly budget is at risk. The CLI and the cron route call the same service, so
there is only one ingestion path to reason about.

In production, Vercel Cron calls `/api/cron/sync-legiscan` once a day (see
`vercel.json`). The route rejects any request without the `CRON_SECRET` bearer
token.

### Demo data

```bash
npm run db:seed-fixtures
```

Fixture rows are flagged in the database and labelled in the UI, so demo data can
never be mistaken for the legislative record.

### Correcting the classifier

```bash
npm run override -- --bill S1001 --include --reason "Water main funding"
npm run override -- --bill S5590 --exclude --reason "Corporate finance, not water"
npm run override -- --list
```

Overrides are attributed, dated, reversible and shown publicly on the bill page.
Clearing one keeps the audit trail rather than deleting it.

## Verification

```bash
npm run verify        # lint, typecheck, unit tests, production build
```

Beyond the unit tests, several scripts check the parts that only fail against a
real database or a running server:

| Command | What it answers |
| --- | --- |
| `npm run db:check` | Is `DATABASE_URL` reachable, and is the schema there? |
| `npm run db:smoke` | Does every query the site uses execute cleanly? |
| `npm run db:timings` | Which queries are slow enough to matter? |
| `npm run db:connections` | Who is holding connections, and how many? |
| `npm run db:concurrency` | Does the driver still handle parallel statements safely? |
| `npm run smoke:routes` | Does every public route return real content, with a server running? |

`db:smoke` exists because page queries deliberately degrade to empty results when
the database misbehaves. That safety net also hides SQL mistakes, so the same
queries are re-run with errors in view.

## Architecture notes

```
app/          routes and API handlers (server components by default)
components/   presentational components, grouped by domain
config/       site configuration, topic definitions, water taxonomy
lib/db/       schema, connection handling, query modules
lib/legiscan/ API client, response schemas, quota accounting
lib/sync/     the single ingestion service
lib/classification/  the classifier and override resolution
scripts/      CLI entry points and diagnostics
```

Two decisions are worth knowing before changing the data layer:

**Every statement gets its own connection.** postgres.js pipelines statements onto
a busy connection, which deadlocks against Supabase's transaction pooler: a page
that runs more queries in parallel than the pool has connections stops responding,
permanently, until the process restarts. `lib/db/reserve.ts` reserves a connection
per statement so parallel queries wait instead of sharing. `tests/db-reserve.test.ts`
pins that behaviour.

**Cross-table SQL fragments must use `col()` and `tbl()`.** Drizzle drops the table
prefix from column references in single-table selects, which silently changes the
meaning of a correlated subquery. The helpers in `lib/db/queries/sql-helpers.ts`
always render `"table"."column"`.

## Data, credit and limits

Legislative data comes from [LegiScan](https://legiscan.com/) under the
[Creative Commons Attribution 4.0 International licence](https://creativecommons.org/licenses/by/4.0/).
LegiScan does not endorse this project.

Rising Tide is not the official legislative record. For anything legal or
authoritative, check with the
[New York State Senate](https://www.nysenate.gov/) or
[Assembly](https://nyassembly.gov/). The methodology page explains how bills are
selected, how often data is refreshed and what the classifier can get wrong.
