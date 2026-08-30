import { describe, it, expect } from "vitest";
import { toDayNumber, fromDayNumber, nightsBetween, todayInBerlin } from "../dates";
import {
  isExactMatch, scoreNearMiss, overlapNights, blockContains, hostAcceptsLength,
  compareNearMiss, explainShortfall, countFlexibleNights, stayNights,
  type HostTerms, type SearchCriteria,
} from "../matching";

const d = toDayNumber;

/** A host with sensible defaults; override what the test cares about. */
function host(over: Partial<HostTerms> = {}): HostTerms {
  return {
    blocks: [{ startDay: d("2026-03-01"), endDay: d("2026-04-01") }],
    minNights: null,
    maxNights: null,
    maxGuests: 4,
    pricePerNightCents: 5000,
    ...over,
  };
}

function search(checkIn: string, checkOut: string, over: Partial<SearchCriteria> = {}): SearchCriteria {
  return {
    stay: { checkIn: d(checkIn), checkOut: d(checkOut) },
    guests: 1,
    maxPricePerNightCents: null,
    ...over,
  };
}

/* ------------------------------------------------------------------ dates */

describe("dates", () => {
  it("round-trips ISO dates", () => {
    for (const iso of ["2026-01-01", "2026-03-03", "2026-12-31", "2024-02-29"]) {
      expect(fromDayNumber(toDayNumber(iso))).toBe(iso);
    }
  });

  it("counts nights as plain subtraction on a half-open interval", () => {
    // Mar 3 -> Mar 20: sleep the 3rd through the 19th, leave the 20th.
    expect(nightsBetween(d("2026-03-03"), d("2026-03-20"))).toBe(17);
    expect(nightsBetween(d("2026-03-03"), d("2026-03-04"))).toBe(1);
  });

  it("handles the DST boundary without shifting days", () => {
    // Europe/Berlin springs forward on 2026-03-29.
    expect(nightsBetween(d("2026-03-28"), d("2026-03-30"))).toBe(2);
    expect(fromDayNumber(d("2026-03-29"))).toBe("2026-03-29");
  });

  it("rejects malformed and impossible dates", () => {
    expect(() => d("2026-13-01")).toThrow();
    expect(() => d("2026-02-30")).toThrow();
    expect(() => d("03-03-2026")).toThrow();
  });

  it("returns a plausible day number for today in Berlin", () => {
    const today = todayInBerlin(new Date("2026-08-30T23:30:00Z"));
    // 23:30 UTC is already Aug 31 in Berlin (UTC+2 in summer).
    expect(fromDayNumber(today)).toBe("2026-08-31");
  });
});

/* ------------------------------------------------------------ exact match */

describe("exact match", () => {
  it("matches a stay exactly filling a block", () => {
    const h = host({ blocks: [{ startDay: d("2026-03-01"), endDay: d("2026-03-21") }] });
    expect(isExactMatch(h, search("2026-03-01", "2026-03-21"))).toBe(true);
  });

  it("matches a stay comfortably inside a block", () => {
    expect(isExactMatch(host(), search("2026-03-05", "2026-03-25"))).toBe(true);
  });

  it("rejects a stay one night longer than the block", () => {
    const h = host({ blocks: [{ startDay: d("2026-03-01"), endDay: d("2026-03-21") }] });
    expect(isExactMatch(h, search("2026-03-01", "2026-03-22"))).toBe(false);
  });

  it("rejects a stay starting one day before the block", () => {
    const h = host({ blocks: [{ startDay: d("2026-03-01"), endDay: d("2026-03-21") }] });
    expect(isExactMatch(h, search("2026-02-28", "2026-03-10"))).toBe(false);
  });

  it("does not match a block that ends exactly at check-in (zero nights)", () => {
    const h = host({ blocks: [{ startDay: d("2026-02-01"), endDay: d("2026-03-01") }] });
    const s = search("2026-03-01", "2026-03-10");
    expect(isExactMatch(h, s)).toBe(false);
    expect(overlapNights(h.blocks[0], s.stay)).toBe(0);
  });

  it("respects the host minimum stay", () => {
    const h = host({ minNights: 14 });
    expect(isExactMatch(h, search("2026-03-05", "2026-03-12"))).toBe(false); // 7 nights
    expect(isExactMatch(h, search("2026-03-05", "2026-03-20"))).toBe(true);  // 15 nights
  });

  it("respects the host maximum stay", () => {
    const h = host({ maxNights: 10 });
    expect(isExactMatch(h, search("2026-03-05", "2026-03-20"))).toBe(false); // 15
    expect(isExactMatch(h, search("2026-03-05", "2026-03-14"))).toBe(true);  // 9
  });

  it("treats null host bounds as unconstrained, with a floor of one night", () => {
    expect(hostAcceptsLength({ minNights: null, maxNights: null }, 1)).toBe(true);
    expect(hostAcceptsLength({ minNights: null, maxNights: null }, 365)).toBe(true);
    expect(hostAcceptsLength({ minNights: null, maxNights: null }, 0)).toBe(false);
  });

  it("matches via whichever block contains the stay, when several exist", () => {
    const h = host({
      blocks: [
        { startDay: d("2026-03-01"), endDay: d("2026-03-08") },
        { startDay: d("2026-03-15"), endDay: d("2026-04-05") },
        { startDay: d("2026-04-20"), endDay: d("2026-04-23") },
      ],
    });
    expect(isExactMatch(h, search("2026-03-16", "2026-04-01"))).toBe(true);
    // Falls in the gap between blocks.
    expect(isExactMatch(h, search("2026-03-09", "2026-03-14"))).toBe(false);
  });

  it("does not match a stay spanning two adjacent-but-separate blocks", () => {
    // Why mergeBlocks() must run on write: unmerged neighbours break containment.
    const h = host({
      blocks: [
        { startDay: d("2026-03-01"), endDay: d("2026-03-15") },
        { startDay: d("2026-03-15"), endDay: d("2026-04-01") },
      ],
    });
    expect(isExactMatch(h, search("2026-03-10", "2026-03-20"))).toBe(false);
  });

  it("enforces capacity and budget", () => {
    expect(isExactMatch(host({ maxGuests: 2 }), search("2026-03-05", "2026-03-10", { guests: 3 }))).toBe(false);
    expect(isExactMatch(host({ pricePerNightCents: 8000 }),
      search("2026-03-05", "2026-03-10", { maxPricePerNightCents: 5000 }))).toBe(false);
    expect(isExactMatch(host({ pricePerNightCents: 5000 }),
      search("2026-03-05", "2026-03-10", { maxPricePerNightCents: 5000 }))).toBe(true);
  });

  it("rejects a zero-night stay", () => {
    expect(isExactMatch(host(), search("2026-03-05", "2026-03-05"))).toBe(false);
  });
});

