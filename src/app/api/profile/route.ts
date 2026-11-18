import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { profileSchema } from "@/lib/validation";
import { requireUser, authErrorResponse } from "@/lib/session";
import { photoUrl } from "@/lib/photos";

export async function PUT(request: Request) {
  try {
    const user = await requireUser();
    const parsed = profileSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.issues[0]?.message ?? "Check that and try again." },
        { status: 400 },
      );
    }

    const { name, bio, avatarKey } = parsed.data;
    await getDb().update(users).set({
      name: name || null,
      bio: bio || null,
      ...(avatarKey !== undefined ? { image: avatarKey ? photoUrl(avatarKey) : null } : {}),
      updatedAt: new Date(),
    }).where(eq(users.id, user.id));

    return Response.json({ ok: true });
  } catch (error) {
    return authErrorResponse(error) ?? Response.json(
      { error: "Couldn't save that." }, { status: 500 },
    );
  }
}

/**
 * Delete the account and everything attached to it.
 * Listings, blocks, photos, reveals and reports cascade from the schema's
 * foreign keys, so this one statement really does remove it all.
 */
export async function DELETE() {
  try {
    const user = await requireUser();
    await getDb().delete(users).where(eq(users.id, user.id));
    return Response.json({ ok: true });
  } catch (error) {
    return authErrorResponse(error) ?? Response.json(
      { error: "Couldn't delete that." }, { status: 500 },
    );
  }
}
