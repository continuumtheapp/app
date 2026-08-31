import { Suspense } from "react";
import Link from "next/link";
import { runSearch, parseBbox } from "@/lib/search";
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
    maxPrice: raw.maxPrice ?? null, roomType: raw.roomType ?? null,
    noDeposit: raw.noDeposit === "1", flintaOnly: raw.flintaOnly === "1",
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
    noDeposit: q.noDeposit,
    flintaOnly: q.flintaOnly,
    bbox: parseBbox(q.bbox),
    near: null,
  });

  const { exact, nearMisses, checkIn, checkOut } = results;
  const nothing = exact.length === 0 && nearMisses.length === 0;

  return (
    <Shell checkIn={checkIn} checkOut={checkOut} guests={q.guests}>
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
                    These don't fit your dates as posted. Hosts here are often
                    flexible — it's worth asking.
                  </p>
                  <div className="mt-3 space-y-3">
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
  children, checkIn, checkOut, guests,
}: {
  children: React.ReactNode; checkIn: number; checkOut: number; guests: number;
}) {
  return (
    // Bottom padding on mobile so the floating Map pill never covers the last card.
    <div className="mx-auto max-w-6xl px-4 py-4 sm:py-6 pb-24 lg:pb-6">
      <Suspense fallback={<div className="card h-16 lg:h-32 animate-pulse" />}>
        <SearchSummary checkIn={checkIn} checkOut={checkOut} guests={guests} />
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
        looking for in the group chat.
      </p>
      <Link href="/" className="btn btn-secondary mt-5">Start over</Link>
    </div>
  );
}
