import { requestSchema } from "@/lib/validation";
import { saveRequest } from "@/lib/requests";
import { requirePublisher, authErrorResponse } from "@/lib/session";

export async function POST(request: Request) {
  try {
    // Requests are posted by the person looking, never on someone's behalf:
    // whoever needs the place joins and posts it themselves.
    const user = await requirePublisher();

    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.issues[0]?.message ?? "Check the form and try again." },
        { status: 400 },
      );
    }

    const id = await saveRequest(parsed.data, user.id);
    return Response.json({ id });
  } catch (error) {
    return authErrorResponse(error) ?? Response.json(
      { error: "Couldn't save that." }, { status: 500 },
    );
  }
}
