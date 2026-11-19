import { after } from "next/server";
import { onReviewWritten } from "@/lib/bot";
import { hasReviewed, reviewOpen, saveReview, stayForReview, REVIEW_MAX, REVIEW_MIN } from "@/lib/stays";
import { requireContactableUser, authErrorResponse } from "@/lib/session";

/** Write a review of the other person in a stay: once each, once it's ended. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireContactableUser();
    const stay = await stayForReview(Number((await params).id), user.id);
    if (!stay) return Response.json({ error: "Not found." }, { status: 404 });
    if (!reviewOpen(stay)) {
      return Response.json({ error: "You can write a review once the stay has ended." }, { status: 400 });
    }
    if (await hasReviewed(stay.id, user.id)) {
      return Response.json({ error: "You've already reviewed this stay." }, { status: 409 });
    }

    const { body } = (await request.json()) as { body?: string };
    const text = (body ?? "").trim();
    if (text.length < REVIEW_MIN) {
      return Response.json({ error: `Write a little more (at least ${REVIEW_MIN} characters).` }, { status: 400 });
    }
    if (text.length > REVIEW_MAX) {
      return Response.json({ error: `Keep it under ${REVIEW_MAX} characters.` }, { status: 400 });
    }

    const id = await saveReview(stay, user.id, text);
    after(() => onReviewWritten(id));
    return Response.json({ id });
  } catch (error) {
    return authErrorResponse(error) ?? Response.json({ error: "Couldn't save that." }, { status: 500 });
  }
}
