import { getDb } from "@/db";
import { reports } from "@/db/schema";
import { reportSchema } from "@/lib/validation";
import { requireUser, authErrorResponse } from "@/lib/session";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const parsed = reportSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.issues[0]?.message ?? "Check that and try again." },
        { status: 400 },
      );
    }

    try {
      await getDb().insert(reports).values({
        reporterId: user.id,
        listingId: parsed.data.listingId,
        reason: parsed.data.reason,
        status: "open",
        createdAt: Date.now(),
      });
    } catch {
      // A unique index stops one person reporting the same listing repeatedly.
      // Silently accept: they don't need to know, and it isn't an error for them.
      return Response.json({ ok: true });
    }

    return Response.json({ ok: true });
  } catch (error) {
    return authErrorResponse(error) ?? Response.json(
      { error: "Something went wrong." }, { status: 500 },
    );
  }
}
