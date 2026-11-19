/**
 * The SimbaCasa bot, over the Telegram Bot API.
 *
 * What it does, as agreed for launch:
 *  - Messages people privately: the welcome when an admin approves them, the
 *    result of their ID check. (Allowed because they ticked "allow messages"
 *    when signing in: the telegram:bot_access scope.)
 *  - Lets approved members into the group: the group's invite link only
 *    creates a join request, and the bot approves it if that Telegram account
 *    is an approved member here.
 *  - Posts each published place in the group's Listings topic, with a link,
 *    never the host's name or username, and takes the post down when the
 *    place is taken, archived, expired or removed.
 *
 * It never replies in the group and doesn't read its messages.
 *
 * Without TELEGRAM_BOT_TOKEN every call is skipped, so the site works the
 * same locally and before the bot exists.
 */
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { listings, reviews, stays, users } from "@/db/schema";
import { staysDueForReviewRequest, markReviewRequested } from "./stays";
import { getListing } from "./listings";
import { formatAllRates } from "./pricing";
import { formatRange } from "./dates";
import { areaOf } from "./visibility";

const API = "https://api.telegram.org";

export function isBotConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN);
}

function siteUrl(path = ""): string {
  return (process.env.BETTER_AUTH_URL ?? "http://localhost:4000").replace(/\/$/, "") + path;
}

/** The group: its numeric chat id, e.g. -1001234567890. */
function groupId(): string | null {
  return process.env.TELEGRAM_GROUP_ID || null;
}

class TelegramError extends Error {
  constructor(public method: string, public description: string) {
    super(`Telegram ${method}: ${description}`);
  }
}

/** One Bot API call. Throws TelegramError when Telegram says no. */
export async function botCall<T = unknown>(method: string, params: Record<string, unknown>): Promise<T> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new TelegramError(method, "TELEGRAM_BOT_TOKEN isn't set");
  const response = await fetch(`${API}/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
    signal: AbortSignal.timeout(10_000),
  });
  const body = (await response.json().catch(() => ({}))) as { ok?: boolean; result?: T; description?: string };
  if (!body.ok) throw new TelegramError(method, body.description ?? `HTTP ${response.status}`);
  return body.result as T;
}

/**
 * Bot calls made as a side effect of something else (approving someone,
 * saving a listing). They must never make that fail: log and carry on.
 */
async function quietly(what: string, fn: () => Promise<unknown>): Promise<void> {
  if (!isBotConfigured()) return;
  try {
    await fn();
  } catch (error) {
    console.warn(`Bot: couldn't ${what}:`, error instanceof Error ? error.message : error);
  }
}

export function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function telegramIdOf(userId: string): Promise<number | null> {
  const [row] = await getDb().select({ telegramId: users.telegramId })
    .from(users).where(eq(users.id, userId)).limit(1);
  return row?.telegramId ?? null;
}

async function dm(userId: string, html: string) {
  const chatId = await telegramIdOf(userId);
  if (!chatId) return;
  await botCall("sendMessage", {
    chat_id: chatId, text: html, parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
  });
}

/* ---------------------------------------------------------------- joining */

/** After an admin approves someone: welcome them, and let them into the group. */
export async function onMemberApproved(userId: string) {
  const invite = process.env.TELEGRAM_GROUP_INVITE_LINK;
  await quietly("send the welcome", () => dm(userId, [
    "<b>Welcome to SimbaCasa!</b> An admin approved you.",
    "",
    `You can now see every place in full and message hosts: ${siteUrl()}`,
    ...(invite ? ["", `Join the group here: ${invite}`, "The bot will let you in."] : []),
  ].join("\n")));
  // They may have asked to join the group before being approved here.
  await quietly("approve a waiting group join request", async () => {
    const chatId = await telegramIdOf(userId);
    const group = groupId();
    if (chatId && group) await botCall("approveChatJoinRequest", { chat_id: group, user_id: chatId });
  });
}

export async function onMemberRejected(userId: string) {
  await quietly("decline a waiting group join request", async () => {
    const chatId = await telegramIdOf(userId);
    const group = groupId();
    if (chatId && group) await botCall("declineChatJoinRequest", { chat_id: group, user_id: chatId });
  });
}

export async function onIdChecked(userId: string, decision: "verified" | "rejected") {
  await quietly("send the ID check result", () => dm(userId, decision === "verified"
    ? `Your ID is checked. You can now publish a place or a search: ${siteUrl("/post")}`
    : `The admins couldn't confirm your ID from the photos you sent. You can send new ones here: ${siteUrl("/verify")}`));
}

