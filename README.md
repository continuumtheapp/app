# Continuum

A community platform in Berlin, for now. Housing discovery is the
first surface;

## Housing

A discovery board for short-term housing, run for a closed community.
Conversations and agreements happen externally on Telegram or WhatsApp — this
site's only job is to make the right place findable and then hand off.

## The idea

Seekers know their own dates, so they search for them exactly, like anywhere
else. **Hosts** are the flexible ones: a place is free across a wide span, they'll
accept anything from a week to a month, and some days are only maybe-free.

Standard rental sites collapse that into a rigid calendar and hide anything
that isn't a perfect fit. Here, an exact search returns exact matches — and then,
below them, the **near misses with the reason stated**: *"Free 8 of your 10 nights
(10 Sept – 18 Sept)"*, *"Host wants 30+ nights, you want 20"*, *"€50/night over
your budget"*. The seeker decides whether to bend and contacts the host directly.

That second section is the product. It's what a group chat gives you that a
booking site doesn't.

## Stack

| Piece | Choice |
|---|---|
| Framework | Next.js 16 (App Router) on Vercel |
| Database | Vercel Postgres (Neon) + PostGIS, via Drizzle ORM |
| Photos | Cloudflare R2, browser uploads via presigned S3 URLs |
| Auth | better-auth — Google sign-in or a 24-hour single-use email magic link |
| Email | Resend, called over its REST API |
| Maps | MapLibre GL + OpenFreeMap tiles — no key, no limits, commercial use allowed |
| Geocoding | Nominatim, called once when a listing is saved |

**Why Postgres rather than SQLite/D1:** Continuum's later surfaces are
relational and geographic — "people within 20km, aged 30–45, into meditation,
not blocked, not already seen". PostGIS answers that natively and indexes it
with GiST. Housing needs the same machinery for "listings near this station",
so the whole product shares one database from the start rather than migrating
later.

**Why R2 rather than Vercel Blob:** egress is free. For an app that will be
mostly photos, that is the cost that matters.

Running cost at community scale: effectively €0/month plus a domain.

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill it in — the file explains each key
npm run db:migrate           # create the schema (needs DATABASE_URL)
npm run db:seed              # ~30 example Berlin listings
npm run dev                  # http://localhost:4000
```

The database needs PostGIS enabled once:

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
```

The app works without any secrets: sign-in magic links print to the console
instead of sending, and photo upload is the only feature that needs real keys.

### Deploying

Push to the connected Git repository — Vercel builds and deploys on every push.
Set every key from `.env.example` in the project's Environment Variables first,
and run `npm run db:migrate` against the production database.

On the Cloudflare side, set a CORS rule on the R2 bucket allowing `PUT` from
your domain, or browser uploads will fail.

## How dates work

Two conventions run through the whole codebase. Both exist to prevent
off-by-one bugs, and both are worth knowing before changing anything.

**Dates are integer day numbers**, not ISO strings or timestamps — days since
the Unix epoch. These are calendar dates ("check in on the 3rd"), not instants,
so a day number has no time component to be shifted across a boundary by a UTC
offset. That matters here: servers run in UTC while users think in
`Europe/Berlin`. It also makes `nights = end - start` plain subtraction and
keeps range queries indexable. Conversion lives in `src/lib/dates.ts` and
nowhere else.

**Intervals are half-open, `[start, end)`.** A stay of 3 → 20 March is 17
nights: you sleep the 3rd through the 19th and leave on the 20th. Closed
intervals would put a `±1` into every single comparison, which is exactly where
these bugs breed.

### Matching

An exact match is plain containment — some availability block covers the whole
stay, and the host accepts a stay that long:

```
block.start_day <= check_in
block.end_day   >= check_out
stay            >= COALESCE(host.min_nights, 1)
stay            <= COALESCE(host.max_nights, ∞)
```

Near misses come from a second, deliberately loose query (dates padded ±14 days,
duration dropped, capacity −1, budget +25%) whose small result set is then
scored in TypeScript. Not in SQL: the failure reasons are multi-dimensional and
need per-listing arithmetic to produce human sentences, which in SQL becomes an
untestable wall of `CASE`.

**FLINTA-only is never relaxed.** It's an eligibility boundary, not a
preference. Nothing about anyone's gender is stored — listings carry a badge,
and search has an opt-in filter.

The scoring weights in `src/lib/matching.ts` encode guesses about what seekers
tolerate. They are the part of this design most likely to be wrong; they're
named constants in one place for that reason.

## Layout

```
src/lib/          matching, dates, availability, pricing, geo — pure, tested
src/db/           Drizzle schema and client
src/app/          pages and API routes
src/components/   UI
drizzle/          migrations and seed data
```

The interesting files are `src/lib/matching.ts` (the predicate and near-miss
scoring), `src/lib/search.ts` (5 queries per search, flat regardless of result
count — never one per listing) and
`src/components/availability-editor.tsx` (the host's calendar).

## Tests

```bash
npm test              # 66 unit tests, ~200ms
npm run test:parity   # asserts the SQL and TypeScript predicates agree
```

The parity test is the important one. The exact-match rule exists twice — once
as SQL, once as TypeScript — and they will drift. It runs both across a fixture
matrix against a real database and fails on any disagreement. It needs
`DATABASE_URL` set, and skips itself otherwise.

## Things worth knowing

- **`public/vendor/maplibre-gl-worker.mjs` is a copy of MapLibre's own worker**,
  refreshed by `npm run sync-maplibre-worker` (which runs on `postinstall`).
  Next's bundler rewrites MapLibre's worker entry point into something that
  never starts: the style loads, no tiles are ever requested, and the canvas
  stays blank — silently, with no error raised. Pointing `setWorkerUrl()` at the
  prebuilt file sidesteps the bundler. Don't delete it.
- **Availability blocks are merged on write** (`mergeBlocks`). Matching assumes
  each stored block is a maximal contiguous run: unmerged neighbours `[10,20)`
  and `[20,30)` would each show only 10 nights and wrongly fail a 15-night
  minimum. SQLite can't enforce this itself.
- **Search clamps check-in to today**, so past availability can never match.
  The seed script generates dates relative to the current date for exactly this
  reason — a seed with hardcoded dates silently stops matching once they pass.
- **There is deliberately no middleware.** Every protected page checks the
  session itself with `currentUser()` and redirects — a real, database-backed
  check. A middleware could only add a cookie-presence pre-filter on top of
  that, which is duplication rather than protection.
