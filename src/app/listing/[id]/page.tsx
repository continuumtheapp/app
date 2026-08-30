import { notFound } from "next/navigation";
import Link from "next/link";
import { getListing } from "@/lib/listings";
import { currentUser } from "@/lib/session";
import { photoUrl } from "@/lib/photos";
import { formatPrice, formatEuros } from "@/lib/pricing";
import { AvailabilityCalendar } from "@/components/availability-calendar";
import { ContactReveal } from "@/components/contact-reveal";
import { ReportButton } from "@/components/report-button";
import { ListingMapPanel } from "@/components/listing-map-panel";
import {
  RoomTypeBadge, FlintaBadge, DepositBadge, GuestsBadge,
} from "@/components/badges";

export const dynamic = "force-dynamic";

export default async function ListingPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();

  const listing = await getListing(id);
  if (!listing || listing.status === "hidden" || listing.status === "draft") notFound();

  const viewer = await currentUser().catch(() => null);
  const isOwner = viewer?.id === listing.hostId;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {listing.status === "taken" && (
        <p className="card bg-paper px-4 py-3 mb-6 text-sm text-ink-soft">
          This place has been taken. It's kept here for reference.
        </p>
      )}

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-medium tracking-tight text-balance">{listing.title}</h1>
          <p className="mt-1 text-sm text-ink-faint">{listing.address}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-lg font-medium tabular-nums">
            {formatPrice(listing.priceCents, listing.pricePeriod)}
          </p>
          {listing.pricePeriod !== "night" && (
            <p className="text-xs text-ink-faint">
              about {formatEuros(listing.pricePerNightCents)} a night
            </p>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <RoomTypeBadge roomType={listing.roomType} flatmateCount={listing.flatmateCount} />
        <GuestsBadge maxGuests={listing.maxGuests} />
        <DepositBadge depositCents={listing.depositCents} />
        {listing.flintaOnly && <FlintaBadge />}
      </div>

      {listing.photoKeys.length > 0 && (
        <div className="mt-6 grid gap-2 sm:grid-cols-2">
          {listing.photoKeys.map((key, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={key}
              src={photoUrl(key, i === 0 ? 1600 : 800)}
              alt=""
              loading={i === 0 ? "eager" : "lazy"}
              className={`w-full rounded-xl border border-line object-cover
                          ${i === 0 ? "sm:col-span-2 max-h-[420px]" : "max-h-56"}`}
            />
          ))}
        </div>
      )}

      {listing.description && (
        <div className="mt-8 max-w-prose">
          <p className="whitespace-pre-wrap leading-relaxed text-ink-soft">
            {listing.description}
          </p>
        </div>
      )}

      <section className="mt-10">
        <h2 className="font-medium">When it's free</h2>
        {(listing.minNights || listing.maxNights) && (
          <p className="mt-1 text-sm text-ink-soft">
            {listing.minNights && listing.maxNights
              ? `Stays of ${listing.minNights} to ${listing.maxNights} nights.`
              : listing.minNights
                ? `Stays of ${listing.minNights} nights or more.`
                : `Stays of up to ${listing.maxNights} nights.`}
          </p>
        )}
        <div className="mt-4">
          <AvailabilityCalendar blocks={listing.blocks} flexibleDays={listing.flexibleDays} />
        </div>
      </section>

      <section className="mt-10">
        <h2 className="font-medium">Where it is</h2>
        <div className="mt-3 h-64">
          <ListingMapPanel
            pins={[{
              id: listing.id, lat: listing.lat, lng: listing.lng, title: listing.title,
              priceCents: listing.priceCents, pricePeriod: listing.pricePeriod,
            }]}
          />
        </div>
      </section>

      <section className="mt-10 card p-5">
        {isOwner ? (
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-ink-soft">This is your listing.</p>
            <Link href={`/listing/${listing.id}/edit`} className="btn btn-secondary">Edit</Link>
          </div>
        ) : (
          <ContactReveal listingId={listing.id} signedIn={Boolean(viewer)}
                         hasContact={Boolean(viewer?.contactHandle)} />
        )}
      </section>

      {viewer && !isOwner && (
        <div className="mt-6 text-right">
          <ReportButton listingId={listing.id} />
        </div>
      )}
    </div>
  );
}
