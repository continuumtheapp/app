/**
 * Prices are entered per night, per week or per month, but must be comparable
 * across listings. We store the host's original figure for display AND a
 * normalised per-night figure for filtering and sorting.
 */

export type PricePeriod = "night" | "week" | "month";

/** Nights per period. A month is 30 nights by convention — stated in the UI. */
const NIGHTS_IN: Record<PricePeriod, number> = { night: 1, week: 7, month: 30 };

export function toPricePerNightCents(priceCents: number, period: PricePeriod): number {
  return Math.round(priceCents / NIGHTS_IN[period]);
}

/** Estimated total for a stay, from the normalised nightly rate. */
export function estimateStayCostCents(pricePerNightCents: number, nights: number): number {
  return pricePerNightCents * nights;
}

const eur = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

export function formatEuros(cents: number): string {
  return eur.format(cents / 100);
}

export function formatPrice(priceCents: number, period: PricePeriod): string {
  const suffix = { night: "night", week: "week", month: "month" }[period];
  return `${formatEuros(priceCents)} / ${suffix}`;
}
