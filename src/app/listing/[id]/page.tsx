import { notFound } from "next/navigation";
import Link from "next/link";
import { getListing } from "@/lib/listings";
import { currentUser, isMember } from "@/lib/session";
import { hasContact } from "@/lib/contact";
import { photoUrl } from "@/lib/photos";
import { PhotoCarousel } from "@/components/photo-carousel";
import { approximate, areaOf } from "@/lib/visibility";
import { formatAllRates, formatMoney, quotedRates } from "@/lib/pricing";
import { AvailabilityCalendar } from "@/components/availability-calendar";
import { ContactReveal } from "@/components/contact-reveal";
import { ReportButton } from "@/components/report-button";
import { ListingMapPanel } from "@/components/listing-map-panel";
import { Avatar } from "@/components/avatar";
import {
  RoomTypeBadge, FlintaBadge, AnmeldungBadge, PetsBadge, DepositBadge, GuestsBadge,
} from "@/components/badges";

export const dynamic = "force-dynamic";

export default async function ListingPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();

  const listing = await getListing(id);
  if (!listing || listing.status === "hidden" || listing.status === "draft") notFound();

  const viewer = await currentUser().catch(() => null);
  const isOwner = viewer?.id === listing.hostId;
  // Approved members (and admins) see everything; everyone else the basics.
  const full = isOwner || Boolean(viewer && !viewer.isBanned && (isMember(viewer) || viewer.isAdmin));
  const photos = full ? listing.photoKeys : listing.photoKeys.slice(0, 1);
  const pin = full
    ? { lat: listing.lat, lng: listing.lng }
    : { lat: approximate(listing.lat), lng: approximate(listing.lng) };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {listing.status === "taken" && (
        <p className="card bg-paper px-4 py-3 mb-6 text-sm text-ink-soft">
          This place has been taken. It's kept here for reference.
        </p>
      )}

      {/* Photos first, one at a time: the details stay a swipe away. */}
      {photos.length > 0 && (
        <div className="mb-5">
          <PhotoCarousel urls={photos.map((key) => photoUrl(key, 1600))} />
        </div>
      )}

      <div className="sm:flex sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-medium tracking-tight text-balance">{listing.title}</h1>
          <p className="mt-1 text-sm text-ink-faint">
            {full ? listing.address : areaOf(listing.address, listing.city)}
          </p>
          {full && (
            <Link href={`/members/${listing.host.id}`}
                  className="mt-3 inline-flex items-center gap-2 text-sm text-ink-soft hover:text-ink">
              <Avatar name={listing.host.name} image={listing.host.image} size={28} />
              Hosted by {listing.host.name ?? "a member"}
            </Link>
          )}
        </div>
        <div className="mt-2 sm:mt-0 sm:text-right shrink-0">
          <p className="text-lg font-medium tabular-nums">
            {formatAllRates(listing, listing.currency)}
          </p>
          {quotedRates(listing).length === 1 && quotedRates(listing)[0][0] !== "night" && (
            <p className="text-xs text-ink-faint">
              about {formatMoney(listing.pricePerNightCents, listing.currency)} a night
            </p>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <RoomTypeBadge roomType={listing.roomType} flatmateCount={listing.flatmateCount} />
        <GuestsBadge maxGuests={listing.maxGuests} />
        <DepositBadge depositCents={listing.depositCents} currency={listing.currency} />
        {listing.flintaOnly && <FlintaBadge />}
        {listing.anmeldung && <AnmeldungBadge />}
        {listing.petsAllowed && <PetsBadge />}
      </div>


      {!full && (
        <div className="mt-6 card bg-paper p-4 text-sm text-ink-soft">
          {viewer ? (
            <>
              The address, description, all the photos and who's hosting are
              for approved members.{" "}
              <Link href="/join" className="underline underline-offset-2">Your membership</Link>
            </>
          ) : (
            <>
              The address, description, all the photos and who's hosting are
              for members.{" "}
              <Link href={`/sign-in?next=/listing/${listing.id}`} className="underline underline-offset-2">
                Sign in
              </Link>{" "}
              to see them.
            </>
          )}
        </div>
      )}

      {full && listing.description && (
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
        {!full && <p className="mt-1 text-sm text-ink-soft">Roughly: the pin is within about 500 m.</p>}
        <div className="mt-3 h-64">
          <ListingMapPanel
            pins={[{
              id: listing.id, lat: pin.lat, lng: pin.lng, title: listing.title,
              pricePerNightCents: listing.pricePerNightCents, currency: listing.currency,
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
                         member={viewer ? isMember(viewer) : false}
                         hasContact={viewer ? hasContact(viewer) : false} />
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
