import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/session";
import { getListingsByHost } from "@/lib/listings";
import { formatAllRates } from "@/lib/pricing";
import { MyListingActions } from "@/components/my-listing-actions";
import { getRequestsBySeeker, effectiveStatus } from "@/lib/requests";
import { formatRange, todayInBerlin, fromDayNumber } from "@/lib/dates";
import { guestCandidates, reviewsToWrite } from "@/lib/stays";
import { Avatar } from "@/components/avatar";
import { RequestStatusBadge } from "@/components/request-status-badge";
import { RequestActions } from "@/components/request-actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "My posts · SimbaCasa" };

export default async function MyListingsPage() {
  const user = await currentUser();
  if (!user) redirect("/sign-in?next=/my-listings");

  const [listings, requests, toReview] = await Promise.all([
    getListingsByHost(user.id), getRequestsBySeeker(user.id), reviewsToWrite(user.id),
  ]);
  const today = todayInBerlin();
  // Who to offer when marking a place taken: the members who asked about it.
  const candidates = new Map(await Promise.all(
    listings.filter((l) => l.status === "published")
      .map(async (l) => [l.id, await guestCandidates(l.id, user.id)] as const),
  ));

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {toReview.length > 0 && (
        <section className="mb-12">
          <h2 className="text-xl font-medium tracking-tight">Reviews to write</h2>
          <div className="mt-4 space-y-3">
            {toReview.map((s) => (
              <article key={s.id} className="card p-4">
                <div className="flex items-center gap-3">
                  <Avatar name={s.other.name} image={s.other.image} size={36} />
                  <div className="min-w-0">
                    <p className="font-medium truncate">{s.other.name ?? "Your " + (s.asHost ? "guest" : "host")}</p>
                    <p className="text-sm text-ink-soft truncate">
                      {s.asHost ? "Stayed at" : "Your stay at"} {s.listingTitle}
                    </p>
                  </div>
                </div>
                <Link href={`/stays/${s.id}/review`} className="btn btn-gold w-full mt-4">
                  Write a review
                </Link>
              </article>
            ))}
          </div>
        </section>
      )}

      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-medium tracking-tight">My places</h1>
        <Link href="/new" className="btn btn-primary">Post a place</Link>
      </div>

      {listings.length === 0 ? (
        <div className="card p-8 mt-6 text-center">
          <p className="text-ink-soft">You haven't posted anything yet.</p>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {listings.map((l) => (
            <article key={l.id} className="card p-4">
              <div className="min-w-0">
                <Link href={`/listing/${l.id}`} className="font-medium hover:underline">
                  {l.title}
                </Link>
                <p className="mt-0.5 text-sm text-ink-soft">
                  {formatAllRates(l, l.currency)}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {l.status === "taken" && <span className="badge bg-paper text-ink-soft border border-line">Taken</span>}
                  {l.status === "hidden" && <span className="badge bg-flinta-soft text-flinta">Hidden by an admin</span>}
                  {l.expired && l.status === "published" && (
                    <span className="badge bg-flexible-soft text-flexible">Dates have passed</span>
                  )}
                </div>
              </div>
              <div className="mt-4">
                <MyListingActions id={l.id} status={l.status}
                                  candidates={candidates.get(l.id) ?? []}
                                  lastDay={l.lastDay !== null ? fromDayNumber(l.lastDay) : null} />
              </div>
            </article>
          ))}
        </div>
      )}

      <div className="mt-12 flex items-center justify-between gap-4">
        <h2 className="text-xl font-medium tracking-tight">My requests</h2>
        <Link href="/requests/new" className="btn btn-primary">Look for a place</Link>
      </div>

      {requests.length === 0 ? (
        <div className="card p-8 mt-6 text-center">
          <p className="text-ink-soft">You aren't looking for a place right now.</p>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {requests.map((r) => (
            <article key={r.id} className="card p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <Link href={`/requests/${r.id}`} className="font-medium hover:underline">
                    {formatRange(r.checkIn, r.checkOut)}
                  </Link>
                  <p className="mt-0.5 text-sm text-ink-soft">
                    {r.city}{r.areas.length > 0 && ` · ${r.areas.join(", ")}`}
                  </p>
                </div>
                <RequestStatusBadge status={effectiveStatus(r, today)} />
              </div>
              {/* The same buttons as on the request's own page, like My places. */}
              <div className="mt-4">
                <RequestActions id={r.id} status={effectiveStatus(r, today)} datesPassed={r.checkOut <= today} />
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
