/**
 * Members as admins see them: who they are and who vouched for them.
 */
import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getDb } from "@/db";
import { users } from "@/db/schema";

const inviter = alias(users, "inviter");

const inviterFields = {
  id: inviter.id, name: inviter.name, telegramHandle: inviter.telegramHandle,
  // How this inviter's invitations have gone, to judge the newest one.
  invitedCount: sql<number>`(SELECT count(*)::int FROM users i
    WHERE i.invited_by_id = ${inviter.id} AND i.join_requested_at IS NOT NULL)`,
  approvedCount: sql<number>`(SELECT count(*)::int FROM users i
    WHERE i.invited_by_id = ${inviter.id} AND i.member_status = 'member')`,
  bannedCount: sql<number>`(SELECT count(*)::int FROM users i
    WHERE i.invited_by_id = ${inviter.id} AND i.is_banned)`,
};

const personFields = {
  id: users.id, name: users.name, image: users.image, bio: users.bio,
  telegramHandle: users.telegramHandle, memberStatus: users.memberStatus,
  isBanned: users.isBanned, idCheckStatus: users.idCheckStatus, idCheckedAt: users.idCheckedAt,
  idCheckedBy: sql<string | null>`(SELECT c.name FROM users c WHERE c.id = ${users.idCheckedById})`,
  joinRequestedAt: users.joinRequestedAt, createdAt: users.createdAt,
};

/** People who asked to join and are waiting, oldest first. */
export async function pendingJoinRequests() {
  const rows = await getDb()
    .select({ person: personFields, inviter: inviterFields })
    .from(users)
    .leftJoin(inviter, eq(users.invitedById, inviter.id))
    .where(and(eq(users.memberStatus, "pending"), isNotNull(users.joinRequestedAt)))
    .orderBy(users.joinRequestedAt);
  return rows.map((r) => ({ ...r, inviter: r.inviter?.id ? r.inviter : null }));
}

/** Everyone, newest first, with who invited them. */
export async function allMembers() {
  const rows = await getDb()
    .select({ person: personFields, inviter: inviterFields })
    .from(users)
    .leftJoin(inviter, eq(users.invitedById, inviter.id))
    .orderBy(desc(users.createdAt))
    .limit(500);
  return rows.map((r) => ({ ...r, inviter: r.inviter?.id ? r.inviter : null }));
}

export async function getPublicProfile(id: string) {
  const [row] = await getDb()
    .select({ id: users.id, name: users.name, image: users.image, bio: users.bio,
      memberStatus: users.memberStatus, isBanned: users.isBanned, createdAt: users.createdAt })
    .from(users).where(eq(users.id, id)).limit(1);
  return row ?? null;
}
