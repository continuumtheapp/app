/**
 * Matching a seeker's exact dates against a listing's flexible availability.
 *
 * The seeker asks for an exact stay: [checkIn, checkOut), lasting
 * `checkOut - checkIn` nights. ALL flexibility lives on the host side —
 * availability blocks, optional min/max stay, and days marked "maybe".
 *
 * Two paths:
 *   1. EXACT MATCH  — a block fully contains the stay and the host accepts
 *                     a stay of that length. Plain containment, no subtleties.
 *   2. NEAR MISS    — everything else that is close enough to be worth showing,
 *                     each annotated with WHY it didn't fit so the seeker can
 *                     decide whether to ask the host anyway. This is the
 *                     feature: it's what a group chat gives you that a booking
 *                     site doesn't.
 *
 * Intervals are half-open [start, end). See src/lib/dates.ts.
 */

import { formatRange, fromDayNumber } from "./dates";

/* -------------------------------------------------------------- tuning */

/**
 * Near-miss scoring weights. These encode assumptions about what a seeker
 * will tolerate, and are the part of this module most likely to be wrong —
 * revisit once there is real traffic. All in the same arbitrary "how much
 * does this hurt" unit.
 */
export const WEIGHTS = {
  /** Per night of the requested stay that isn't actually free. */
  missingNight: 3,
  /** Per day the host's availability is offset from what was asked. */
  offsetDay: 4,
  /** Per night the host's own minimum/maximum is away from the request. */
  hostBoundNight: 3,
  /** Per €5/night over budget (cents / 500). */
  overBudgetPer500Cents: 1,
  /** Per bed short of what the seeker needs. */
  missingBed: 40,
} as const;

/** Past this, a listing isn't a near miss any more — it's noise. */
export const NEAR_MISS_SCORE_CUTOFF = 120;
/** Failing on more than this many dimensions is also noise. */
export const NEAR_MISS_MAX_SHORTFALLS = 2;
/** How many near-misses to show at most. */
export const NEAR_MISS_LIMIT = 20;
/** How far outside the requested dates the relaxed query looks, in days. */
export const NEAR_MISS_WINDOW_PAD = 14;
/** How far over the stated budget the relaxed query looks. */
export const NEAR_MISS_BUDGET_FACTOR = 1.25;

/* --------------------------------------------------------------- types */

export interface Block {
  startDay: number;
  endDay: number;
}

export interface Stay {
  checkIn: number;
  checkOut: number;
}

/** The host-side constraints that matter to matching. */
export interface HostTerms {
  blocks: Block[];
  minNights: number | null;
  maxNights: number | null;
  maxGuests: number;
  pricePerNightCents: number;
}

export interface SearchCriteria {
  stay: Stay;
  guests: number;
  maxPricePerNightCents: number | null;
}

export type Shortfall =
  | { kind: "partialAvailability"; availableNights: number; wantedNights: number;
      overlapStart: number; overlapEnd: number }
  | { kind: "startsLate"; availableFrom: number; daysLate: number }
  | { kind: "endsEarly"; availableUntil: number; daysShort: number }
  | { kind: "hostMinStay"; hostMinNights: number; wantedNights: number }
  | { kind: "hostMaxStay"; hostMaxNights: number; wantedNights: number }
  | { kind: "overBudget"; overByCents: number }
  | { kind: "tooSmall"; sleeps: number; needed: number };

/**
 * Stable ordering for shortfall kinds, used as a tiebreak so results never
 * shuffle between identical queries.
 */
const SHORTFALL_RANK: Record<Shortfall["kind"], number> = {
  partialAvailability: 0,
  startsLate: 1,
  endsEarly: 2,
  hostMinStay: 3,
  hostMaxStay: 4,
  overBudget: 5,
  tooSmall: 6,
};

export interface NearMiss {
  shortfalls: Shortfall[];
  score: number;
}

/* ------------------------------------------------------------ predicates */

export function stayNights(stay: Stay): number {
  return stay.checkOut - stay.checkIn;
}

/** Does this block fully contain the stay? */
export function blockContains(block: Block, stay: Stay): boolean {
  return block.startDay <= stay.checkIn && block.endDay >= stay.checkOut;
}

