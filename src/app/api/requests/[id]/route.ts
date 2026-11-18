import { setRequestStatus, getRequest } from "@/lib/requests";
import { todayInBerlin } from "@/lib/dates";
import { requireContactableUser, authErrorResponse } from "@/lib/session";

/** Mark found, closed, or open again. Requests aren't hard-deleted. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireContactableUser();
    const id = Number((await params).id);
    const { status } = (await request.json()) as { status?: string };

    if (status !== "open" && status !== "found" && status !== "closed") {
      return Response.json({ error: "Unknown status." }, { status: 400 });
    }

    // Reopening a request whose dates have passed would only make it expire
    // again on the spot.
    if (status === "open") {
      const existing = await getRequest(id);
      if (existing && existing.checkOut <= todayInBerlin()) {
        return Response.json({ error: "Those dates have passed. Post new dates instead." }, { status: 400 });
      }
    }

    await setRequestStatus(id, user.id, status);
    return Response.json({ ok: true });
  } catch (error) {
    return authErrorResponse(error) ?? Response.json(
      { error: "Couldn't update that." }, { status: 500 },
    );
  }
}
