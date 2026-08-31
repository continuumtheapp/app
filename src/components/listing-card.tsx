import Link from "next/link";
import type { ResultListing } from "@/lib/search";
import type { NearMiss } from "@/lib/matching";
import { explainShortfall } from "@/lib/matching";
import { formatRange } from "@/lib/dates";
import { estimateStayCostCents, formatEuros } from "@/lib/pricing";
import { photoUrl } from "@/lib/photos";
import {
  RoomTypeBadge, FlintaBadge, DepositBadge, GuestsBadge,
  FlexibleNightsBadge, PriceTag,
} from "./badges";

interface Props {
  listing: ResultListing;
  checkIn: number;
  checkOut: number;
}

/**
 * Cards stack vertically on phones — photo on top, details below — and switch
 * to a compact side-by-side row from `sm` up. Most use is on a phone, where a
 * squeezed thumbnail beside wrapping text reads badly and hides the photo,
 * which is the thing people actually judge a place by.
 */
export function ListingCard({ listing, checkIn, checkOut }: Props) {
  const nights = checkOut - checkIn;
  const total = estimateStayCostCents(listing.pricePerNightCents, nights);

  return (
    <article className="card overflow-hidden hover:border-line-strong transition-colors">
      <Link href={`/listing/${listing.id}`}
            className="block sm:flex sm:gap-4 sm:p-3 active:bg-paper/60">
        <Cover listing={listing} />

        <div className="min-w-0 flex-1 p-3 sm:p-0">
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-medium leading-snug sm:truncate">{listing.title}</h3>
            <span className="shrink-0 whitespace-nowrap">
              <PriceTag priceCents={listing.priceCents} pricePeriod={listing.pricePeriod} />
            </span>
          </div>

          <p className="mt-1 text-sm text-accent-ink">
            Available {formatRange(checkIn, checkOut)} · {nights} {nights === 1 ? "night" : "nights"}
          </p>
          <p className="text-xs text-ink-faint">
            about {formatEuros(total)} for your stay
          </p>

          <div className="mt-2 flex flex-wrap gap-1.5">
            <RoomTypeBadge roomType={listing.roomType} flatmateCount={listing.flatmateCount} />
            <GuestsBadge maxGuests={listing.maxGuests} />
            <DepositBadge depositCents={listing.depositCents} />
            {listing.flintaOnly && <FlintaBadge />}
            <FlexibleNightsBadge nights={listing.flexibleNights} />
          </div>

          <HostAvailability listing={listing} />
        </div>
      </Link>
    </article>
  );
}

/**
 * A listing that doesn't quite fit — shown with the reason, so the seeker can
 * judge whether to ask anyway. This is the point of the whole site: a group
 * chat surfaces these, a booking site hides them.
 */
export function NearMissCard({ listing, checkIn, checkOut }:
  Props & { listing: ResultListing & { near: NearMiss } }) {
  return (
    <article className="card overflow-hidden border-dashed hover:border-line-strong transition-colors">
      <Link href={`/listing/${listing.id}`}
            className="block sm:flex sm:gap-4 sm:p-3 active:bg-paper/60">
        <Cover listing={listing} muted />

        <div className="min-w-0 flex-1 p-3 sm:p-0">
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-medium leading-snug sm:truncate text-ink-soft">{listing.title}</h3>
            <span className="shrink-0 whitespace-nowrap">
              <PriceTag priceCents={listing.priceCents} pricePeriod={listing.pricePeriod} />
            </span>
          </div>

          {/* The reason leads — it is the most useful thing on the card. */}
          <ul className="mt-1.5 space-y-0.5">
            {listing.near.shortfalls.map((s, i) => (
              <li key={i} className="text-sm text-flexible flex items-start gap-1.5">
                <span aria-hidden className="mt-1.5 size-1 rounded-full bg-flexible shrink-0" />
                {explainShortfall(s)}
              </li>
            ))}
          </ul>

          <div className="mt-2 flex flex-wrap gap-1.5">
            <RoomTypeBadge roomType={listing.roomType} flatmateCount={listing.flatmateCount} />
            <GuestsBadge maxGuests={listing.maxGuests} />
            {listing.flintaOnly && <FlintaBadge />}
          </div>

          <HostAvailability listing={listing} />
        </div>
      </Link>
    </article>
  );
}

function Cover({ listing, muted = false }: { listing: ResultListing; muted?: boolean }) {
  const base = "bg-paper border-line overflow-hidden shrink-0 " + (muted ? "opacity-75 " : "");

  // A full-bleed banner of nothing wastes most of a phone screen, so listings
  // without a photo get a short strip instead of the 3:2 image area.
  if (!listing.coverPhotoKey) {
    return (
      <div className={base +
        "h-12 w-full border-b grid place-items-center text-ink-faint text-xs " +
        "sm:h-auto sm:aspect-square sm:size-28 sm:w-28 sm:rounded-lg sm:border"}>
        No photo
      </div>
    );
  }

  return (
    <div className={base +
      // Phone: a wide banner. Desktop: a small square beside the text.
      "aspect-[3/2] w-full border-b " +
      "sm:aspect-square sm:size-28 sm:w-28 sm:rounded-lg sm:border"}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photoUrl(listing.coverPhotoKey, 800)} alt=""
           className="size-full object-cover" loading="lazy" />
    </div>
  );
}

/** The host's full availability, as context for negotiating. */
function HostAvailability({ listing }: { listing: ResultListing }) {
  if (listing.blocks.length === 0) return null;

  const shown = listing.blocks.slice(0, 2);
  const rest = listing.blocks.length - shown.length;
  const stay =
    listing.minNights || listing.maxNights
      ? ` · stays ${listing.minNights ?? 1}–${listing.maxNights ?? "any"} nights`
      : "";

  return (
    <p className="mt-1.5 text-xs text-ink-faint">
      Host free {shown.map((b) => formatRange(b.startDay, b.endDay)).join(", ")}
      {rest > 0 && ` +${rest} more`}
      {stay}
    </p>
  );
}
