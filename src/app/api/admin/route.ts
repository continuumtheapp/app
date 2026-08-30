import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { reports, listings, users } from "@/db/schema";
import { requireAdmin, authErrorResponse } from "@/lib/session";

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const { action, reportId, listingId, hostId } = (await request.json()) as {
      action?: string; reportId?: number; listingId?: number; hostId?: string;
    };

    const db = getDb();
    const now = Date.now();

    switch (action) {
      case "dismiss":
        await db.update(reports)
          .set({ status: "dismissed", resolvedAt: now })
          .where(eq(reports.id, reportId!));
        break;

      case "hide":
        await db.update(listings).set({ status: "hidden", updatedAt: now })
          .where(eq(listings.id, listingId!));
        await db.update(reports).set({ status: "actioned", resolvedAt: now })
          .where(eq(reports.id, reportId!));
        break;

      case "unhide":
        await db.update(listings).set({ status: "published", updatedAt: now })
          .where(eq(listings.id, listingId!));
        break;

      case "ban":
        await db.update(users).set({ isBanned: true, updatedAt: now })
          .where(eq(users.id, hostId!));
        // Hide everything they posted, not just the reported listing.
        await db.update(listings).set({ status: "hidden", updatedAt: now })
          .where(eq(listings.hostId, hostId!));
        await db.update(reports).set({ status: "actioned", resolvedAt: now })
          .where(eq(reports.id, reportId!));
        break;

      default:
        return Response.json({ error: "Unknown action." }, { status: 400 });
    }

    return Response.json({ ok: true });
  } catch (error) {
    return authErrorResponse(error) ?? Response.json(
      { error: "Couldn't do that." }, { status: 500 },
    );
  }
}
