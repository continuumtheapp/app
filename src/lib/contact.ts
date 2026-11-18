/**
 * Contact reveals.
 *
 * Handles are hidden behind a click and every reveal is logged. That gives a
 * rate limit against bulk scraping and a signal when someone is behaving badly,
 * without pretending the data is secret from a determined person.
 *
 * Members reach each other on Telegram, by @username.
 */
import { and, eq, gte, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { contactReveals, users, listings } from "@/db/schema";

/** A generous ceiling: normal use is a handful a day, scraping is hundreds. */
export const REVEALS_PER_DAY = 40;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface ContactChannel {
  method: "telegram";
  handle: string;
  /** Deep link that opens the chat app directly. */
  url: string;
}

export interface RevealedContact {
  channels: ContactChannel[];
  hostName: string | null;
}

export type RevealOutcome =
  | { ok: true; contact: RevealedContact }
  | { ok: false; reason: "rate_limited" | "no_contact" | "not_found"; message: string };

export async function revealContact(
  listingId: number,
  viewerId: string,
): Promise<RevealOutcome> {
  const db = getDb();

  const since = Date.now() - DAY_MS;
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(contactReveals)
    .where(and(eq(contactReveals.viewerId, viewerId), gte(contactReveals.revealedAt, since)));

  if (count >= REVEALS_PER_DAY) {
    return {
      ok: false,
      reason: "rate_limited",
      message: "You've looked up a lot of contacts today. Try again tomorrow.",
    };
  }

  const rows = await db
    .select({
      telegram: users.telegramHandle,
      name: users.name,
      status: listings.status,
    })
    .from(listings)
    .innerJoin(users, eq(listings.hostId, users.id))
    .where(eq(listings.id, listingId))
    .limit(1);

  if (rows.length === 0 || rows[0].status === "hidden") {
    return { ok: false, reason: "not_found", message: "That listing isn't available." };
  }

  const { telegram, name } = rows[0];
  const channels = contactChannels({ telegramHandle: telegram });
  if (channels.length === 0) {
    return {
      ok: false,
      reason: "no_contact",
      message: "This host hasn't added a contact handle yet.",
    };
  }

  // Log before returning, so a reveal always counts even if the client drops.
  await db.insert(contactReveals).values({
    viewerId, listingId, revealedAt: Date.now(),
  });

  return { ok: true, contact: { channels, hostName: name } };
}

/** How this person can be reached: their Telegram, if they have a username. */
export function contactChannels(u: { telegramHandle: string | null }): ContactChannel[] {
  return u.telegramHandle
    ? [{ method: "telegram", handle: u.telegramHandle, url: telegramUrl(u.telegramHandle) }]
    : [];
}

export function telegramUrl(handle: string): string {
  return `https://t.me/${encodeURIComponent(handle.replace(/^@/, "").trim())}`;
}

/**
 * Can this person post or reveal someone else's contact?
 *
 * Only with a Telegram @username: that is how members reach each other, and
 * what lets the other side recognise who's writing.
 */
export function hasContact(u: { telegramHandle: string | null }): boolean {
  return Boolean(u.telegramHandle);
}