/* ------------------------------------------------------------- near misses */

describe("near misses", () => {
  it("reports a partial overlap with the right night count", () => {
    // Wants 20 nights from Mar 1; host free only Mar 1-13 => 12 available.
    const h = host({ blocks: [{ startDay: d("2026-03-01"), endDay: d("2026-03-13") }] });
    const near = scoreNearMiss(h, search("2026-03-01", "2026-03-21"))!;
    expect(near).not.toBeNull();
    const s = near.shortfalls[0];
    expect(s.kind).toBe("partialAvailability");
    if (s.kind === "partialAvailability") {
      expect(s.availableNights).toBe(12);
      expect(s.wantedNights).toBe(20);
    }
    expect(explainShortfall(s)).toContain("Free 12 of your 20 nights");
  });

  it("reports availability starting after the requested dates", () => {
    const h = host({ blocks: [{ startDay: d("2026-03-08"), endDay: d("2026-03-30") }] });
    const near = scoreNearMiss(h, search("2026-03-01", "2026-03-06"))!;
    const s = near.shortfalls.find((x) => x.kind === "startsLate")!;
    if (s.kind === "startsLate") expect(s.daysLate).toBe(7);
    expect(explainShortfall(s)).toContain("after you wanted");
  });

  it("reports availability ending before the requested dates", () => {
    const h = host({ blocks: [{ startDay: d("2026-02-01"), endDay: d("2026-03-05") }] });
    const near = scoreNearMiss(h, search("2026-03-10", "2026-03-20"))!;
    const s = near.shortfalls.find((x) => x.kind === "endsEarly")!;
    expect(s.kind).toBe("endsEarly");
  });

  it("reports a host minimum stay that is too long", () => {
    const near = scoreNearMiss(host({ minNights: 30 }), search("2026-03-05", "2026-03-25"))!;
    const s = near.shortfalls[0];
    expect(s.kind).toBe("hostMinStay");
    expect(explainShortfall(s)).toBe("Host wants 30+ nights, you want 20");
  });

  it("reports a host maximum stay that is too short", () => {
    const near = scoreNearMiss(host({ maxNights: 14 }), search("2026-03-05", "2026-03-25"))!;
    const s = near.shortfalls[0];
    expect(s.kind).toBe("hostMaxStay");
    expect(explainShortfall(s)).toBe("Host hosts max 14 nights, you want 20");
  });

  it("reports being over budget in euros", () => {
    const near = scoreNearMiss(host({ pricePerNightCents: 10000 }),
      search("2026-03-05", "2026-03-10", { maxPricePerNightCents: 5000 }))!;
    const s = near.shortfalls.find((x) => x.kind === "overBudget")!;
    expect(explainShortfall(s)).toBe("€50/night over your budget");
  });

  it("reports being too small", () => {
    const near = scoreNearMiss(host({ maxGuests: 2 }),
      search("2026-03-05", "2026-03-10", { guests: 3 }))!;
    const s = near.shortfalls.find((x) => x.kind === "tooSmall")!;
    expect(explainShortfall(s)).toBe("Sleeps 2, you need 3");
  });

  it("discards a listing failing on more than two dimensions as noise", () => {
    const h = host({
      blocks: [{ startDay: d("2026-03-01"), endDay: d("2026-03-10") }],
      minNights: 30,
      maxGuests: 1,
      pricePerNightCents: 20000,
    });
    expect(scoreNearMiss(h, search("2026-03-01", "2026-03-21",
      { guests: 4, maxPricePerNightCents: 5000 }))).toBeNull();
  });

  it("discards a listing whose score exceeds the cutoff", () => {
    // Free only 1 of 60 requested nights: technically a miss, practically noise.
    const h = host({ blocks: [{ startDay: d("2026-03-01"), endDay: d("2026-03-02") }] });
    expect(scoreNearMiss(h, search("2026-03-01", "2026-04-30"))).toBeNull();
  });

  it("returns null when nothing is actually wrong", () => {
    expect(scoreNearMiss(host(), search("2026-03-05", "2026-03-15"))).toBeNull();
  });

  it("scores a smaller shortfall as better than a larger one", () => {
    const close = scoreNearMiss(
      host({ blocks: [{ startDay: d("2026-03-01"), endDay: d("2026-03-19") }] }),
      search("2026-03-01", "2026-03-21"))!;
    const far = scoreNearMiss(
      host({ blocks: [{ startDay: d("2026-03-01"), endDay: d("2026-03-11") }] }),
      search("2026-03-01", "2026-03-21"))!;
    expect(close.score).toBeLessThan(far.score);
  });

  it("picks the block with the greatest overlap when several are near", () => {
    const h = host({
      blocks: [
        { startDay: d("2026-03-01"), endDay: d("2026-03-04") }, // 3 nights of overlap
        { startDay: d("2026-03-06"), endDay: d("2026-03-18") }, // 12 nights
      ],
    });
    const near = scoreNearMiss(h, search("2026-03-01", "2026-03-21"))!;
    const s = near.shortfalls[0];
    if (s.kind === "partialAvailability") expect(s.availableNights).toBe(12);
    else throw new Error("expected a partialAvailability shortfall");
  });

  it("orders results deterministically regardless of input order", () => {
    const rows = [3, 1, 2, 5, 4].map((id) => ({
      id,
      pricePerNightCents: 5000,
      near: scoreNearMiss(
        host({ blocks: [{ startDay: d("2026-03-01"), endDay: d("2026-03-13") }] }),
        search("2026-03-01", "2026-03-21"))!,
    }));
    const once = [...rows].sort(compareNearMiss).map((r) => r.id);
    const twice = [...rows].reverse().sort(compareNearMiss).map((r) => r.id);
    expect(once).toEqual([1, 2, 3, 4, 5]); // identical scores => id breaks the tie
    expect(twice).toEqual(once);
  });
});

