import { joinSchema } from "@/lib/validation";
import { requestToJoin } from "@/lib/invites";
import { requireUser, authErrorResponse } from "@/lib/session";

/** Ask to join SimbaCasa. An admin then approves or rejects it. */
export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const parsed = joinSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.issues[0]?.message ?? "Check that and try again." },
        { status: 400 },
      );
    }
    const { code, ...profile } = parsed.data;
    const outcome = await requestToJoin(user, code, profile);
    if (!outcome.ok) return Response.json({ error: outcome.message }, { status: 409 });
    return Response.json({ ok: true });
  } catch (error) {
    return authErrorResponse(error) ?? Response.json(
      { error: "Couldn't send that." }, { status: 500 },
    );
  }
}
