/**
 * Listing reads and writes.
 *
 * Every write that touches availability goes through mergeBlocks() and
 * pruneFlexibleDays(): matching assumes stored blocks are maximal contiguous
 * runs, and SQLite cannot enforce that itself.
 */
import { eq, and, desc, sql } from "drizzle-orm";
import { getDb, getSql } from "@/db";
import {
  listings, availabilityBlocks, flexibleDays, listingPhotos, users,
} from "@/db/schema";
import { mergeBlocks, pruneFlexibleDays, lastAvailableDay } from "./blocks";
import { toPricePerNightCents } from "./pricing";
import { toDayNumber, todayInBerlin } from "./dates";
import type { ListingInput } from "./validation";
import type { Block } from "./matching";

export interface FullListing {
  id: number;
  hostId: string;
  title: string;
  description: string | null;
  address: string;
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
  status: string;
  blocks: Block[];
  flexibleDays: number[];
  photoKeys: string[];
  host: { id: string; name: string | null; image: string | null };
}

export async function getListing(id: number): Promise<FullListing | null> {
  const db = getDb();

  const rows = await db
    .select({ listing: listings, host: { id: users.id, name: users.name, image: users.image } })
    .from(listings)
    .innerJoin(users, eq(listings.hostId, users.id))
    .where(eq(listings.id, id))
    .limit(1);

  if (rows.length === 0) return null;
  const { listing: l, host } = rows[0];

  const [blocks, flex, photos] = await Promise.all([
    db.select().from(availabilityBlocks).where(eq(availabilityBlocks.listingId, id))
      .orderBy(availabilityBlocks.startDay),
    db.select().from(flexibleDays).where(eq(flexibleDays.listingId, id)),
    db.select().from(listingPhotos).where(eq(listingPhotos.listingId, id))
      .orderBy(listingPhotos.sortOrder),
  ]);

  return {
    id: l.id, hostId: l.hostId, title: l.title, description: l.description,
    address: l.address, lat: l.lat, lng: l.lng,
    priceCents: l.priceCents, pricePeriod: l.pricePeriod,
    pricePerNightCents: l.pricePerNightCents,
    roomType: l.roomType, flatmateCount: l.flatmateCount, maxGuests: l.maxGuests,
    flintaOnly: l.flintaOnly, depositCents: l.depositCents,
    minNights: l.minNights, maxNights: l.maxNights, status: l.status,
    blocks: blocks.map((b) => ({ startDay: b.startDay, endDay: b.endDay })),
    flexibleDays: flex.map((f) => f.day).sort((a, b) => a - b),
    photoKeys: photos.map((p) => p.r2Key),
    host,
  };
}

/** A host's own listings, newest first. */
export async function getListingsByHost(hostId: string) {
  const db = getDb();
  const rows = await db.select().from(listings)
    .where(eq(listings.hostId, hostId))
    .orderBy(desc(listings.updatedAt));

  const today = todayInBerlin();
  return Promise.all(rows.map(async (l) => {
    const blocks = await db.select().from(availabilityBlocks)
      .where(eq(availabilityBlocks.listingId, l.id));
    const last = lastAvailableDay(blocks.map((b) => ({ startDay: b.startDay, endDay: b.endDay })));
    return { ...l, expired: last !== null && last <= today };
  }));
}

/** Insert or update a listing, normalising availability along the way. */
export async function saveListing(
  input: ListingInput,
  geo: { lat: number; lng: number },
  hostId: string,
  existingId?: number,
): Promise<number> {
  const db = getDb();
  const now = Date.now();

  const blocks = mergeBlocks(
    input.blocks.map((b) => ({ startDay: toDayNumber(b.start), endDay: toDayNumber(b.end) })),
  );
  const flex = pruneFlexibleDays(input.flexibleDays.map(toDayNumber), blocks);

  const values = {
    hostId,
    title: input.title,
    description: input.description ?? null,
    address: input.address,
    lat: geo.lat,
    lng: geo.lng,
    // Kept in step with lat/lng; this is the column distance queries use.
    location: { lat: geo.lat, lng: geo.lng },
    priceCents: input.priceCents,
    pricePeriod: input.pricePeriod,
    pricePerNightCents: toPricePerNightCents(input.priceCents, input.pricePeriod),
    roomType: input.roomType,
    flatmateCount: input.flatmateCount,
    maxGuests: input.maxGuests,
    flintaOnly: input.flintaOnly,
    depositCents: input.depositCents,
    minNights: input.minNights,
    maxNights: input.maxNights,
    status: "published" as const,
    updatedAt: now,
  };

  let id: number;
  if (existingId) {
    await db.update(listings).set(values).where(eq(listings.id, existingId));
    id = existingId;
  } else {
    const inserted = await db.insert(listings)
      .values({ ...values, createdAt: now })
      .returning({ id: listings.id });
    id = inserted[0].id;
  }

  // Availability is replaced wholesale — simpler and safer than diffing.
  await db.delete(availabilityBlocks).where(eq(availabilityBlocks.listingId, id));
  if (blocks.length > 0) {
    await db.insert(availabilityBlocks)
      .values(blocks.map((b) => ({ listingId: id, startDay: b.startDay, endDay: b.endDay })));
  }

  await db.delete(flexibleDays).where(eq(flexibleDays.listingId, id));
  if (flex.length > 0) {
    await db.insert(flexibleDays).values(flex.map((day) => ({ listingId: id, day })));
  }

  await db.delete(listingPhotos).where(eq(listingPhotos.listingId, id));
  if (input.photoKeys.length > 0) {
    await db.insert(listingPhotos).values(
      input.photoKeys.map((r2Key, i) => ({ listingId: id, r2Key, sortOrder: i, createdAt: now })),
    );
  }

  return id;
}

export async function setListingStatus(
  id: number, hostId: string, status: "published" | "taken" | "archived",
) {
  await getDb().update(listings)
    .set({ status, updatedAt: Date.now() })
    .where(and(eq(listings.id, id), eq(listings.hostId, hostId)));
}

/**
 * Hide listings whose availability has entirely passed.
 *
 * Cheaper and more predictable than filtering on every search, and it means a
 * host sees their own listing marked expired rather than silently vanishing.
 */
export async function expireStaleListings(): Promise<number> {
  const today = todayInBerlin();
  const rows = await getSql()`
    UPDATE listings SET status = 'archived', updated_at = ${Date.now()}
    WHERE status = 'published'
      AND NOT EXISTS (
        SELECT 1 FROM availability_blocks b
        WHERE b.listing_id = listings.id AND b.end_day > ${today}
      )
    RETURNING id
  `;
  return rows.length;
}
