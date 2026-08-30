/**
 * Conversion between the calendar UI's individual days and the half-open
 * blocks that matching works in.
 *
 * This is the bridge between what a host clicks and what the search engine
 * reasons about, so it is kept pure and tested directly: an off-by-one here
 * would silently shift every listing's availability by a day.
 */
import { fromDayNumber } from "./dates";

/**
 * Turn selected days into half-open blocks.
 * Consecutive days collapse into one run; end is the day AFTER the last night.
 */
export function daysToBlocks(days: number[]): { start: string; end: string }[] {
  if (days.length === 0) return [];
  const sorted = [...days].sort((a, b) => a - b);
  const blocks: { start: string; end: string }[] = [];

  let runStart = sorted[0];
  let previous = sorted[0];

  for (const day of sorted.slice(1)) {
    if (day !== previous + 1) {
      blocks.push({ start: fromDayNumber(runStart), end: fromDayNumber(previous + 1) });
      runStart = day;
    }
    previous = day;
  }
  blocks.push({ start: fromDayNumber(runStart), end: fromDayNumber(previous + 1) });
  return blocks;
}

/** Inverse of daysToBlocks, for loading an existing listing into the editor. */
export function blocksToDays(blocks: { startDay: number; endDay: number }[]): number[] {
  const days: number[] = [];
  for (const b of blocks) for (let d = b.startDay; d < b.endDay; d++) days.push(d);
  return days.sort((a, b) => a - b);
}
