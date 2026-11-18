import { eq } from "drizzle-orm";
import { after } from "next/server";
import { syncListingPost, removeListingPost } from "@/lib/bot";
import { getDb } from "@/db";
import { listings } from "@/db/schema";
import { listingSchema } from "@/lib/validation";
import {
  saveListing, getListing, setListingStatus,
  activeListingCount, MAX_ACTIVE_LISTINGS, TOO_MANY_LISTINGS,
} from "@/lib/listings";
import { geocodeAddress } from "@/lib/geo";
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
    const { status } = (await request.json()) as { status?: string };

    if (status !== "taken" && status !== "published" && status !== "archived") {
      return Response.json({ error: "Unknown status." }, { status: 400 });
    }

    if (status === "published" && await activeListingCount(user.id, id) >= MAX_ACTIVE_LISTINGS) {
      return Response.json({ error: TOO_MANY_LISTINGS }, { status: 409 });
    }
    await setListingStatus(id, user.id, status);
    after(() => syncListingPost(id));
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
    after(() => removeListingPost(existing.telegramMessageId));
    return Response.json({ ok: true });
  } catch (error) {
    return authErrorResponse(error) ?? Response.json(
      { error: "Couldn't delete that." }, { status: 500 },
    );
  }
}
