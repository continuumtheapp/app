/**
 * Joining SimbaCasa.
 *
 * Every member has one personal invite link, /join/<code>, permanent and
 * reusable. A friend who opens it signs in with Telegram and asks to join;
 * we record whose link it was, and an admin approves or rejects them. So for
 * every member we know who vouched for them, which is what an admin needs
 * when there's a problem with someone.
 *
 * People signing in without a link (those already in the Telegram group) also
 * wait for an admin. Once the bot exists it can approve group members itself.
 */
import { and, count, eq, isNotNull, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { users, type User } from "@/db/schema";
import { photoUrl } from "@/lib/photos";

/** Unambiguous characters: no 0/O, 1/l/I. */
const ALPHABET = "23456789abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ";
const CODE_LENGTH = 12;

/** Random and long enough that links can't be guessed or forged. */
export function newInviteCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

export function inviteUrl(code: string): string {
  const base = (process.env.BETTER_AUTH_URL ?? "http://localhost:4000").replace(/\/$/, "");
  return `${base}/join/${code}`;
}

/** This member's invite code, created the first time they ask for it. */
export async function ensureInviteCode(user: User): Promise<string> {
  if (user.inviteCode) return user.inviteCode;
  if (user.memberStatus !== "member") throw new Error("Only members can invite people.");
  const db = getDb();
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      // Only set it if still unset, so two tabs can't hand out different links.
      const [row] = await db.update(users).set({ inviteCode: newInviteCode() })
        .where(and(eq(users.id, user.id), isNull(users.inviteCode)))
        .returning({ inviteCode: users.inviteCode });
      if (row?.inviteCode) return row.inviteCode;
      const [current] = await db.select({ inviteCode: users.inviteCode })
        .from(users).where(eq(users.id, user.id)).limit(1);
      if (current?.inviteCode) return current.inviteCode;
    } catch (error) {
      // A clash with someone else's code: astronomically rare, just retry.
      if (!String(error).includes("unique")) throw error;
    }
  }
  throw new Error("Couldn't create an invite link.");
}

/** Who a code belongs to, if they can still invite people. */
export async function findInviter(code: string) {
  const [row] = await getDb()
    .select({ id: users.id, name: users.name, image: users.image, isBanned: users.isBanned,
      memberStatus: users.memberStatus })
    .from(users).where(eq(users.inviteCode, code)).limit(1);
  // A banned or removed member's link stops working.
  if (!row || row.isBanned || row.memberStatus !== "member") return null;
  return row;
}

export type JoinOutcome =
  | { ok: true }
  | { ok: false; message: string };

/**
 * Record a signed-in person's request to join, through an invite link or
 * (code null) as someone already in the Telegram group.
 * Only for someone not yet a member: it never changes an existing member's
 * inviter, and a rejected person can't reapply by finding another link.
 */
export async function requestToJoin(
  user: User, code: string | null,
  profile: { name: string; bio: string; avatarKey?: string | null },
): Promise<JoinOutcome> {
  if (user.memberStatus === "member") return { ok: false, message: "You're already a member." };
  if (user.memberStatus === "rejected") {
    return { ok: false, message: "Your request to join wasn't approved." };
  }
  if (user.joinRequestedAt) return { ok: false, message: "You've already asked to join." };

  let invitedById: string | null = null;
  if (code) {
    const inviter = await findInviter(code);
    if (!inviter) return { ok: false, message: "This invite link doesn't work any more." };
    if (inviter.id === user.id) return { ok: false, message: "That's your own invite link." };
    invitedById = inviter.id;
  }

  await getDb().update(users).set({
    name: profile.name,
    bio: profile.bio,
    ...(profile.avatarKey !== undefined
      ? { image: profile.avatarKey ? photoUrl(profile.avatarKey) : null } : {}),
    invitedById, joinRequestedAt: new Date(), updatedAt: new Date(),
  }).where(and(eq(users.id, user.id), eq(users.memberStatus, "pending"),
    isNull(users.joinRequestedAt)));
  return { ok: true };
}

/** Approve or reject someone waiting to join. */
export async function reviewJoinRequest(
  userId: string, decision: "member" | "rejected", adminId: string,
): Promise<boolean> {
  const rows = await getDb().update(users).set({
    memberStatus: decision, reviewedById: adminId, reviewedAt: new Date(), updatedAt: new Date(),
  }).where(and(eq(users.id, userId), eq(users.memberStatus, "pending")))
    .returning({ id: users.id });
  return rows.length > 0;
}

/** How many people joined through this member's link, and how many got in. */
export async function inviteStats(userId: string) {
  const rows = await getDb()
    .select({ status: users.memberStatus, n: count() })
    .from(users)
    .where(and(eq(users.invitedById, userId), isNotNull(users.joinRequestedAt)))
    .groupBy(users.memberStatus);
  const by = Object.fromEntries(rows.map((r) => [r.status, Number(r.n)]));
  return {
    invited: rows.reduce((sum, r) => sum + Number(r.n), 0),
    approved: by.member ?? 0,
    rejected: by.rejected ?? 0,
    pending: by.pending ?? 0,
  };
}
