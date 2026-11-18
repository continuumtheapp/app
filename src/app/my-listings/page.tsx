import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/session";
import { getListingsByHost } from "@/lib/listings";
import { formatAllRates } from "@/lib/pricing";
import { MyListingActions } from "@/components/my-listing-actions";
import { getRequestsBySeeker, effectiveStatus } from "@/lib/requests";
import { formatRange, todayInBerlin } from "@/lib/dates";
import { RequestStatusBadge } from "@/components/request-status-badge";

export const dynamic = "force-dynamic";
export const metadata = { title: "My posts · SimbaCasa" };

export default async function MyListingsPage() {
  const user = await currentUser();
  if (!user) redirect("/sign-in?next=/my-listings");

  const [listings, requests] = await Promise.all([
    getListingsByHost(user.id), getRequestsBySeeker(user.id),
  ]);
  const today = todayInBerlin();

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
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
                <MyListingActions id={l.id} status={l.status} />
              </div>
            </article>
          ))}
        </div>
      )}

      <div className="mt-12 flex items-center justify-between gap-4">
        <h2 className="text-xl font-medium tracking-tight">My requests</h2>
        <Link href="/requests/new" className="btn btn-secondary">Look for a place</Link>
      </div>

      {requests.length === 0 ? (
        <div className="card p-8 mt-6 text-center">
          <p className="text-ink-soft">You aren't looking for a place right now.</p>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {requests.map((r) => (
            <article key={r.id} className="card p-4 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <Link href={`/requests/${r.id}`} className="font-medium hover:underline">
                  {formatRange(r.checkIn, r.checkOut)}
                </Link>
                <p className="mt-0.5 text-sm text-ink-soft">
                  {r.city}{r.areas.length > 0 && ` · ${r.areas.join(", ")}`}
                </p>
              </div>
              <RequestStatusBadge status={effectiveStatus(r, today)} />
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