/**
 * Does the host accept a stay of this length?
 * NULL bounds mean unconstrained; the implicit floor is 1 night.
 */
export function hostAcceptsLength(host: Pick<HostTerms, "minNights" | "maxNights">,
                                  nights: number): boolean {
  return nights >= (host.minNights ?? 1) && nights <= (host.maxNights ?? Infinity);
}

/**
 * EXACT MATCH: some availability block fully contains the requested stay,
 * and the host accepts a stay of that length.
 *
 * This must agree exactly with the SQL in src/lib/search-query.ts — there is
 * a test asserting they do.
 */
export function isExactMatch(host: HostTerms, criteria: SearchCriteria): boolean {
  const nights = stayNights(criteria.stay);
  if (nights < 1) return false;
  if (host.maxGuests < criteria.guests) return false;
  if (criteria.maxPricePerNightCents !== null &&
      host.pricePerNightCents > criteria.maxPricePerNightCents) return false;
  if (!hostAcceptsLength(host, nights)) return false;
  return host.blocks.some((b) => blockContains(b, criteria.stay));
}

/** Nights of `stay` that fall inside `block`. Zero or negative means no overlap. */
export function overlapNights(block: Block, stay: Stay): number {
  return Math.min(block.endDay, stay.checkOut) - Math.max(block.startDay, stay.checkIn);
}

/* ------------------------------------------------------------ near misses */

/**
 * Score a listing that failed the exact match, explaining what went wrong.
 * Returns null if it isn't worth showing at all.
 *
 * Picks the block with the greatest overlap: that is the one the host is most
 * likely to be able to stretch, and the one the seeker most wants to hear about.
 */
export function scoreNearMiss(host: HostTerms, criteria: SearchCriteria): NearMiss | null {
  const { stay, guests } = criteria;
  const wanted = stayNights(stay);
  if (wanted < 1) return null;

  const best = bestOverlappingBlock(host.blocks, stay);
  // No overlap at all, and nothing nearby: not a near miss, just unrelated.
  if (!best) return null;

  const shortfalls: Shortfall[] = [];
  const available = Math.max(0, overlapNights(best, stay));

  // --- date shortfalls -----------------------------------------------
  if (available < wanted) {
    if (available > 0) {
      shortfalls.push({
        kind: "partialAvailability",
        availableNights: available,
        wantedNights: wanted,
        overlapStart: Math.max(best.startDay, stay.checkIn),
        overlapEnd: Math.min(best.endDay, stay.checkOut),
      });
    }
    // Report edge misses only when they are the reason, i.e. no usable overlap.
    if (available <= 0) {
      if (best.startDay > stay.checkIn) {
        shortfalls.push({
          kind: "startsLate",
          availableFrom: best.startDay,
          daysLate: best.startDay - stay.checkIn,
        });
      } else {
        shortfalls.push({
          kind: "endsEarly",
          availableUntil: best.endDay,
          daysShort: stay.checkOut - best.endDay,
        });
      }
    }
  }

  // --- host stay bounds ----------------------------------------------
  if (host.minNights !== null && wanted < host.minNights) {
    shortfalls.push({ kind: "hostMinStay", hostMinNights: host.minNights, wantedNights: wanted });
  }
  if (host.maxNights !== null && wanted > host.maxNights) {
    shortfalls.push({ kind: "hostMaxStay", hostMaxNights: host.maxNights, wantedNights: wanted });
  }

  // --- budget and capacity -------------------------------------------
  if (criteria.maxPricePerNightCents !== null &&
      host.pricePerNightCents > criteria.maxPricePerNightCents) {
    shortfalls.push({
      kind: "overBudget",
      overByCents: host.pricePerNightCents - criteria.maxPricePerNightCents,
    });
  }
  if (host.maxGuests < guests) {
    shortfalls.push({ kind: "tooSmall", sleeps: host.maxGuests, needed: guests });
  }

  // An exact match should never reach here; if nothing is wrong, don't show it
  // in the near-miss section.
  if (shortfalls.length === 0) return null;
  if (shortfalls.length > NEAR_MISS_MAX_SHORTFALLS) return null;

  const score = shortfalls.reduce((sum, s) => sum + shortfallPenalty(s), 0);
  if (score > NEAR_MISS_SCORE_CUTOFF) return null;

  shortfalls.sort((a, b) => SHORTFALL_RANK[a.kind] - SHORTFALL_RANK[b.kind]);
  return { shortfalls, score };
}