/* ---------------------------------------------------------- stays, reviews */

/**
 * Whether to invite someone to pay for a membership. Membership (Stripe) isn't
 * built yet, so for now nobody is: the hook is here so the stay and review
 * messages below pick it up once it exists.
 */
async function needsMembershipInvite(_userId: string): Promise<boolean> {
  return false;
}

async function nameOf(userId: string): Promise<string> {
  const [row] = await getDb().select({ name: users.name, handle: users.telegramHandle })
    .from(users).where(eq(users.id, userId)).limit(1);
  return row?.name ?? row?.handle ?? "Your host"; // handles are stored with their @
}

/** A host marked a place taken with a member staying: tell the guest. */
export async function onStayRecorded(stayId: number) {
  await quietly("tell the guest about their stay", async () => {
    const [stay] = await getDb().select().from(stays).where(eq(stays.id, stayId)).limit(1);
    if (!stay?.guestId) return;
    const lines = [
      `${escapeHtml(await nameOf(stay.hostId))} marked <b>${escapeHtml(stay.listingTitle)}</b> as taken, with you staying.`,
      "After your stay, you'll be asked to write a short review of each other.",
    ];
    if (await needsMembershipInvite(stay.guestId)) {
      lines.push("", `Deal closed? Become a member: ${siteUrl("/membership")}`);
    }
    await dm(stay.guestId, lines.join("\n"));
  });
}

/**
 * Daily (cron): stays that ended yesterday or earlier, where nobody's been
 * asked yet: ask host and guest to review each other. Only marked as asked
 * once the bot can actually send, so nothing is skipped while it's off.
 */
export async function sendReviewRequests(): Promise<number> {
  if (!isBotConfigured()) return 0;
  const due = await staysDueForReviewRequest();
  for (const stay of due) {
    const link = siteUrl(`/stays/${stay.id}/review`);
    const text = `How was it? Write a short review of your stay at <b>${escapeHtml(stay.listingTitle)}</b>: ${link}`;
    await quietly("ask the host for a review", () => dm(stay.hostId, text));
    if (stay.guestId) await quietly("ask the guest for a review", () => dm(stay.guestId!, text));
    await markReviewRequested(stay.id);
  }
  return due.length;
}

/**
 * A review was written: tell the person it's about. If they aren't a member
 * (agreed plan: "review received by a non-member"), alert the admins too.
 */
export async function onReviewWritten(reviewId: number) {
  await quietly("tell someone about their review", async () => {
    const [review] = await getDb().select().from(reviews).where(eq(reviews.id, reviewId)).limit(1);
    if (!review) return;
    await dm(review.subjectId, `${escapeHtml(await nameOf(review.authorId))} wrote a review of you: ${siteUrl(`/members/${review.subjectId}`)}`);
    const [subject] = await getDb().select({ memberStatus: users.memberStatus }).from(users)
      .where(eq(users.id, review.subjectId)).limit(1);
    if (subject && subject.memberStatus !== "member") {
      const admins = await getDb().select({ id: users.id }).from(users).where(eq(users.isAdmin, true));
      for (const a of admins) {
        await dm(a.id, `A non-member received a review: ${siteUrl(`/members/${review.subjectId}`)}`);
      }
    }
    if (await needsMembershipInvite(review.subjectId)) {
      await dm(review.subjectId, `Become a member to keep using SimbaCasa: ${siteUrl("/membership")}`);
    }
  });
}

/* ------------------------------------------------------------ the webhook */

export interface TelegramUpdate {
  update_id: number;
  message?: { chat: { id: number; type: string }; text?: string; from?: { id: number } };
  chat_join_request?: { chat: { id: number }; from: { id: number }; user_chat_id: number };
}

