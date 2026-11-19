/**
 * Housing requests: reads, writes, and turning a request into a search.
 *
 * A request is matched against listings with the same engine seekers use on
 * /search, so "places that fit your request" and a manual search for the same
 * dates can never disagree.
 */
import { eq, and, desc } from "drizzle-orm";
import { getDb } from "@/db";
import { housingRequests } from "@/db/schema";
import { toDayNumber, todayInBerlin } from "./dates";
import { NIGHTS_IN, type PricePeriod } from "./pricing";
import { currencyFor } from "./currency";
import type { RequestInput } from "./validation";
import type { SearchParams } from "./search-query";

export type HousingRequest = typeof housingRequests.$inferSelect;
export type RequestStatus = "open" | "found" | "closed" | "expired";

/**
 * The status to show and act on. "expired" is never stored: a request lapses
 * on its own once check-out has passed, with no job to run and nothing to
 * clean up.
 */
export function effectiveStatus(r: Pick<HousingRequest, "status" | "checkOut">,
  today: number = todayInBerlin()): RequestStatus {
  if (r.status === "open" && r.checkOut <= today) return "expired";
  return r.status;
}

/** How far from a city's centre a request looks for places. */
export const SEARCH_RADIUS_M = 25_000;

/** The search a request stands for. Hard needs become hard filters. */
export function requestToSearch(r: HousingRequest): SearchParams {
  return {
    checkIn: r.checkIn,
    checkOut: r.checkOut,
    guests: r.guests,
    maxPricePerNightCents: budgetPerNightCents(r.maxBudgetCents, r.budgetPeriod),
    roomType: r.roomType === "either" ? null : r.roomType,
    flintaOnly: r.flintaOnly,
    anmeldung: r.needsAnmeldung,
    pets: r.withPets,
    bbox: null,
    // Around the city's centre: near enough to commute, across city limits.
    near: { lat: r.cityLat, lng: r.cityLng, radiusM: SEARCH_RADIUS_M },
  };
}

/** A budget for one period, normalised to one night like listing prices are. */
export function budgetPerNightCents(cents: number | null, period: PricePeriod | null): number | null {
  if (cents === null || period === null) return null;
  return Math.round(cents / NIGHTS_IN[period]);
}

export async function getRequest(id: number): Promise<HousingRequest | null> {
  const rows = await getDb().select().from(housingRequests)
    .where(eq(housingRequests.id, id)).limit(1);
  return rows[0] ?? null;
}

/** A seeker's own requests, newest first. */
export async function getRequestsBySeeker(seekerId: string): Promise<HousingRequest[]> {
  return getDb().select().from(housingRequests)
    .where(eq(housingRequests.seekerId, seekerId))
    .orderBy(desc(housingRequests.updatedAt));
}

/** The columns a request's form fills in. */
function requestValues(input: RequestInput) {
  return {
    city: input.city,
    country: input.country,
    cityLat: input.cityLat,
    cityLng: input.cityLng,
    currency: currencyFor(input.country),
    areas: input.areas,
    note: input.note,
    checkIn: toDayNumber(input.checkIn),
    checkOut: toDayNumber(input.checkOut),
    datesFlexible: input.datesFlexible,
    roomType: input.roomType,
    guests: input.guests,
    withChildren: input.withChildren,
    withPets: input.withPets,
    // The period is only stored alongside an amount; the schema enforces the pair.
    maxBudgetCents: input.maxBudgetCents,
    budgetPeriod: input.maxBudgetCents === null ? null : input.budgetPeriod,
    needsAnmeldung: input.needsAnmeldung,
    flintaOnly: input.flintaOnly,
  };
}

export async function saveRequest(input: RequestInput, seekerId: string): Promise<number> {
  const now = Date.now();
  const inserted = await getDb().insert(housingRequests).values({
    seekerId,
    ...requestValues(input),
    status: "open",
    createdAt: now,
    updatedAt: now,
  }).returning({ id: housingRequests.id });
  return inserted[0].id;
}

/** Edit a seeker's own request. Saving new dates reopens it. */
export async function updateRequest(id: number, input: RequestInput, seekerId: string): Promise<boolean> {
  const updated = await getDb().update(housingRequests)
    .set({ ...requestValues(input), status: "open", updatedAt: Date.now() })
    .where(and(eq(housingRequests.id, id), eq(housingRequests.seekerId, seekerId)))
    .returning({ id: housingRequests.id });
  return updated.length > 0;
}

/** Delete a seeker's own request for good. */
export async function deleteRequest(id: number, seekerId: string): Promise<boolean> {
  const deleted = await getDb().delete(housingRequests)
    .where(and(eq(housingRequests.id, id), eq(housingRequests.seekerId, seekerId)))
    .returning({ id: housingRequests.id });
  return deleted.length > 0;
}

export async function setRequestStatus(
  id: number, seekerId: string, status: "open" | "found" | "closed",
) {
  await getDb().update(housingRequests)
    .set({ status, updatedAt: Date.now() })
    .where(and(eq(housingRequests.id, id), eq(housingRequests.seekerId, seekerId)));
}
