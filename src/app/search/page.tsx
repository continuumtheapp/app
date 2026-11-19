import { Suspense } from "react";
import Link from "next/link";
import { runSearch, parseBbox } from "@/lib/search";
import { currentUser, isMember } from "@/lib/session";
import { basicsOnly } from "@/lib/visibility";
import { searchSchema } from "@/lib/validation";
import { toDayNumber } from "@/lib/dates";
import { SearchSummary } from "@/components/search-summary";
import { ListingCard, NearMissCard } from "@/components/listing-card";
import { SearchResultsMap } from "@/components/search-results-map";
import { MobileMapToggle } from "@/components/mobile-map-toggle";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function SearchPage({ searchParams }: { searchParams: SearchParams }) {
  const raw = await searchParams;
  const parsed = searchSchema.safeParse({
    checkIn: raw.checkIn, checkOut: raw.checkOut, guests: raw.guests,
    // A budget is in the searched city's currency, so it needs a city.
    maxPrice: raw.city ? raw.maxPrice ?? null : null, roomType: raw.roomType ?? null,
    flintaOnly: raw.flintaOnly === "1",
    anmeldung: raw.anmeldung === "1", pets: raw.pets === "1",
    bbox: raw.bbox ?? null,
  });

  if (!parsed.success) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-6">
        <p className="text-ink-soft">
          {parsed.error.issues[0]?.message ?? "Those dates don't look right."}
        </p>
      </div>
    );
  }

  const q = parsed.data;
  const results = await runSearch({
    checkIn: toDayNumber(q.checkIn),
    checkOut: toDayNumber(q.checkOut),
    guests: q.guests,
    maxPricePerNightCents: q.maxPrice === null ? null : q.maxPrice * 100,
    roomType: q.roomType,
    flintaOnly: q.flintaOnly,
    anmeldung: q.anmeldung,
    pets: q.pets,
    bbox: parseBbox(q.bbox),
    near: null,
  });

  // Without an approved account: the area and a rough pin, not the address.
  const viewer = await currentUser().catch(() => null);
  const full = viewer !== null && isMember(viewer) && !viewer.isBanned;
  const { checkIn, checkOut } = results;
  const exact = full ? results.exact : results.exact.map(basicsOnly);
  const nearMisses = full ? results.nearMisses : results.nearMisses.map(basicsOnly);
  const nothing = exact.length === 0 && nearMisses.length === 0;

  return (
    <Shell checkIn={checkIn} checkOut={checkOut} guests={q.guests} place={typeof raw.city === "string" ? raw.city : null}>
      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] gap-6">
        <div className="min-w-0">
          {nothing ? (
            <EmptyState />
          ) : (
            <>
              <section>
                <h2 className="text-sm font-medium text-ink-soft">
                  {exact.length === 0
                    ? "Nothing matches those dates exactly"
                    : `${exact.length} ${exact.length === 1 ? "place fits" : "places fit"} your dates`}
                </h2>
                <div className="mt-3 space-y-4">
                  {exact.map((l) => (
                    <ListingCard key={l.id} listing={l} checkIn={checkIn} checkOut={checkOut} />
                  ))}
                </div>
              </section>

              {nearMisses.length > 0 && (
                <section className="mt-10">
                  <h2 className="text-sm font-medium text-ink-soft">Not quite, but close</h2>
                  <p className="mt-1 text-sm text-ink-faint max-w-prose">
                    These don't fit your dates as posted. Hosts here are often
                    flexible — it's worth asking.
                  </p>
                  <div className="mt-3 space-y-4">
                    {nearMisses.map((l) => (
                      <NearMissCard key={l.id} listing={l} checkIn={checkIn} checkOut={checkOut} />
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </div>

        <div className="hidden lg:block">
          <div className="sticky top-4 h-[calc(100vh-8rem)]">
            <SearchResultsMap exact={exact} nearMisses={nearMisses} />
          </div>
        </div>
      </div>

      <MobileMapToggle exact={exact} nearMisses={nearMisses} />
    </Shell>
  );
}

function Shell({
  children, checkIn, checkOut, guests, place,
}: {
  children: React.ReactNode; checkIn: number; checkOut: number; guests: number; place: string | null;
}) {
  return (
    // Bottom padding on mobile so the floating Map pill never covers the last card.
    <div className="mx-auto max-w-6xl px-4 py-4 sm:py-6 pb-24 lg:pb-6">
      <Suspense fallback={<div className="card h-16 lg:h-32 animate-pulse" />}>
        <SearchSummary checkIn={checkIn} checkOut={checkOut} guests={guests} place={place} />
      </Suspense>
      <div className="mt-4 sm:mt-6">{children}</div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="card p-8 text-center">
      <p className="font-medium">Nothing here for those dates.</p>
      <p className="mt-1.5 text-sm text-ink-soft max-w-sm mx-auto">
        Try widening the dates or raising the budget — or post what you're
        looking for and check back as new places come in.
      </p>
      <div className="mt-5 btn-row max-w-sm mx-auto">
        <Link href="/requests/new" className="btn btn-primary">Post what you need</Link>
        <Link href="/" className="btn btn-secondary">Start over</Link>
      </div>
    </div>
  );
}
