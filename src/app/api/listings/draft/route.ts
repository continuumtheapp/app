import Anthropic from "@anthropic-ai/sdk";
import { draftFromPost, isAiConfigured, MAX_POST_CHARS } from "@/lib/listing-draft";
import { requirePublisher, authErrorResponse } from "@/lib/session";

/** Create with AI: read a pasted Telegram post into the listing form's fields. */
export async function POST(request: Request) {
  try {
    await requirePublisher();
    if (!isAiConfigured()) {
      return Response.json({ error: "Create with AI isn't set up yet." }, { status: 503 });
    }
    const { post } = (await request.json()) as { post?: unknown };
    if (typeof post !== "string" || post.trim().length < 20) {
      return Response.json({ error: "Paste your whole post." }, { status: 400 });
    }
    if (post.length > MAX_POST_CHARS) {
      return Response.json({ error: `Keep it under ${MAX_POST_CHARS} characters.` }, { status: 400 });
    }

    const draft = await draftFromPost(post.trim());
    if (!draft) {
      return Response.json({ error: "Couldn't read that post. Fill in the form instead." }, { status: 422 });
    }
    return Response.json({ draft });
  } catch (error) {
    const auth = authErrorResponse(error);
    if (auth) return auth;
    if (error instanceof Anthropic.RateLimitError || error instanceof Anthropic.InternalServerError) {
      return Response.json({ error: "Busy right now. Try again in a minute." }, { status: 503 });
    }
    console.error("Create with AI failed", error);
    return Response.json({ error: "Couldn't read that post just now." }, { status: 500 });
  }
}
