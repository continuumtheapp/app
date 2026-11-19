import { eq } from "drizzle-orm";
import { after } from "next/server";
import { syncListingPost, removeListingPost, onStayRecorded } from "@/lib/bot";
import { guestCandidates, recordStay, type GuestChoice } from "@/lib/stays";
import { toDayNumber } from "@/lib/dates";
import { getDb } from "@/db";
import { listings } from "@/db/schema";
import { listingSchema } from "@/lib/validation";
import {
  saveListing, getListing, setListingStatus,
  activeListingCount, MAX_ACTIVE_LISTINGS, TOO_MANY_LISTINGS,
} from "@/lib/listings";
import { geocodeAddress } from "@/lib/geo";
import { deletePhoto } from "@/lib/photos";
import { requireContactableUser, authErrorResponse } from "@/lib/session";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireContactableUser();
    const id = Number((await params).id);

    const existing = await getListing(id);
    if (!existing) return Response.json({ error: "Not found." }, { status: 404 });
    if (existing.hostId !== user.id) {
      return Response.json({ error: "That isn't your listing." }, { status: 403 });
    }

    const parsed = listingSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.issues[0]?.message ?? "Check the form and try again." },
        { status: 400 },
      );
    }

    // Saving an archived or taken place puts it back up, so then it counts
    // against the limit like a new one. Editing one that's up doesn't.
    if (existing.status !== "published" && await activeListingCount(user.id, id) >= MAX_ACTIVE_LISTINGS) {
      return Response.json({ error: TOO_MANY_LISTINGS }, { status: 409 });
    }

    // Only re-geocode when the address actually changed: it's a network call
    // to a rate-limited service, and the old coordinates are still correct.
    let geo = { lat: existing.lat, lng: existing.lng, city: existing.city, country: existing.country };
    if (parsed.data.address !== existing.address) {
      const result = await geocodeAddress(parsed.data.address);
      if (!result.ok) return Response.json({ error: result.message }, { status: 400 });
      geo = result.result;
    }

    await saveListing(parsed.data, geo, user.id, id);
    after(() => syncListingPost(id));
    return Response.json({ id });
  } catch (error) {
    return authErrorResponse(error) ?? Response.json(
      { error: "Couldn't save that." }, { status: 500 },
    );
  }
}

/** Mark taken or archived. Hosts don't hard-delete: links stay meaningful. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireContactableUser();
    const id = Number((await params).id);
    const { status, guest, endsOn } = (await request.json()) as {
      status?: string; guest?: GuestChoice; endsOn?: string | null;
    };

    if (status !== "taken" && status !== "published" && status !== "archived") {
      return Response.json({ error: "Unknown status." }, { status: 400 });
    }

    if (status === "published" && await activeListingCount(user.id, id) >= MAX_ACTIVE_LISTINGS) {
      return Response.json({ error: TOO_MANY_LISTINGS }, { status: 409 });
    }

    // Marking taken says who's staying, so host and guest can review each other.
    let stayId: number | null = null;
    if (status === "taken" && guest) {
      if (guest.kind === "member") {
        const candidates = await guestCandidates(id, user.id);
        if (!candidates.some((c) => c.id === guest.id)) {
          return Response.json({ error: "Pick someone who asked about this place." }, { status: 400 });
        }
      } else if (guest.kind !== "outside" && guest.kind !== "unsaid") {
        return Response.json({ error: "Say who's staying." }, { status: 400 });
      }
      let endDay: number | null = null;
      if (endsOn) {
        try { endDay = toDayNumber(endsOn); } catch {
          return Response.json({ error: "That end date doesn't look right." }, { status: 400 });
        }
      }
      stayId = await recordStay(id, user.id, guest, endDay);
    }

    await setListingStatus(id, user.id, status);
    after(async () => {
      await syncListingPost(id);
      if (stayId !== null) await onStayRecorded(stayId);
    });
    return Response.json({ ok: true });
  } catch (error) {
    return authErrorResponse(error) ?? Response.json(
      { error: "Couldn't update that." }, { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireContactableUser();
    const id = Number((await params).id);

    const existing = await getListing(id);
    if (!existing) return Response.json({ error: "Not found." }, { status: 404 });
    if (existing.hostId !== user.id) {
      return Response.json({ error: "That isn't your listing." }, { status: 403 });
    }

    // Cascades to blocks, flexible days and photos via the schema's foreign keys.
    await getDb().delete(listings).where(eq(listings.id, id));
    after(async () => {
      await removeListingPost(existing.telegramMessageId);
      // The rows are gone with the listing; the files would otherwise stay in R2.
      await Promise.allSettled(existing.photoKeys.map((key) => deletePhoto(key)));
    });
    return Response.json({ ok: true });
  } catch (error) {
    return authErrorResponse(error) ?? Response.json(
      { error: "Couldn't delete that." }, { status: 500 },
    );
  }
}