/** The block overlapping the stay most; falls back to the nearest block. */
export function bestOverlappingBlock(blocks: Block[], stay: Stay): Block | null {
  let best: Block | null = null;
  let bestOverlap = -Infinity;
  let bestDistance = Infinity;

  for (const b of blocks) {
    const ov = overlapNights(b, stay);
    if (ov > 0) {
      if (ov > bestOverlap || (ov === bestOverlap && best && b.startDay < best.startDay)) {
        best = b;
        bestOverlap = ov;
      }
    } else if (bestOverlap <= 0) {
      // No overlapping block yet — track the closest one by gap.
      const gap = b.startDay > stay.checkIn
        ? b.startDay - stay.checkOut
        : stay.checkIn - b.endDay;
      if (gap < bestDistance) {
        best = b;
        bestDistance = gap;
      }
    }
  }
  return best;
}

function shortfallPenalty(s: Shortfall): number {
  switch (s.kind) {
    case "partialAvailability":
      return (s.wantedNights - s.availableNights) * WEIGHTS.missingNight;
    case "startsLate":
      return s.daysLate * WEIGHTS.offsetDay;
    case "endsEarly":
      return s.daysShort * WEIGHTS.offsetDay;
    case "hostMinStay":
      return (s.hostMinNights - s.wantedNights) * WEIGHTS.hostBoundNight;
    case "hostMaxStay":
      return (s.wantedNights - s.hostMaxNights) * WEIGHTS.hostBoundNight;
    case "overBudget":
      return (s.overByCents / 500) * WEIGHTS.overBudgetPer500Cents;
    case "tooSmall":
      return (s.needed - s.sleeps) * WEIGHTS.missingBed;
  }
}

/* ------------------------------------------------------------------ copy */

const euros = (cents: number) =>
  `€${(cents / 100).toLocaleString("de-DE", { maximumFractionDigits: 0 })}`;
const dayName = (day: number) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "numeric", month: "short" })
    .format(new Date(fromDayNumber(day) + "T00:00:00Z"));

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** Human explanation of a shortfall, shown on the near-miss card. */
export function explainShortfall(s: Shortfall): string {
  switch (s.kind) {
    case "partialAvailability":
      return `Free ${s.availableNights} of your ${plural(s.wantedNights, "night")} ` +
             `(${formatRange(s.overlapStart, s.overlapEnd)})`;
    case "startsLate":
      return `Available from ${dayName(s.availableFrom)}, ` +
             `${plural(s.daysLate, "day")} after you wanted`;
    case "endsEarly":
      return `Available until ${dayName(s.availableUntil)}, ` +
             `${plural(s.daysShort, "day")} short`;
    case "hostMinStay":
      return `Host wants ${s.hostMinNights}+ nights, you want ${s.wantedNights}`;
    case "hostMaxStay":
      return `Host hosts max ${plural(s.hostMaxNights, "night")}, you want ${s.wantedNights}`;
    case "overBudget":
      return `${euros(s.overByCents)}/night over your budget`;
    case "tooSmall":
      return `Sleeps ${s.sleeps}, you need ${s.needed}`;
  }
}

/** Total ordering for the near-miss section, so results never shuffle. */
export function compareNearMiss<T extends { near: NearMiss; pricePerNightCents: number; id: number }>(
  a: T, b: T,
): number {
  return (
    a.near.score - b.near.score ||
    a.near.shortfalls.length - b.near.shortfalls.length ||
    SHORTFALL_RANK[a.near.shortfalls[0].kind] - SHORTFALL_RANK[b.near.shortfalls[0].kind] ||
    a.pricePerNightCents - b.pricePerNightCents ||
    a.id - b.id
  );
}

/** How many nights of a matched stay fall on days the host marked "maybe". */
export function countFlexibleNights(flexibleDays: number[], stay: Stay): number {
  const set = new Set(flexibleDays);
  let n = 0;
  for (let d = stay.checkIn; d < stay.checkOut; d++) if (set.has(d)) n++;
  return n;
}
