import { revealContact } from "@/lib/contact";
import { requireContactableUser, authErrorResponse } from "@/lib/session";

/**
 * Revealing a contact requires having given one yourself. The board only works
 * if it is reciprocal — a lurker collecting handles gives nothing back.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireContactableUser();
    const listingId = Number((await params).id);
    if (!Number.isInteger(listingId)) {
      return Response.json({ error: "Unknown listing." }, { status: 400 });
    }

    const outcome = await revealContact(listingId, user.id);
    if (!outcome.ok) {
      const status = outcome.reason === "rate_limited" ? 429
                   : outcome.reason === "not_found" ? 404 : 409;
      return Response.json({ error: outcome.message }, { status });
    }
    return Response.json(outcome.contact);
  } catch (error) {
    return authErrorResponse(error) ?? Response.json(
      { error: "Something went wrong." }, { status: 500 },
    );
  }
}
