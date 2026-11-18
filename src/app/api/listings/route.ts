import { after } from "next/server";
import { listingSchema } from "@/lib/validation";
import { syncListingPost } from "@/lib/bot";
import { saveListing, activeListingCount, MAX_ACTIVE_LISTINGS, TOO_MANY_LISTINGS } from "@/lib/listings";
import { geocodeAddress } from "@/lib/geo";
import { requirePublisher, authErrorResponse } from "@/lib/session";

export async function POST(request: Request) {
  try {
    const user = await requirePublisher();
    if (await activeListingCount(user.id) >= MAX_ACTIVE_LISTINGS) {
      return Response.json({ error: TOO_MANY_LISTINGS }, { status: 409 });
    }

    const parsed = listingSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.issues[0]?.message ?? "Check the form and try again." },
        { status: 400 },
      );
    }

    // Geocoded once, here — never on page view. Anywhere in the world.
    const geo = await geocodeAddress(parsed.data.address);
    if (!geo.ok) {
      return Response.json({ error: geo.message }, { status: 400 });
    }

    const id = await saveListing(parsed.data, geo.result, user.id);
    after(() => syncListingPost(id));
    return Response.json({ id });
  } catch (error) {
    return authErrorResponse(error) ?? Response.json(
      { error: "Couldn't save that." }, { status: 500 },
    );
  }
}
