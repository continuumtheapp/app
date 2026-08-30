import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { contactSchema } from "@/lib/validation";
import { requireUser, authErrorResponse } from "@/lib/session";

export async function PUT(request: Request) {
  try {
    const user = await requireUser();
    const body = (await request.json()) as { name?: string; contactMethod?: string; contactHandle?: string };

    const parsed = contactSchema.safeParse({
      contactMethod: body.contactMethod,
      contactHandle: body.contactHandle,
    });
    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.issues[0]?.message ?? "Check that and try again." },
        { status: 400 },
      );
    }

    await getDb().update(users).set({
      name: body.name?.trim().slice(0, 80) || null,
      contactMethod: parsed.data.contactMethod,
      contactHandle: parsed.data.contactHandle,
      updatedAt: Date.now(),
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
