import { formatPrice, type PricePeriod } from "@/lib/pricing";

export function RoomTypeBadge({ roomType, flatmateCount }:
  { roomType: "whole_flat" | "shared"; flatmateCount: number | null }) {
  if (roomType === "whole_flat") {
    return <span className="badge bg-paper text-ink-soft border border-line">Whole flat</span>;
  }
  return (
    <span className="badge bg-paper text-ink-soft border border-line">
      {flatmateCount === 0
        ? "Shared flat"
        : `Shared with ${flatmateCount}`}
    </span>
  );
}

/**
 * FLINTA-only listings are marked, not hidden. Whether a listing is for you is
 * yours to judge — we don't ask anyone to declare their gender to browse.
 */
export function FlintaBadge() {
  return (
    <span className="badge bg-flinta-soft text-flinta" title="This place is offered to FLINTA people only">
      FLINTA only
    </span>
  );
}

export function DepositBadge({ depositCents }: { depositCents: number }) {
  if (depositCents === 0) {
    return <span className="badge bg-accent-soft text-accent-ink">No deposit</span>;
  }
  return (
    <span className="badge bg-paper text-ink-soft border border-line">
      Deposit {formatPrice(depositCents, "night").split(" / ")[0]}
    </span>
  );
}

export function GuestsBadge({ maxGuests }: { maxGuests: number }) {
  return (
    <span className="badge bg-paper text-ink-soft border border-line">
      Sleeps {maxGuests}
    </span>
  );
}

/** Nights the host flagged as uncertain. Informational — never affects matching. */
export function FlexibleNightsBadge({ nights }: { nights: number }) {
  if (nights < 1) return null;
  return (
    <span className="badge bg-flexible-soft text-flexible"
          title="The host marked these nights as not yet certain — worth asking about">
      {nights} {nights === 1 ? "night" : "nights"} to confirm
    </span>
  );
}

export function PriceTag({ priceCents, pricePeriod }:
  { priceCents: number; pricePeriod: PricePeriod }) {
  return (
    <span className="font-medium tabular-nums">
      {formatPrice(priceCents, pricePeriod)}
    </span>
  );
}
