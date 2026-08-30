import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { listings } from "@/db/schema";
import { listingSchema } from "@/lib/validation";
import { saveListing, getListing, setListingStatus } from "@/lib/listings";
import { geocodeBerlinAddress } from "@/lib/geo";
import { requireContactableUser, authErrorResponse } from "@/lib/session";
import { requireEnv } from "@/lib/env";

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

    // Only re-geocode when the address actually changed: it's a network call
    // to a rate-limited service, and the old coordinates are still correct.
    let geo = { lat: existing.lat, lng: existing.lng };
    if (parsed.data.address !== existing.address) {
      const result = await geocodeBerlinAddress(parsed.data.address, requireEnv("CONTACT_EMAIL"));
      if (!result.ok) return Response.json({ error: result.message }, { status: 400 });
      geo = { lat: result.result.lat, lng: result.result.lng };
    }

    await saveListing(parsed.data, geo, user.id, id);
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

    await setListingStatus(id, user.id, status);
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
    return Response.json({ ok: true });
  } catch (error) {
    return authErrorResponse(error) ?? Response.json(
      { error: "Couldn't delete that." }, { status: 500 },
    );
  }
}
