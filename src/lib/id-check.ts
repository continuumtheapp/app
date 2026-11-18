/**
 * The ID check before someone can publish an offer or a search.
 *
 * A member uploads a photo of their ID and a selfie; an admin compares them
 * by eye and marks the person checked or not. Then both photos are deleted.
 * All we keep is the result, when, and which admin did it: we don't need the
 * document once we know who the person is, so we don't hold on to it.
 */
import { and, eq, isNotNull } from "drizzle-orm";
import { getDb } from "@/db";
import { users, type User } from "@/db/schema";
import { createViewUrl, deletePhoto, idBucket } from "./photos";

/** Keys handed out by /api/photos/upload-url for purpose "id-doc" / "id-selfie". */
export const ID_CHECK_KEY = /^id-checks\/[0-9a-f-]{36}\.(jpg|png|webp)$/;

export async function submitIdCheck(
  user: User, docKey: string, selfieKey: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (user.idCheckStatus === "verified") return { ok: false, message: "Your ID is already checked." };
  if (!ID_CHECK_KEY.test(docKey) || !ID_CHECK_KEY.test(selfieKey) || docKey === selfieKey) {
    return { ok: false, message: "Upload both photos again." };
  }
  // Sending new photos replaces any still waiting: the old ones go.
  await deleteIdPhotos(user);
  await getDb().update(users).set({
    idCheckStatus: "submitted", idDocKey: docKey, idSelfieKey: selfieKey,
    idSubmittedAt: new Date(), updatedAt: new Date(),
  }).where(eq(users.id, user.id));
  return { ok: true };
}

/** Mark someone checked (or not), and delete their photos either way. */
export async function reviewIdCheck(
  userId: string, decision: "verified" | "rejected", adminId: string,
): Promise<boolean> {
  const db = getDb();
  const [person] = await db.select().from(users)
    .where(and(eq(users.id, userId), eq(users.idCheckStatus, "submitted"))).limit(1);
  if (!person) return false;
  await deleteIdPhotos(person);
  await db.update(users).set({
    idCheckStatus: decision, idDocKey: null, idSelfieKey: null,
    idCheckedAt: new Date(), idCheckedById: adminId, updatedAt: new Date(),
  }).where(eq(users.id, userId));
  return true;
}

async function deleteIdPhotos(person: Pick<User, "idDocKey" | "idSelfieKey">) {
  const bucket = idBucket();
  for (const key of [person.idDocKey, person.idSelfieKey]) {
    if (key) await deletePhoto(key, bucket);
  }
}

/** Waiting ID checks, oldest first, with links that work for a few minutes. */
export async function pendingIdChecks() {
  const rows = await getDb()
    .select({
      id: users.id, name: users.name, image: users.image, telegramHandle: users.telegramHandle,
      idDocKey: users.idDocKey, idSelfieKey: users.idSelfieKey, idSubmittedAt: users.idSubmittedAt,
    })
    .from(users)
    .where(and(eq(users.idCheckStatus, "submitted"), isNotNull(users.idDocKey)))
    .orderBy(users.idSubmittedAt);
  const bucket = idBucket();
  return Promise.all(rows.map(async (r) => ({
    ...r,
    docUrl: await createViewUrl(r.idDocKey!, bucket),
    selfieUrl: await createViewUrl(r.idSelfieKey!, bucket),
  })));
}
