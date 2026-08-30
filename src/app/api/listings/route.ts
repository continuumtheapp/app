import { listingSchema } from "@/lib/validation";
import { saveListing } from "@/lib/listings";
import { geocodeBerlinAddress } from "@/lib/geo";
import { requireContactableUser, authErrorResponse } from "@/lib/session";
import { requireEnv } from "@/lib/env";

export async function POST(request: Request) {
  try {
    const user = await requireContactableUser();

    const parsed = listingSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.issues[0]?.message ?? "Check the form and try again." },
        { status: 400 },
      );
    }

    // Geocoded once, here — never on page view. Rejects anything outside Berlin.
    const geo = await geocodeBerlinAddress(parsed.data.address, requireEnv("CONTACT_EMAIL"));
    if (!geo.ok) {
      return Response.json({ error: geo.message }, { status: 400 });
    }

    const id = await saveListing(parsed.data, geo.result, user.id);
    return Response.json({ id });
  } catch (error) {
    return authErrorResponse(error) ?? Response.json(
      { error: "Couldn't save that." }, { status: 500 },
    );
  }
}
