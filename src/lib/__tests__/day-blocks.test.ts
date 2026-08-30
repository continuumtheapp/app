/**
 * The calendar UI works in individual days; matching works in half-open blocks.
 * This conversion is the bridge between them, and an off-by-one here would
 * silently shift every listing's availability by a day.
 */
import { describe, it, expect } from "vitest";
import { daysToBlocks, blocksToDays } from "../availability";
import { toDayNumber as d, fromDayNumber } from "../dates";
import { mergeBlocks } from "../blocks";

describe("daysToBlocks", () => {
  it("turns a single selected day into a one-night block", () => {
    // Available on the 5th means: sleep the night of the 5th, leave on the 6th.
    expect(daysToBlocks([d("2026-03-05")]))
      .toEqual([{ start: "2026-03-05", end: "2026-03-06" }]);
  });

  it("collapses consecutive days into one block", () => {
    const days = [5, 6, 7, 8].map((n) => d(`2026-03-0${n}`));
    expect(daysToBlocks(days)).toEqual([{ start: "2026-03-05", end: "2026-03-09" }]);
  });

  it("splits non-consecutive days into separate blocks", () => {
    const days = [...[5, 6, 7], ...[15, 16]].map((n) =>
      d(`2026-03-${String(n).padStart(2, "0")}`));
    expect(daysToBlocks(days)).toEqual([
      { start: "2026-03-05", end: "2026-03-08" },
      { start: "2026-03-15", end: "2026-03-17" },
    ]);
  });

  it("handles unsorted input", () => {
    const days = [7, 5, 6].map((n) => d(`2026-03-0${n}`));
    expect(daysToBlocks(days)).toEqual([{ start: "2026-03-05", end: "2026-03-08" }]);
  });

  it("spans a month boundary without a gap", () => {
    const days = [d("2026-03-30"), d("2026-03-31"), d("2026-04-01")];
    expect(daysToBlocks(days)).toEqual([{ start: "2026-03-30", end: "2026-04-02" }]);
  });

  it("returns nothing for no selection", () => {
    expect(daysToBlocks([])).toEqual([]);
  });
});

describe("round trip", () => {
  it("blocksToDays and daysToBlocks are inverses", () => {
    const blocks = [
      { startDay: d("2026-03-05"), endDay: d("2026-03-09") },
      { startDay: d("2026-03-20"), endDay: d("2026-03-22") },
    ];
    const days = blocksToDays(blocks);
    expect(days).toHaveLength(4 + 2);

    const roundTripped = daysToBlocks(days);
    expect(roundTripped).toEqual([
      { start: "2026-03-05", end: "2026-03-09" },
      { start: "2026-03-20", end: "2026-03-22" },
    ]);
  });

  it("produces blocks that need no further merging", () => {
    // daysToBlocks already yields maximal runs, so mergeBlocks is a no-op.
    const days = [5, 6, 7, 15, 16].map((n) => d(`2026-03-${String(n).padStart(2, "0")}`));
    const blocks = daysToBlocks(days).map((b) => ({
      startDay: d(b.start), endDay: d(b.end),
    }));
    expect(mergeBlocks(blocks)).toEqual(blocks);
  });

  it("a day marked available yields exactly that night when matched", () => {
    const blocks = daysToBlocks([d("2026-03-05")]);
    const nights = d(blocks[0].end) - d(blocks[0].start);
    expect(nights).toBe(1);
  });
});
