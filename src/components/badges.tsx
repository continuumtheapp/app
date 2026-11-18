import { formatMoney, formatAllRates, quoteForStay, type Prices } from "@/lib/pricing";

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

export function AnmeldungBadge() {
  return <span className="badge bg-accent-soft text-accent-ink">Anmeldung possible</span>;
}

export function PetsBadge() {
  return <span className="badge bg-accent-soft text-accent-ink">Pets allowed</span>;
}

export function DepositBadge({ depositCents, currency }: { depositCents: number; currency: string }) {
  if (depositCents === 0) {
    return <span className="badge bg-accent-soft text-accent-ink">No deposit</span>;
  }
  return (
    <span className="badge bg-paper text-ink-soft border border-line">
      Deposit {formatMoney(depositCents, currency)}
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

/**
 * The headline price.
 *
 * Given a stay length, shows the best-value rate for that stay — a month-long
 * search sees the monthly rate, not the nightly one. Without a stay, lists
 * every rate the host quoted.
 */
export function PriceTag({ prices, currency, nights }: { prices: Prices; currency: string; nights?: number }) {
  const quote = nights ? quoteForStay(prices, nights) : null;
  if (quote) {
    return (
      <span className="font-medium tabular-nums">
        {formatMoney(quote.rateCents, currency)} / {quote.period}
      </span>
    );
  }
  return <span className="font-medium tabular-nums">{formatAllRates(prices, currency)}</span>;
}
