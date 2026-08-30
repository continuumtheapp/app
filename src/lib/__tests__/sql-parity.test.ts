/**
 * Proves the exact-match SQL and isExactMatch() agree.
 *
 * These are two implementations of the same rule, and they are the likeliest
 * thing in this codebase to drift apart. A divergence would silently return
 * wrong search results with nothing failing. This runs both over a fixture
 * matrix against a real local D1 and fails on any disagreement.
 *
 * Skipped unless DATABASE_URL is set: point it at a scratch Postgres database.
 *
 * NOTE: this test owns the local database while it runs — it clears the tables,
 * inserts its own fixtures, and clears them again afterwards. Any seed data is
 * destroyed, so re-run `npm run db:seed` afterwards if you were using it. That
 * is why it lives behind its own script rather than in the default test run.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import postgres from "postgres";
import { toDayNumber } from "../dates";
import { isExactMatch, type HostTerms } from "../matching";
import { exactMatchQuery, type SearchParams } from "../search-query";

const d = toDayNumber;
const connectionString = process.env.DATABASE_URL;
const hasDatabase = Boolean(connectionString);

const db = hasDatabase ? postgres(connectionString!, { prepare: false }) : null;

async function sql(command: string): Promise<Record<string, unknown>[]> {
  return (await db!.unsafe(command)) as unknown as Record<string, unknown>[];
}

async function run(query: string, binds: unknown[]): Promise<Record<string, unknown>[]> {
  return (await db!.unsafe(query, binds as never[])) as unknown as Record<string, unknown>[];
}

interface Fixture {
  id: number;
  blocks: [string, string][];
  min: number | null;
  max: number | null;
  guests: number;
  price: number;
}

/**
 * One listing per interesting host configuration.
 * Ids start at 9001 so they cannot collide with seeded development data —
 * this test shares the local database with whatever else is in it.
 */
const FIXTURES: Fixture[] = [
  { id: 9001, blocks: [["2026-03-01", "2026-04-01"]], min: null, max: null, guests: 4, price: 5000 },
  { id: 9002,  blocks: [["2026-03-01", "2026-03-21"]], min: null, max: null, guests: 4, price: 5000 },
  { id: 9003,  blocks: [["2026-03-01", "2026-04-01"]], min: 14,   max: null, guests: 4, price: 5000 },
  { id: 9004,  blocks: [["2026-03-01", "2026-04-01"]], min: null, max: 10,   guests: 4, price: 5000 },
  { id: 9005,  blocks: [["2026-03-01", "2026-04-01"]], min: 7,    max: 21,   guests: 4, price: 5000 },
  { id: 9006,  blocks: [["2026-03-01", "2026-03-08"], ["2026-03-15", "2026-04-05"]], min: null, max: null, guests: 4, price: 5000 },
  // Adjacent-but-unmerged: must NOT satisfy a stay spanning the seam.
  { id: 9007,  blocks: [["2026-03-01", "2026-03-15"], ["2026-03-15", "2026-04-01"]], min: null, max: null, guests: 4, price: 5000 },
  { id: 9008,  blocks: [["2026-02-01", "2026-03-01"]], min: null, max: null, guests: 4, price: 5000 },
  { id: 9009,  blocks: [["2026-03-01", "2026-04-01"]], min: null, max: null, guests: 1, price: 5000 },
  { id: 9010, blocks: [["2026-03-01", "2026-04-01"]], min: null, max: null, guests: 4, price: 12000 },
];

const STAYS: [string, string][] = [
  ["2026-03-01", "2026-03-21"], ["2026-03-05", "2026-03-12"], ["2026-03-01", "2026-03-02"],
  ["2026-02-25", "2026-03-10"], ["2026-03-25", "2026-04-10"], ["2026-03-10", "2026-03-20"],
  ["2026-03-01", "2026-04-01"], ["2026-03-16", "2026-04-01"], ["2026-03-09", "2026-03-14"],
];

const SEARCHES: (SearchParams & { label: string })[] = STAYS.flatMap(([ci, co]) =>
  [1, 3].flatMap((guests) =>
    [null, 6000].map((budget) => ({
      checkIn: d(ci), checkOut: d(co), guests, maxPricePerNightCents: budget,
      roomType: null, noDeposit: false, flintaOnly: false, bbox: null, near: null,
      label: `${ci}->${co} guests=${guests} budget=${budget}`,
    })),
  ),
);

async function seed() {
  // Clear only the ids this test uses, so a developer's seed data survives.
  const ids = FIXTURES.map((f) => f.id).join(",");
  await sql(`DELETE FROM availability_blocks WHERE listing_id IN (${ids});`);
  await sql(`DELETE FROM listings WHERE id IN (${ids});`);
  await sql("DELETE FROM users WHERE id = 'pu';");
  await sql("INSERT INTO users (id,email,email_verified,is_admin,is_banned,created_at,updated_at) VALUES ('pu','p@x.de',true,false,false,0,0);");
  for (const f of FIXTURES) {
    await sql(`INSERT INTO listings (id,host_id,title,address,lat,lng,location,price_cents,price_period,price_per_night_cents,room_type,max_guests,min_nights,max_nights,flinta_only,deposit_cents,status,created_at,updated_at)
         VALUES (${f.id},'pu','L${f.id}','Berlin',52.5,13.4,ST_MakePoint(13.4,52.5)::geography,${f.price},'night',${f.price},'whole_flat',${f.guests},${f.min ?? "NULL"},${f.max ?? "NULL"},false,0,'published',0,0);`);
    for (const [s, e] of f.blocks) {
      await sql(`INSERT INTO availability_blocks (listing_id,start_day,end_day) VALUES (${f.id},${d(s)},${d(e)});`);
    }
  }
}

describe.skipIf(!hasDatabase)("SQL / TypeScript parity", () => {
  beforeAll(async () => { await seed(); }, 120_000);
  afterAll(async () => {
    // Remove only this test's own fixtures, by the ids it created.
    const ids = FIXTURES.map((f) => f.id).join(",");
    await sql(`DELETE FROM availability_blocks WHERE listing_id IN (${ids});`);
    await sql(`DELETE FROM listings WHERE id IN (${ids});`);
    await sql("DELETE FROM users WHERE id = 'pu';");
    await db!.end();
  }, 120_000);

  it("agrees on every fixture across every search", async () => {
    const mismatches: string[] = [];

    for (const search of SEARCHES) {
      const { sql: query, binds } = exactMatchQuery(search);
      const matchedInSql = new Set((await run(query, binds)).map((r) => r.id as number));

      for (const f of FIXTURES) {
        const host: HostTerms = {
          blocks: f.blocks.map(([s, e]) => ({ startDay: d(s), endDay: d(e) })),
          minNights: f.min, maxNights: f.max,
          maxGuests: f.guests, pricePerNightCents: f.price,
        };
        const inTs = isExactMatch(host, {
          stay: { checkIn: search.checkIn, checkOut: search.checkOut },
          guests: search.guests,
          maxPricePerNightCents: search.maxPricePerNightCents,
        });
        if (inTs !== matchedInSql.has(f.id)) {
          mismatches.push(`listing ${f.id} | ${search.label} | ts=${inTs} sql=${matchedInSql.has(f.id)}`);
        }
      }
    }

    expect(mismatches).toEqual([]);
  }, 600_000);
});
