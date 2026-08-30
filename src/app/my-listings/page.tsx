import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/session";
import { getListingsByHost } from "@/lib/listings";
import { formatPrice } from "@/lib/pricing";
import { MyListingActions } from "@/components/my-listing-actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "My listings · Berlin Housing" };

export default async function MyListingsPage() {
  const user = await currentUser();
  if (!user) redirect("/sign-in?next=/my-listings");

  const listings = await getListingsByHost(user.id);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-medium tracking-tight">My listings</h1>
        <Link href="/new" className="btn btn-primary">Post a place</Link>
      </div>

      {listings.length === 0 ? (
        <div className="card p-8 mt-6 text-center">
          <p className="text-ink-soft">You haven't posted anything yet.</p>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {listings.map((l) => (
            <article key={l.id} className="card p-4 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <Link href={`/listing/${l.id}`} className="font-medium hover:underline">
                  {l.title}
                </Link>
                <p className="mt-0.5 text-sm text-ink-soft">
                  {formatPrice(l.priceCents, l.pricePeriod)}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {l.status === "taken" && <span className="badge bg-paper text-ink-soft border border-line">Taken</span>}
                  {l.status === "hidden" && <span className="badge bg-flinta-soft text-flinta">Hidden by an admin</span>}
                  {l.expired && l.status === "published" && (
                    <span className="badge bg-flexible-soft text-flexible">Dates have passed</span>
                  )}
                </div>
              </div>
              <MyListingActions id={l.id} status={l.status} />
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