/* ---------------------------------------------------------- flexible days */

describe("flexible days", () => {
  it("does not affect matching — a stay entirely on flexible days still matches", () => {
    const h = host({ blocks: [{ startDay: d("2026-03-01"), endDay: d("2026-03-31") }] });
    expect(isExactMatch(h, search("2026-03-10", "2026-03-15"))).toBe(true);
  });

  it("counts how many nights of a stay are marked flexible", () => {
    const flexible = ["2026-03-11", "2026-03-12", "2026-03-20"].map(d);
    const stay = { checkIn: d("2026-03-10"), checkOut: d("2026-03-15") };
    expect(countFlexibleNights(flexible, stay)).toBe(2);
  });

  it("ignores a flexible day falling on the checkout date", () => {
    // Checkout day is not a night stayed.
    const stay = { checkIn: d("2026-03-10"), checkOut: d("2026-03-15") };
    expect(countFlexibleNights([d("2026-03-15")], stay)).toBe(0);
  });
});

/* ------------------------------------------------------------- properties */

describe("properties", () => {
  it("an exact match is never also a near miss", () => {
    for (let start = 1; start <= 20; start++) {
      for (let len = 1; len <= 15; len++) {
        const h = host({ minNights: 3, maxNights: 20 });
        const s: SearchCriteria = {
          stay: { checkIn: d("2026-03-01") + start, checkOut: d("2026-03-01") + start + len },
          guests: 1,
          maxPricePerNightCents: null,
        };
        if (isExactMatch(h, s)) expect(scoreNearMiss(h, s)).toBeNull();
      }
    }
  });

  it("overlap never exceeds the stay length or the block length", () => {
    for (let bs = 0; bs < 12; bs++) {
      for (let be = bs + 1; be < 20; be++) {
        const block = { startDay: bs, endDay: be };
        const stay = { checkIn: 5, checkOut: 15 };
        const ov = overlapNights(block, stay);
        expect(ov).toBeLessThanOrEqual(stayNights(stay));
        expect(ov).toBeLessThanOrEqual(be - bs);
        if (blockContains(block, stay)) expect(ov).toBe(stayNights(stay));
      }
    }
  });
});
