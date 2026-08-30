/**
 * The search service: runs both passes and assembles the results page.
 *
 * Query budget matters — D1's free tier allows 50 queries per Worker
 * invocation — so everything is batched. A search costs 6 queries regardless
 * of how many listings come back, never one per listing.
 */
import { getSql } from "@/db";
import {
  exactMatchQuery, relaxedQuery, blocksForListingsQuery,
  flexibleDaysForListingsQuery, coverPhotosQuery, type SearchParams,
} from "./search-query";
import {
  scoreNearMiss, compareNearMiss, countFlexibleNights, NEAR_MISS_LIMIT,
  type Block, type NearMiss, type HostTerms,
} from "./matching";
import { todayInBerlin } from "./dates";

interface ListingRow {
  id: number;
  host_id: string;
  title: string;
  description: string | null;
  address: string;
  lat: number;
  lng: number;
  price_cents: number;
  price_period: "night" | "week" | "month";
  price_per_night_cents: number;
  room_type: "whole_flat" | "shared";
  flatmate_count: number | null;
  max_guests: number;
  flinta_only: boolean;
  deposit_cents: number;
  min_nights: number | null;
  max_nights: number | null;
  status: string;
  created_at: number;
  updated_at: number;
}

export interface ResultListing {
  id: number;
  title: string;
  description: string | null;
  lat: number;
  lng: number;
  priceCents: number;
  pricePeriod: "night" | "week" | "month";
  pricePerNightCents: number;
  roomType: "whole_flat" | "shared";
  flatmateCount: number | null;
  maxGuests: number;
  flintaOnly: boolean;
  depositCents: number;
  minNights: number | null;
  maxNights: number | null;
  blocks: Block[];
  coverPhotoKey: string | null;
  /** Nights of the requested stay the host marked "maybe". Exact matches only. */
  flexibleNights: number;
}

export interface SearchResults {
  exact: ResultListing[];
  nearMisses: (ResultListing & { near: NearMiss })[];
  /** Check-in as searched, after clamping to today. */
  checkIn: number;
  checkOut: number;
}

export async function runSearch(raw: SearchParams): Promise<SearchResults> {
  // Never search the past: a block that has expired must not match.
  const today = todayInBerlin();
  const params: SearchParams = { ...raw, checkIn: Math.max(raw.checkIn, today) };
  if (params.checkOut <= params.checkIn) {
    return { exact: [], nearMisses: [], checkIn: params.checkIn, checkOut: params.checkOut };
  }

  const sql = getSql();
  const stay = { checkIn: params.checkIn, checkOut: params.checkOut };

  // 1. exact matches
  const exactQ = exactMatchQuery(params);
  const exactRows = (await sql.unsafe(exactQ.sql, exactQ.binds as never[])) as unknown as ListingRow[];

  // 2. relaxed net for near-misses, excluding what already matched
  const relaxedQ = relaxedQuery(params, exactRows.map((r) => r.id));
  const relaxedRows = (await sql.unsafe(relaxedQ.sql, relaxedQ.binds as never[])) as unknown as ListingRow[];

  const allIds = [...exactRows, ...relaxedRows].map((r) => r.id);
  if (allIds.length === 0) {
    return { exact: [], nearMisses: [], checkIn: params.checkIn, checkOut: params.checkOut };
  }

  // 3-5. batched lookups: blocks, flexible days, cover photos
  const [blocksByListing, flexByListing, photoByListing] = await Promise.all([
    fetchBlocks(allIds),
    fetchFlexibleDays(allIds),
    fetchCoverPhotos(allIds),
  ]);

  const toResult = (row: ListingRow): ResultListing => ({
    id: row.id,
    title: row.title,
    description: row.description,
    lat: row.lat,
    lng: row.lng,
    priceCents: row.price_cents,
    pricePeriod: row.price_period,
    pricePerNightCents: row.price_per_night_cents,
    roomType: row.room_type,
    flatmateCount: row.flatmate_count,
    maxGuests: row.max_guests,
    flintaOnly: row.flinta_only,
    depositCents: row.deposit_cents,
    minNights: row.min_nights,
    maxNights: row.max_nights,
    blocks: blocksByListing.get(row.id) ?? [],
    coverPhotoKey: photoByListing.get(row.id) ?? null,
    flexibleNights: countFlexibleNights(flexByListing.get(row.id) ?? [], stay),
  });

  const exact = exactRows.map(toResult);

  const nearMisses = relaxedRows
    .map((row) => {
      const listing = toResult(row);
      const host: HostTerms = {
        blocks: listing.blocks,
        minNights: listing.minNights,
        maxNights: listing.maxNights,
        maxGuests: listing.maxGuests,
        pricePerNightCents: listing.pricePerNightCents,
      };
      const near = scoreNearMiss(host, {
        stay,
        guests: params.guests,
        maxPricePerNightCents: params.maxPricePerNightCents,
      });
      return near ? { ...listing, near } : null;
    })
    .filter((r): r is ResultListing & { near: NearMiss } => r !== null)
    .sort(compareNearMiss)
    .slice(0, NEAR_MISS_LIMIT);

  return { exact, nearMisses, checkIn: params.checkIn, checkOut: params.checkOut };
}

async function fetchBlocks(ids: number[]): Promise<Map<number, Block[]>> {
  const q = blocksForListingsQuery(ids);
  const rows = (await getSql().unsafe(q.sql, q.binds as never[])) as unknown as
    { listing_id: number; start_day: number; end_day: number }[];
  const map = new Map<number, Block[]>();
  for (const r of rows) {
    const list = map.get(r.listing_id) ?? [];
    list.push({ startDay: r.start_day, endDay: r.end_day });
    map.set(r.listing_id, list);
  }
  return map;
}

async function fetchFlexibleDays(ids: number[]): Promise<Map<number, number[]>> {
  const q = flexibleDaysForListingsQuery(ids);
  const rows = (await getSql().unsafe(q.sql, q.binds as never[])) as unknown as
    { listing_id: number; day: number }[];
  const map = new Map<number, number[]>();
  for (const r of rows) {
    const list = map.get(r.listing_id) ?? [];
    list.push(r.day);
    map.set(r.listing_id, list);
  }
  return map;
}

async function fetchCoverPhotos(ids: number[]): Promise<Map<number, string>> {
  const q = coverPhotosQuery(ids);
  const rows = (await getSql().unsafe(q.sql, q.binds as never[])) as unknown as
    { listing_id: number; r2_key: string }[];
  return new Map(rows.map((r) => [r.listing_id, r.r2_key]));
}

/** Parse the `bbox` query parameter, "south,west,north,east". */
export function parseBbox(value: string | null): SearchParams["bbox"] {
  if (!value) return null;
  const parts = value.split(",").map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null;
  const [south, west, north, east] = parts;
  if (south >= north || west >= east) return null;
  return { south, west, north, east };
}
