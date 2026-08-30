/**
 * Calendar dates are stored as INTEGER day numbers (days since the Unix epoch),
 * never as ISO strings or timestamps.
 *
 * Why: these are calendar dates ("check in on Mar 3"), not instants. A day
 * number has no time component, so it cannot be shifted across a boundary by a
 * UTC offset — a real hazard here, since Workers run in UTC while users think
 * in Europe/Berlin. It also makes `nights = end - start` plain subtraction and
 * keeps range predicates indexable in SQLite.
 *
 * All date intervals in this codebase are HALF-OPEN: [start, end).
 * A stay of Mar 3 -> Mar 20 is start=Mar 3, end=Mar 20, and lasts 17 nights:
 * you sleep on the 3rd through the 19th and leave on the 20th.
 * Closed intervals would put a ±1 into every comparison, which is exactly
 * where off-by-one bugs breed.
 */

const MS_PER_DAY = 86_400_000;

/** Sentinels for "unbounded", used in place of NULL so SQL min()/max() stay total. */
export const DAY_MIN = -100_000_000;
export const DAY_MAX = 100_000_000;

/** "YYYY-MM-DD" -> day number. Throws on malformed input. */
export function toDayNumber(iso: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) throw new Error(`Invalid date, expected YYYY-MM-DD: ${iso}`);
  const [, y, mo, d] = m;
  const ms = Date.UTC(Number(y), Number(mo) - 1, Number(d));
  if (Number.isNaN(ms)) throw new Error(`Invalid date: ${iso}`);
  const day = ms / MS_PER_DAY;
  // Date.UTC rolls over out-of-range parts (month 13 -> January). Round-trip to reject.
  if (fromDayNumber(day) !== iso) throw new Error(`Invalid date: ${iso}`);
  return day;
}

/** Day number -> "YYYY-MM-DD". */
export function fromDayNumber(day: number): string {
  return new Date(day * MS_PER_DAY).toISOString().slice(0, 10);
}

/** Today in Europe/Berlin, as a day number. */
export function todayInBerlin(now: Date = new Date()): number {
  // en-CA formats as YYYY-MM-DD, which is what toDayNumber expects.
  const iso = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return toDayNumber(iso);
}

/** Nights in the half-open interval [start, end). */
export function nightsBetween(start: number, end: number): number {
  return end - start;
}

/** Format a stay for display, e.g. "3 Mar – 20 Mar 2026". End is the checkout day. */
export function formatRange(start: number, end: number): string {
  const fmt = (day: number, withYear: boolean) =>
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "UTC",
      day: "numeric",
      month: "short",
      ...(withYear ? { year: "numeric" } : {}),
    }).format(new Date(day * MS_PER_DAY));

  const sameYear =
    new Date(start * MS_PER_DAY).getUTCFullYear() ===
    new Date(end * MS_PER_DAY).getUTCFullYear();

  return `${fmt(start, !sameYear)} – ${fmt(end, true)}`;
}
