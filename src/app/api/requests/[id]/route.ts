import { setRequestStatus, getRequest, updateRequest, deleteRequest } from "@/lib/requests";
import { requestSchema } from "@/lib/validation";
import { todayInBerlin } from "@/lib/dates";
import { requireContactableUser, requirePublisher, authErrorResponse } from "@/lib/session";

/** Mark found, closed, or open again. */
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

/** Edit a request: the same checks as posting one. */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requirePublisher();
    const id = Number((await params).id);
    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.issues[0]?.message ?? "Check the form and try again." },
        { status: 400 },
      );
    }
    if (!(await updateRequest(id, parsed.data, user.id))) {
      return Response.json({ error: "Not found." }, { status: 404 });
    }
    return Response.json({ id });
  } catch (error) {
    return authErrorResponse(error) ?? Response.json(
      { error: "Couldn't save that." }, { status: 500 },
    );
  }
}

/** Delete a request for good. Only its own seeker can. */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireContactableUser();
    const id = Number((await params).id);
    if (!(await deleteRequest(id, user.id))) {
      return Response.json({ error: "Not found." }, { status: 404 });
    }
    return Response.json({ ok: true });
  } catch (error) {
    return authErrorResponse(error) ?? Response.json(
      { error: "Couldn't delete that." }, { status: 500 },
    );
  }
}
