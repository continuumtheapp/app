import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { currentUser } from "@/lib/session";
import { getRequest, effectiveStatus, requestToSearch } from "@/lib/requests";
import { runSearch } from "@/lib/search";
import { formatRange, todayInBerlin } from "@/lib/dates";
import { formatRate } from "@/lib/pricing";
import { ListingCard, NearMissCard } from "@/components/listing-card";
import { RequestActions } from "@/components/request-actions";
import { RequestStatusBadge } from "@/components/request-status-badge";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your request · SimbaCasa" };

const ROOM_LABEL = {
  either: "A room or a whole flat",
  whole_flat: "A whole flat",
  shared: "A room in a shared flat",
} as const;

export default async function RequestPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const viewer = await currentUser();
  if (!viewer) redirect(`/sign-in?next=/requests/${id}`);

  const request = Number.isInteger(id) ? await getRequest(id) : null;
  // Only the seeker sees their request for now; there's no page for hosts to
  // browse requests yet.
  if (!request || request.seekerId !== viewer.id) notFound();

  const status = effectiveStatus(request);
  const nights = request.checkOut - request.checkIn;
  const results = status === "open" ? await runSearch(requestToSearch(request)) : null;

  const needs = [
    request.datesFlexible && "Dates are flexible",
    request.withChildren && "With children",
    request.withPets && "With a pet",
    request.needsAnmeldung && "Needs Anmeldung",
    request.flintaOnly && "FLINTA only",
  ].filter((x): x is string => Boolean(x));

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <section className="card p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs text-ink-faint">Looking for a place in {request.city}</p>
            <h1 className="mt-0.5 text-xl font-medium tracking-tight">
              {formatRange(request.checkIn, request.checkOut)}
            </h1>
            <p className="mt-0.5 text-sm text-ink-soft">
              {nights} {nights === 1 ? "night" : "nights"} · {request.guests}{" "}
              {request.guests === 1 ? "person" : "people"} · {ROOM_LABEL[request.roomType]}
              {request.maxBudgetCents !== null && request.budgetPeriod !== null && (
                <> · up to {formatRate(request.maxBudgetCents, request.budgetPeriod, request.currency)}</>
              )}
            </p>
            {request.note && (
              <p className="mt-2 text-sm whitespace-pre-wrap">{request.note}</p>
            )}
            {request.areas.length > 0 && (
              <p className="mt-1 text-sm text-ink-soft">{request.areas.join(", ")}</p>
            )}
            {needs.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {needs.map((n) => (
                  <span key={n} className="badge bg-paper text-ink-soft border border-line">{n}</span>
                ))}
              </div>
            )}
          </div>
          <RequestStatusBadge status={status} />
        </div>
        <div className="mt-4 pt-4 border-t border-line">
          <RequestActions id={request.id} status={status} datesPassed={request.checkOut <= todayInBerlin()} />
        </div>
      </section>

      {results && <Matches results={results} />}
    </div>
  );
}

function Matches({ results }: { results: Awaited<ReturnType<typeof runSearch>> }) {
  const { exact, nearMisses, checkIn, checkOut } = results;
  return (
    <>
      <section className="mt-8">
        <h2 className="text-sm font-medium text-ink-soft">
          {exact.length === 0
            ? "No place fits your request exactly yet"
            : `${exact.length} ${exact.length === 1 ? "place fits" : "places fit"} your request`}
        </h2>
        <div className="mt-3 space-y-3">
          {exact.map((l) => (
            <ListingCard key={l.id} listing={l} checkIn={checkIn} checkOut={checkOut} />
          ))}
        </div>
      </section>

      {nearMisses.length > 0 && (
        <section className="mt-10">
          <h2 className="text-sm font-medium text-ink-soft">Not quite, but close</h2>
          <p className="mt-1 text-sm text-ink-faint max-w-prose">
            These don't fit your request as posted. Hosts here are often
            flexible — it's worth asking.
          </p>
          <div className="mt-3 space-y-3">
            {nearMisses.map((l) => (
              <NearMissCard key={l.id} listing={l} checkIn={checkIn} checkOut={checkOut} />
            ))}
          </div>
        </section>
      )}

      <p className="mt-10 text-sm text-ink-faint">
        Want to try other dates? <Link href="/" className="underline underline-offset-2">Search</Link>
      </p>
    </>
  );
}
