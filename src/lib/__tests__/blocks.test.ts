import { describe, it, expect } from "vitest";
import { mergeBlocks, pruneFlexibleDays, totalNights, lastAvailableDay } from "../blocks";
import { toDayNumber as d } from "../dates";

const b = (s: string, e: string) => ({ startDay: d(s), endDay: d(e) });
const show = (blocks: { startDay: number; endDay: number }[]) =>
  blocks.map((x) => [x.startDay, x.endDay]);

describe("mergeBlocks", () => {
  it("leaves disjoint blocks alone", () => {
    const input = [b("2026-03-01", "2026-03-10"), b("2026-03-20", "2026-03-25")];
    expect(show(mergeBlocks(input))).toEqual(show(input));
  });

  it("merges touching blocks — the case that would otherwise break matching", () => {
    const merged = mergeBlocks([b("2026-03-01", "2026-03-15"), b("2026-03-15", "2026-04-01")]);
    expect(show(merged)).toEqual(show([b("2026-03-01", "2026-04-01")]));
  });

  it("merges overlapping blocks", () => {
    const merged = mergeBlocks([b("2026-03-01", "2026-03-20"), b("2026-03-10", "2026-04-01")]);
    expect(show(merged)).toEqual(show([b("2026-03-01", "2026-04-01")]));
  });

  it("merges a chain of blocks into one", () => {
    const merged = mergeBlocks([
      b("2026-03-01", "2026-03-10"), b("2026-03-08", "2026-03-15"),
      b("2026-03-15", "2026-03-20"), b("2026-03-19", "2026-03-25"),
    ]);
    expect(show(merged)).toEqual(show([b("2026-03-01", "2026-03-25")]));
  });

  it("swallows a block fully contained in another", () => {
    const merged = mergeBlocks([b("2026-03-01", "2026-04-01"), b("2026-03-10", "2026-03-12")]);
    expect(show(merged)).toEqual(show([b("2026-03-01", "2026-04-01")]));
  });

  it("is order-independent", () => {
    const forward = mergeBlocks([b("2026-03-01", "2026-03-10"), b("2026-03-10", "2026-03-20")]);
    const backward = mergeBlocks([b("2026-03-10", "2026-03-20"), b("2026-03-01", "2026-03-10")]);
    expect(show(forward)).toEqual(show(backward));
  });

  it("drops zero-length and inverted blocks", () => {
    expect(mergeBlocks([{ startDay: 10, endDay: 10 }, { startDay: 20, endDay: 15 }])).toEqual([]);
  });

  it("does not mutate its input", () => {
    const input = [b("2026-03-01", "2026-03-15"), b("2026-03-15", "2026-04-01")];
    const snapshot = show(input);
    mergeBlocks(input);
    expect(show(input)).toEqual(snapshot);
  });

  it("is idempotent", () => {
    const once = mergeBlocks([b("2026-03-01", "2026-03-15"), b("2026-03-14", "2026-04-01")]);
    expect(show(mergeBlocks(once))).toEqual(show(once));
  });
});

describe("pruneFlexibleDays", () => {
  it("keeps days inside a block and drops the rest", () => {
    const blocks = [b("2026-03-01", "2026-03-10")];
    const days = ["2026-02-28", "2026-03-01", "2026-03-05", "2026-03-15"].map(d);
    expect(pruneFlexibleDays(days, blocks)).toEqual([d("2026-03-01"), d("2026-03-05")]);
  });

  it("drops the block's end day, which is a checkout date not a night", () => {
    expect(pruneFlexibleDays([d("2026-03-10")], [b("2026-03-01", "2026-03-10")])).toEqual([]);
  });

  it("drops everything when all blocks are gone", () => {
    expect(pruneFlexibleDays([d("2026-03-05")], [])).toEqual([]);
  });
});

describe("summaries", () => {
  it("totals nights across blocks", () => {
    expect(totalNights([b("2026-03-01", "2026-03-11"), b("2026-03-20", "2026-03-25")])).toBe(15);
  });

  it("finds the last available day, or null when there is none", () => {
    expect(lastAvailableDay([b("2026-03-01", "2026-03-11"), b("2026-03-20", "2026-03-25")]))
      .toBe(d("2026-03-25"));
    expect(lastAvailableDay([])).toBeNull();
  });
});
