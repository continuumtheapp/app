import { redirect } from "next/navigation";
import { currentUser, isMember, isIdVerified } from "@/lib/session";
import { hasContact } from "@/lib/contact";
import Link from "next/link";
import { ListingForm } from "@/components/listing-form";
import { isAiConfigured } from "@/lib/listing-draft";
import { activeListingCount, MAX_ACTIVE_LISTINGS, TOO_MANY_LISTINGS } from "@/lib/listings";

export const dynamic = "force-dynamic";
export const metadata = { title: "Post a place · SimbaCasa" };

export default async function NewListingPage() {
  const user = await currentUser();
  if (!user) redirect("/sign-in?next=/new");
  if (!isMember(user)) redirect("/join");
  // A listing nobody can reply to is useless, so the handle comes first.
  if (!hasContact(user)) redirect("/profile?next=/new");
  // Publishing an offer or a search needs an ID an admin has checked.
  if (!isIdVerified(user)) redirect("/verify?next=/new");

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-medium tracking-tight">Post a place</h1>
      <p className="mt-1.5 text-sm text-ink-soft">
        People will message you directly on Telegram.
      </p>
      <div className="mt-8">
        {await activeListingCount(user.id) >= MAX_ACTIVE_LISTINGS ? (
          <div className="card p-5">
            <p className="text-sm text-ink-soft">{TOO_MANY_LISTINGS}</p>
            <Link href="/my-listings" className="btn btn-secondary mt-4">Your places</Link>
          </div>
        ) : (
          <ListingForm aiEnabled={isAiConfigured()} />
        )}
      </div>
    </div>
  );
}
