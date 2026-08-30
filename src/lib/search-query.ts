/**
 * Postgres queries backing search.
 *
 * Two passes:
 *   1. EXACT   — listings where a block fully contains the requested stay.
 *   2. RELAXED — a wider net whose results are scored in TypeScript by
 *                scoreNearMiss(). Deliberately NOT scored in SQL: the failure
 *                reasons are multi-dimensional and need per-listing arithmetic
 *                to produce human copy, which in SQL becomes an untestable
 *                wall of CASE expressions.
 *
 * The exact-match SQL must agree with isExactMatch() in ./matching.ts.
 * A test asserts they do — if you change one, change the other.
 */

import { NEAR_MISS_BUDGET_FACTOR, NEAR_MISS_WINDOW_PAD } from "./matching";

export interface SearchParams {
  checkIn: number;
  checkOut: number;
  guests: number;
  maxPricePerNightCents: number | null;
  roomType: "whole_flat" | "shared" | null;
  noDeposit: boolean;
  flintaOnly: boolean;
  /** Map viewport, when the seeker has panned to "search this area". */
  bbox: { south: number; north: number; west: number; east: number } | null;
  /** Radius search: everything within `radiusM` metres of a point. */
  near: { lat: number; lng: number; radiusM: number } | null;
}

/** Columns needed to render a result card. Kept explicit to avoid SELECT *. */
const LISTING_COLUMNS = `
  l.id, l.host_id, l.title, l.description, l.address, l.lat, l.lng,
  l.price_cents, l.price_period, l.price_per_night_cents,
  l.room_type, l.flatmate_count, l.max_guests,
  l.flinta_only, l.deposit_cents, l.min_nights, l.max_nights,
  l.status, l.created_at, l.updated_at
`;

/** Builds a numbered-placeholder query ($1, $2, ...) the way Postgres wants. */
class QueryBuilder {
  private binds: unknown[] = [];
  /** Register a value and return its placeholder. */
  bind(value: unknown): string {
    this.binds.push(value);
    return `$${this.binds.length}`;
  }
  values(): unknown[] {
    return this.binds;
  }
}

/** Filters applied identically to both passes. FLINTA is never relaxed. */
function commonFilters(
  q: QueryBuilder,
  p: SearchParams,
  budgetCents: number | null,
  guests: number,
): string[] {
  const clauses: string[] = ["l.status = 'published'"];

  clauses.push(`l.max_guests >= ${q.bind(guests)}`);

  if (budgetCents !== null) {
    clauses.push(`l.price_per_night_cents <= ${q.bind(budgetCents)}`);
  }
  if (p.roomType !== null) {
    clauses.push(`l.room_type = ${q.bind(p.roomType)}`);
  }
  if (p.noDeposit) {
    clauses.push("l.deposit_cents = 0");
  }
  if (p.flintaOnly) {
    // An eligibility boundary, not a preference: never relaxed, never widened.
    clauses.push("l.flinta_only = true");
  }
  if (p.near) {
    // True distance on the spheroid, index-backed by the GiST index on location.
    clauses.push(
      `ST_DWithin(l.location, ST_MakePoint(${q.bind(p.near.lng)}, ${q.bind(p.near.lat)})::geography, ${q.bind(p.near.radiusM)})`,
    );
  } else if (p.bbox) {
    // Map viewport: a rectangle, not a radius.
    clauses.push(
      `ST_Intersects(l.location, ST_MakeEnvelope(${q.bind(p.bbox.west)}, ${q.bind(p.bbox.south)}, ${q.bind(p.bbox.east)}, ${q.bind(p.bbox.north)}, 4326)::geography)`,
    );
  }
  return clauses;
}

/**
 * Exact matches: some availability block fully contains [checkIn, checkOut),
 * and the host accepts a stay of that many nights.
 */
export function exactMatchQuery(p: SearchParams): { sql: string; binds: unknown[] } {
  const nights = p.checkOut - p.checkIn;
  const q = new QueryBuilder();
  const clauses = commonFilters(q, p, p.maxPricePerNightCents, p.guests);

  const nightsA = q.bind(nights);
  const nightsB = q.bind(nights);
  const checkIn = q.bind(p.checkIn);
  const checkOut = q.bind(p.checkOut);

  const sql = `
    SELECT ${LISTING_COLUMNS}
    FROM listings l
    WHERE ${clauses.join("\n      AND ")}
      AND ${nightsA} >= COALESCE(l.min_nights, 1)
      AND ${nightsB} <= COALESCE(l.max_nights, 100000000)
      AND EXISTS (
        SELECT 1 FROM availability_blocks b
        WHERE b.listing_id = l.id
          AND b.start_day <= ${checkIn}
          AND b.end_day   >= ${checkOut}
      )
    ORDER BY l.price_per_night_cents ASC, l.id ASC
    LIMIT 100
  `;
  return { sql, binds: q.values() };
}

/**
 * Relaxed net for near-misses: any listing with availability anywhere near the
 * requested dates, dropping the containment and stay-length requirements and
 * easing capacity and budget. Excludes ids already returned as exact matches.
 */
export function relaxedQuery(
  p: SearchParams,
  excludeIds: number[],
): { sql: string; binds: unknown[] } {
  const budget =
    p.maxPricePerNightCents === null
      ? null
      : Math.round(p.maxPricePerNightCents * NEAR_MISS_BUDGET_FACTOR);
  // Allow one bed short — beyond that it is physically implausible, not a near miss.
  const guests = Math.max(1, p.guests - 1);

  const q = new QueryBuilder();
  const clauses = commonFilters(q, p, budget, guests);

  const exclusion =
    excludeIds.length > 0 ? `AND l.id <> ALL(${q.bind(excludeIds)})` : "";
  const from = q.bind(p.checkIn - NEAR_MISS_WINDOW_PAD);
  const to = q.bind(p.checkOut + NEAR_MISS_WINDOW_PAD);

  const sql = `
    SELECT ${LISTING_COLUMNS}
    FROM listings l
    WHERE ${clauses.join("\n      AND ")}
      ${exclusion}
      AND EXISTS (
        SELECT 1 FROM availability_blocks b
        WHERE b.listing_id = l.id
          AND b.end_day   > ${from}
          AND b.start_day < ${to}
      )
    LIMIT 200
  `;
  return { sql, binds: q.values() };
}

/** Availability blocks for a set of listings, in one query (never N+1). */
export function blocksForListingsQuery(ids: number[]): { sql: string; binds: unknown[] } {
  return {
    sql: `SELECT listing_id, start_day, end_day
          FROM availability_blocks
          WHERE listing_id = ANY($1)
          ORDER BY listing_id, start_day`,
    binds: [ids],
  };
}

/** Flexible days for a set of listings, in one query. */
export function flexibleDaysForListingsQuery(ids: number[]): { sql: string; binds: unknown[] } {
  return {
    sql: `SELECT listing_id, day FROM flexible_days WHERE listing_id = ANY($1)`,
    binds: [ids],
  };
}

/** First photo of each listing, for result cards. One query for the whole page. */
export function coverPhotosQuery(ids: number[]): { sql: string; binds: unknown[] } {
  return {
    sql: `SELECT listing_id, r2_key FROM listing_photos
          WHERE listing_id = ANY($1) AND sort_order = 0`,
    binds: [ids],
  };
}