/** Handle one update Telegram sent to the webhook. */
export async function handleUpdate(update: TelegramUpdate) {
  const request = update.chat_join_request;
  if (request) {
    if (String(request.chat.id) !== groupId()) return;
    const [person] = await getDb()
      .select({ memberStatus: users.memberStatus, isBanned: users.isBanned })
      .from(users).where(eq(users.telegramId, request.from.id)).limit(1);
    if (person && person.memberStatus === "member" && !person.isBanned) {
      await botCall("approveChatJoinRequest", { chat_id: request.chat.id, user_id: request.from.id });
      return;
    }
    // Not approved (yet): leave the request waiting, and tell them how to get
    // in. Approving them on the site lets them in automatically.
    if (!person?.isBanned) {
      await botCall("sendMessage", {
        chat_id: request.user_chat_id, parse_mode: "HTML",
        link_preview_options: { is_disabled: true },
        text: person
          ? "Thanks for asking to join! Your SimbaCasa membership is still waiting for an admin. Once you're approved, you'll be let into the group automatically."
          : `Hi! The group is for SimbaCasa members. Ask a member for their invite link, sign up with Telegram and fill in your profile. Once an admin approves you, you'll be let in automatically.\n\n${siteUrl()}`,
      });
    }
    return;
  }

  // Private messages: there's no conversation, just point to the site.
  const message = update.message;
  if (message && message.chat.type === "private") {
    await botCall("sendMessage", {
      chat_id: message.chat.id,
      link_preview_options: { is_disabled: true },
      text: `This bot only sends SimbaCasa notifications. Everything else happens on the site: ${siteUrl()}`,
    });
  }
}

/* -------------------------------------------------------- listing posts */

const ROOM = { whole_flat: "Whole flat", shared: "Room in a shared flat" } as const;

async function listingPostText(listingId: number): Promise<string | null> {
  const listing = await getListing(listingId);
  if (!listing) return null;
  const blocks = listing.blocks;
  const when = blocks.length > 0
    ? blocks.slice(0, 3).map((b) => formatRange(b.startDay, b.endDay)).join(", ") + (blocks.length > 3 ? ", …" : "")
    : null;
  const tags = [listing.flintaOnly && "FLINTA only", listing.anmeldung && "Anmeldung", listing.petsAllowed && "Pets OK"]
    .filter(Boolean).join(" · ");
  return [
    `🏠 <b>${escapeHtml(listing.title)}</b>`,
    `${escapeHtml(areaOf(listing.address, listing.city))} · ${ROOM[listing.roomType]}`,
    escapeHtml(formatAllRates(listing, listing.currency)),
    ...(when ? [`Free: ${escapeHtml(when)}`] : []),
    ...(tags ? [tags] : []),
    "",
    siteUrl(`/listing/${listing.id}`),
  ].join("\n");
}

/**
 * Bring the group post in line with the listing: post it when it goes up,
 * update it when it's edited, take it down when it's no longer available.
 */
export async function syncListingPost(listingId: number) {
  await quietly(`update the group post for listing ${listingId}`, async () => {
    const group = groupId();
    if (!group) return;
    const [row] = await getDb()
      .select({ status: listings.status, messageId: listings.telegramMessageId })
      .from(listings).where(eq(listings.id, listingId)).limit(1);
    if (!row) return;

    if (row.status !== "published") {
      if (row.messageId) {
        await removePost(row.messageId);
        await getDb().update(listings).set({ telegramMessageId: null }).where(eq(listings.id, listingId));
      }
      return;
    }

    const text = await listingPostText(listingId);
    if (!text) return;
    if (row.messageId) {
      try {
        await botCall("editMessageText", {
          chat_id: group, message_id: row.messageId, text, parse_mode: "HTML",
          link_preview_options: { is_disabled: true },
        });
        return;
      } catch (error) {
        // Unchanged text is fine; a post someone deleted by hand gets reposted.
        if (error instanceof TelegramError && error.description.includes("not modified")) return;
      }
    }
    const topic = process.env.TELEGRAM_LISTINGS_TOPIC_ID;
    const sent = await botCall<{ message_id: number }>("sendMessage", {
      chat_id: group, text, parse_mode: "HTML",
      ...(topic ? { message_thread_id: Number(topic) } : {}),
      link_preview_options: { is_disabled: true },
    });
    await getDb().update(listings).set({ telegramMessageId: sent.message_id }).where(eq(listings.id, listingId));
  });
}

/** For a listing that's about to be deleted outright. */
export async function removeListingPost(messageId: number | null) {
  if (messageId) await quietly("take down a group post", () => removePost(messageId));
}

/**
 * Delete the post; if Telegram won't (old messages sometimes can't be),
 * strike it through instead so nobody chases a place that's gone.
 */
async function removePost(messageId: number) {
  const group = groupId();
  if (!group) return;
  try {
    await botCall("deleteMessage", { chat_id: group, message_id: messageId });
  } catch {
    await botCall("editMessageText", {
      chat_id: group, message_id: messageId, text: "This place is no longer available.",
    });
  }
}
