import { z } from "zod";
import { submitIdCheck } from "@/lib/id-check";
import { requireContactableUser, authErrorResponse } from "@/lib/session";

const schema = z.object({ docKey: z.string(), selfieKey: z.string() });

/** Send an ID photo and a selfie for an admin to check. */
export async function POST(request: Request) {
  try {
    const user = await requireContactableUser();
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return Response.json({ error: "Upload both photos." }, { status: 400 });
    const outcome = await submitIdCheck(user, parsed.data.docKey, parsed.data.selfieKey);
    if (!outcome.ok) return Response.json({ error: outcome.message }, { status: 409 });
    return Response.json({ ok: true });
  } catch (error) {
    return authErrorResponse(error) ?? Response.json(
      { error: "Couldn't send that." }, { status: 500 },
    );
  }
}
