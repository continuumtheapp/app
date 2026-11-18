/**
 * Prices.
 *
 * A host may quote any combination of nightly, weekly and monthly rates —
 * short lets are commonly priced that way, cheaper per night the longer you
 * stay. At least one must be set.
 *
 * Two derived numbers matter:
 *   - `pricePerNightCents`, the cheapest rate normalised to one night, stored
 *     on the listing so budget filters are a single indexed comparison.
 *   - the best-value quote for a specific stay, computed at display time.
 */

import { formatMoney } from "./currency";

export { formatMoney };

export type PricePeriod = "night" | "week" | "month";

/** Nights per period. A month is 30 nights by convention — stated in the UI. */
export const NIGHTS_IN: Record<PricePeriod, number> = { night: 1, week: 7, month: 30 };

export interface Prices {
  priceNightCents: number | null;
  priceWeekCents: number | null;
  priceMonthCents: number | null;
}

/** Every rate the host quoted, as (period, cents) pairs. */
export function quotedRates(p: Prices): [PricePeriod, number][] {
  const out: [PricePeriod, number][] = [];
  if (p.priceNightCents !== null) out.push(["night", p.priceNightCents]);
  if (p.priceWeekCents !== null) out.push(["week", p.priceWeekCents]);
  if (p.priceMonthCents !== null) out.push(["month", p.priceMonthCents]);
  return out;
}

/**
 * The cheapest quoted rate expressed per night.
 *
 * Used for filtering and sorting, so a listing offering €800/month is
 * comparable with one offering €40/night. Returns 0 if nothing is quoted,
 * which the schema forbids anyway.
 */
export function cheapestPerNightCents(p: Prices): number {
  const rates = quotedRates(p).map(([period, cents]) => Math.round(cents / NIGHTS_IN[period]));
  return rates.length === 0 ? 0 : Math.min(...rates);
}

export interface StayQuote {
  /** The period whose rate gives the best value for this stay. */
  period: PricePeriod;
  /** The host's headline figure for that period. */
  rateCents: number;
  /** Estimated total for the whole stay. */
  totalCents: number;
  /** That total divided by the number of nights. */
  perNightCents: number;
}

/**
 * The best-value way to price a specific stay.
 *
 * Charges whole periods and rounds up — a 9-night stay on a weekly rate costs
 * two weeks, which is how hosts actually bill. Whichever period yields the
 * lowest total wins, so a 30-night stay naturally lands on the monthly rate.
 */
export function quoteForStay(p: Prices, nights: number): StayQuote | null {
  if (nights < 1) return null;

  let best: StayQuote | null = null;
  for (const [period, rateCents] of quotedRates(p)) {
    const periods = Math.ceil(nights / NIGHTS_IN[period]);
    const totalCents = periods * rateCents;
    if (!best || totalCents < best.totalCents) {
      best = { period, rateCents, totalCents, perNightCents: Math.round(totalCents / nights) };
    }
  }
  return best;
}

const PERIOD_LABEL: Record<PricePeriod, string> = {
  night: "night",
  week: "week",
  month: "month",
};

export function formatRate(cents: number, period: PricePeriod, currency: string): string {
  return `${formatMoney(cents, currency)} / ${PERIOD_LABEL[period]}`;
}

/** "€40 / night · €250 / week" — every rate the host quoted. */
export function formatAllRates(p: Prices, currency: string): string {
  return quotedRates(p).map(([period, cents]) => formatRate(cents, period, currency)).join(" · ");
}
