/**
 * Availability block normalisation.
 *
 * Blocks for one listing MUST be kept disjoint and non-adjacent. Matching
 * assumes each stored block is a maximal contiguous run: if [10,20) and [20,30)
 * were stored separately, a 15-night stay spanning the seam would find only
 * 10 nights in either block and be wrongly rejected. SQLite has no exclusion
 * constraint, so this is enforced here and must be called on every write.
 */

import type { Block } from "./matching";

/**
 * Merge overlapping and touching blocks into maximal runs.
 * Touching counts as merging: [10,20) and [20,30) become [10,30), because
 * under half-open intervals they describe one unbroken span.
 */
export function mergeBlocks(blocks: Block[]): Block[] {
  const valid = blocks.filter((b) => b.endDay > b.startDay);
  if (valid.length === 0) return [];

  const sorted = [...valid].sort((a, b) => a.startDay - b.startDay || a.endDay - b.endDay);
  const merged: Block[] = [{ ...sorted[0] }];

  for (const b of sorted.slice(1)) {
    const last = merged[merged.length - 1];
    if (b.startDay <= last.endDay) {
      // Overlaps or touches the run in progress: extend it.
      last.endDay = Math.max(last.endDay, b.endDay);
    } else {
      merged.push({ ...b });
    }
  }
  return merged;
}

/**
 * Drop flexible days that no longer fall inside any availability block.
 * Called whenever blocks shrink, so a day can never be marked "maybe available"
 * on a date the listing isn't offered at all.
 */
export function pruneFlexibleDays(days: number[], blocks: Block[]): number[] {
  return days
    .filter((day) => blocks.some((b) => day >= b.startDay && day < b.endDay))
    .sort((a, b) => a - b);
}

/** Total nights offered across all blocks. */
export function totalNights(blocks: Block[]): number {
  return blocks.reduce((sum, b) => sum + (b.endDay - b.startDay), 0);
}

/** The last day any block covers; used to expire stale listings. */
export function lastAvailableDay(blocks: Block[]): number | null {
  if (blocks.length === 0) return null;
  return Math.max(...blocks.map((b) => b.endDay));
}
