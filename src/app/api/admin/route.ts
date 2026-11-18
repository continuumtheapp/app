import { eq } from "drizzle-orm";
import { after } from "next/server";
import { getDb } from "@/db";
import { reports, listings, users } from "@/db/schema";
import { requireAdmin, authErrorResponse } from "@/lib/session";
import { reviewJoinRequest } from "@/lib/invites";
import { reviewIdCheck } from "@/lib/id-check";
import { onMemberApproved, onMemberRejected, onIdChecked, syncListingPost } from "@/lib/bot";

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    const { action, reportId, listingId, hostId, userId } = (await request.json()) as {
      action?: string; reportId?: number; listingId?: number; hostId?: string; userId?: string;
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
        after(() => syncListingPost(listingId!));
        break;

      case "unhide":
        await db.update(listings).set({ status: "published", updatedAt: now })
          .where(eq(listings.id, listingId!));
        after(() => syncListingPost(listingId!));
        break;

      case "ban":
        await db.update(users).set({ isBanned: true, updatedAt: new Date(now) })
          .where(eq(users.id, hostId!));
        // Hide everything they posted, not just the reported listing.
        const theirs = await db.update(listings).set({ status: "hidden", updatedAt: now })
          .where(eq(listings.hostId, hostId!)).returning({ id: listings.id });
        after(async () => { for (const l of theirs) await syncListingPost(l.id); });
        await db.update(reports).set({ status: "actioned", resolvedAt: now })
          .where(eq(reports.id, reportId!));
        break;

      case "approve":
      case "reject":
        if (!userId || !(await reviewJoinRequest(userId, action === "approve" ? "member" : "rejected", admin.id))) {
          return Response.json({ error: "That request was already handled." }, { status: 409 });
        }
        after(() => action === "approve" ? onMemberApproved(userId) : onMemberRejected(userId));
        break;

      case "verify-id":
      case "reject-id":
        if (!userId || !(await reviewIdCheck(userId, action === "verify-id" ? "verified" : "rejected", admin.id))) {
          return Response.json({ error: "That ID check was already handled." }, { status: 409 });
        }
        after(() => onIdChecked(userId, action === "verify-id" ? "verified" : "rejected"));
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
