import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { currentUser } from "@/lib/session";
import { hasReviewed, reviewOpen, stayForReview, REVIEW_MAX, REVIEW_MIN } from "@/lib/stays";
import { formatDay } from "@/lib/dates";
import { Avatar } from "@/components/avatar";
import { ReviewForm } from "@/components/review-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Write a review · SimbaCasa" };

export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const user = await currentUser();
  if (!user) redirect(`/sign-in?next=/stays/${id}/review`);

  const stay = Number.isInteger(id) ? await stayForReview(id, user.id) : null;
  if (!stay) notFound();
  const name = stay.other.name ?? (stay.asHost ? "your guest" : "your host");

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-medium tracking-tight">Write a review</h1>
      <div className="mt-4 flex items-center gap-3">
        <Avatar name={stay.other.name} image={stay.other.image} size={44} />
        <div className="min-w-0">
          <p className="font-medium">{name}</p>
          <p className="text-sm text-ink-soft">
            {stay.asHost ? "Your guest at" : "Your host at"} {stay.listingTitle}
          </p>
        </div>
      </div>

      <div className="mt-6">
        {await hasReviewed(stay.id, user.id) ? (
          <p className="card p-5 text-ink-soft">You&apos;ve already reviewed this stay. <Link href={`/members/${stay.other.id}`} className="underline underline-offset-2">See it on their profile</Link></p>
        ) : !reviewOpen(stay) ? (
          <p className="card p-5 text-ink-soft">
            You can write a review from {stay.endsOn !== null ? formatDay(stay.endsOn) : "the end of the stay"}.
          </p>
        ) : (
          <ReviewForm stayId={stay.id} min={REVIEW_MIN} max={REVIEW_MAX} otherName={name} />
        )}
      </div>
    </div>
  );
}
