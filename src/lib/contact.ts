/**
 * Contact reveals.
 *
 * Handles are hidden behind a button and every reveal is logged. That gives a
 * rate limit against bulk scraping and a signal when someone is behaving badly,
 * without pretending the data is secret from a determined person.
 */
import { and, eq, gte, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { contactReveals, users, listings } from "@/db/schema";

/** A generous ceiling: normal use is a handful a day, scraping is hundreds. */
export const REVEALS_PER_DAY = 40;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface RevealedContact {
  method: "telegram" | "whatsapp";
  handle: string;
  /** Deep link that opens the chat app directly. */
  url: string;
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
      method: users.contactMethod,
      handle: users.contactHandle,
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

  const { method, handle, name } = rows[0];
  if (!method || !handle) {
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

  return { ok: true, contact: { method, handle, url: contactUrl(method, handle), hostName: name } };
}

export function contactUrl(method: "telegram" | "whatsapp", handle: string): string {
  const clean = handle.replace(/^@/, "").trim();
  return method === "telegram"
    ? `https://t.me/${encodeURIComponent(clean)}`
    : `https://wa.me/${encodeURIComponent(clean.replace(/[^\d]/g, ""))}`;
}
