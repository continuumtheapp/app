/**
 * Stays and reviews.
 *
 * When a host marks a place taken, they say who's staying: one of the
 * members who asked for their contact, someone outside SimbaCasa, or they'd
 * rather not say. That records a stay, and a stay with a member on both
 * sides lets each of them write one review of the other. Reviews are written
 * text only: with so few stays per person a star rating would say little.
 */
import { and, desc, eq, isNull, lte, ne, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getDb } from "@/db";
import { contactReveals, listings, reviews, stays, users } from "@/db/schema";
import { todayInBerlin } from "./dates";

export const REVIEW_MIN = 20;
export const REVIEW_MAX = 1000;

export interface Person { id: string; name: string | null; image: string | null; telegramHandle: string | null }

/** The members who asked for this place's contact, newest first: who it was likely let to. */
export async function guestCandidates(listingId: number, hostId: string): Promise<Person[]> {
  const rows = await getDb()
    .select({
      id: users.id, name: users.name, image: users.image, telegramHandle: users.telegramHandle,
      last: sql<number>`max(${contactReveals.revealedAt})`,
    })
    .from(contactReveals)
    .innerJoin(users, eq(users.id, contactReveals.viewerId))
    .where(and(eq(contactReveals.listingId, listingId), ne(users.id, hostId)))
    .groupBy(users.id, users.name, users.image, users.telegramHandle)
    .orderBy(desc(sql`max(${contactReveals.revealedAt})`));
  return rows.map(({ last: _last, ...p }) => p);
}

export type GuestChoice =
  | { kind: "member"; id: string }
  | { kind: "outside" }
  | { kind: "unsaid" };

/** Record who's staying when a place is marked taken. Returns the stay's id. */
export async function recordStay(
  listingId: number, hostId: string, guest: GuestChoice, endsOn: number | null,
): Promise<number> {
  const [listing] = await getDb().select({ title: listings.title }).from(listings)
    .where(and(eq(listings.id, listingId), eq(listings.hostId, hostId))).limit(1);
  if (!listing) throw new Error("Not your listing");
  const [row] = await getDb().insert(stays).values({
    listingId,
    listingTitle: listing.title,
    hostId,
    guestId: guest.kind === "member" ? guest.id : null,
    guestOutside: guest.kind === "outside",
    endsOn,
  }).returning({ id: stays.id });
  return row.id;
}

const host = alias(users, "host");
const guest = alias(users, "guest");

export interface StayForReview {
  id: number;
  listingTitle: string;
  endsOn: number | null;
  /** The person this user would review. */
  other: Person;
  /** This user was the host (and reviews the guest), or the guest. */
  asHost: boolean;
}

/** A stay this user took part in, with a member on the other side, or null. */
export async function stayForReview(stayId: number, userId: string): Promise<StayForReview | null> {
  const [row] = await getDb()
    .select({
      id: stays.id, listingTitle: stays.listingTitle, endsOn: stays.endsOn,
      hostId: stays.hostId, guestId: stays.guestId,
      hostName: host.name, hostImage: host.image, hostHandle: host.telegramHandle,
      guestName: guest.name, guestImage: guest.image, guestHandle: guest.telegramHandle,
    })
    .from(stays)
    .innerJoin(host, eq(host.id, stays.hostId))
    .leftJoin(guest, eq(guest.id, stays.guestId))
    .where(eq(stays.id, stayId))
    .limit(1);
  if (!row || !row.guestId) return null;
  if (row.hostId !== userId && row.guestId !== userId) return null;
  const asHost = row.hostId === userId;
  return {
    id: row.id, listingTitle: row.listingTitle, endsOn: row.endsOn, asHost,
    other: asHost
      ? { id: row.guestId, name: row.guestName, image: row.guestImage, telegramHandle: row.guestHandle }
      : { id: row.hostId, name: row.hostName, image: row.hostImage, telegramHandle: row.hostHandle },
  };
}

/** Reviews can be written once the stay has ended (or right away if no end was given). */
export function reviewOpen(stay: { endsOn: number | null }, today = todayInBerlin()): boolean {
  return stay.endsOn === null || stay.endsOn <= today;
}

/** Stays this user can review and hasn't yet, newest first. */
export async function reviewsToWrite(userId: string): Promise<StayForReview[]> {
  const today = todayInBerlin();
  const rows = await getDb()
    .select({ id: stays.id })
    .from(stays)
    .leftJoin(reviews, and(eq(reviews.stayId, stays.id), eq(reviews.authorId, userId)))
    .where(and(
      sql`${stays.guestId} IS NOT NULL`,
      or(eq(stays.hostId, userId), eq(stays.guestId, userId)),
      or(isNull(stays.endsOn), lte(stays.endsOn, today)),
      isNull(reviews.id),
    ))
    .orderBy(desc(stays.createdAt));
  const out: StayForReview[] = [];
  for (const r of rows) {
    const stay = await stayForReview(r.id, userId);
    if (stay) out.push(stay);
  }
  return out;
}

export async function hasReviewed(stayId: number, authorId: string): Promise<boolean> {
  const [row] = await getDb().select({ id: reviews.id }).from(reviews)
    .where(and(eq(reviews.stayId, stayId), eq(reviews.authorId, authorId))).limit(1);
  return Boolean(row);
}

/** Save a review of the other person in a stay. Returns its id. */
export async function saveReview(stay: StayForReview, authorId: string, body: string): Promise<number> {
  const [row] = await getDb().insert(reviews).values({
    stayId: stay.id, authorId, subjectId: stay.other.id, body,
  }).returning({ id: reviews.id });
  return row.id;
}

export interface ReviewShown {
  id: number;
  body: string;
  createdAt: Date;
  listingTitle: string;
  /** The author was this stay's host (so the subject was the guest). */
  byHost: boolean;
  author: Person;
}

/** Reviews about this person, newest first. */
export async function reviewsAbout(userId: string): Promise<ReviewShown[]> {
  const author = alias(users, "author");
  const rows = await getDb()
    .select({
      id: reviews.id, body: reviews.body, createdAt: reviews.createdAt,
      listingTitle: stays.listingTitle, hostId: stays.hostId,
      authorId: author.id, authorName: author.name, authorImage: author.image, authorHandle: author.telegramHandle,
    })
    .from(reviews)
    .innerJoin(stays, eq(stays.id, reviews.stayId))
    .innerJoin(author, eq(author.id, reviews.authorId))
    .where(eq(reviews.subjectId, userId))
    .orderBy(desc(reviews.createdAt));
  return rows.map((r) => ({
    id: r.id, body: r.body, createdAt: r.createdAt, listingTitle: r.listingTitle,
    byHost: r.hostId === r.authorId,
    author: { id: r.authorId, name: r.authorName, image: r.authorImage, telegramHandle: r.authorHandle },
  }));
}

/** Stays that ended before today whose people haven't been asked for a review yet. */
export async function staysDueForReviewRequest(today = todayInBerlin()) {
  return getDb().select({ id: stays.id, hostId: stays.hostId, guestId: stays.guestId, listingTitle: stays.listingTitle })
    .from(stays)
    .where(and(sql`${stays.guestId} IS NOT NULL`, isNull(stays.reviewRequestedAt), lte(stays.endsOn, today - 1)));
}

export async function markReviewRequested(stayId: number) {
  await getDb().update(stays).set({ reviewRequestedAt: new Date() }).where(eq(stays.id, stayId));
}
