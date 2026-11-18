import { describe, it, expect } from "vitest";
import {
  cheapestPerNightCents, quoteForStay, quotedRates,
  formatRate, formatMoney, formatAllRates, type Prices,
} from "../pricing";

const p = (night: number | null, week: number | null, month: number | null): Prices => ({
  priceNightCents: night, priceWeekCents: week, priceMonthCents: month,
});

describe("quoted rates", () => {
  it("lists only the periods the host filled in", () => {
    expect(quotedRates(p(4000, null, null))).toEqual([["night", 4000]]);
    expect(quotedRates(p(4000, 25000, 80000))).toHaveLength(3);
  });
});

describe("cheapest per night", () => {
  it("normalises a weekly rate", () => {
    expect(cheapestPerNightCents(p(null, 70000, null))).toBe(10000);
  });

  it("normalises a monthly rate", () => {
    expect(cheapestPerNightCents(p(null, null, 90000))).toBe(3000);
  });

  it("picks the cheapest when several are quoted", () => {
    // €50/night, €280/week (=€40/night), €900/month (=€30/night)
    expect(cheapestPerNightCents(p(5000, 28000, 90000))).toBe(3000);
  });

  it("makes differently-quoted listings comparable", () => {
    expect(cheapestPerNightCents(p(5000, null, null))).toBe(5000);
    expect(cheapestPerNightCents(p(null, 35000, null))).toBe(5000);
    expect(cheapestPerNightCents(p(null, null, 150000))).toBe(5000);
  });
});

describe("quote for a stay", () => {
  it("uses the nightly rate for a short stay", () => {
    const q = quoteForStay(p(4000, 25000, 80000), 3)!;
    expect(q.period).toBe("night");
    expect(q.totalCents).toBe(12000);
  });

  it("switches to weekly once that is cheaper", () => {
    // 7 nights: €280 nightly vs €250 for the week.
    const q = quoteForStay(p(4000, 25000, 80000), 7)!;
    expect(q.period).toBe("week");
    expect(q.totalCents).toBe(25000);
  });

  it("switches to monthly for a long stay", () => {
    // 30 nights: €1200 nightly, €1250 weekly (5 weeks), €800 for the month.
    const q = quoteForStay(p(4000, 25000, 80000), 30)!;
    expect(q.period).toBe("month");
    expect(q.totalCents).toBe(80000);
  });

  it("charges whole periods, rounding up", () => {
    // 9 nights on a weekly-only rate is two weeks, as hosts actually bill.
    const q = quoteForStay(p(null, 25000, null), 9)!;
    expect(q.totalCents).toBe(50000);
    expect(q.perNightCents).toBe(Math.round(50000 / 9));
  });

  it("works when only one rate is quoted", () => {
    const q = quoteForStay(p(null, null, 90000), 45)!;
    expect(q.period).toBe("month");
    expect(q.totalCents).toBe(180000); // two months
  });

  it("reports the per-night cost of the chosen option", () => {
    const q = quoteForStay(p(null, null, 90000), 30)!;
    expect(q.perNightCents).toBe(3000);
  });

  it("returns null for a zero-night stay", () => {
    expect(quoteForStay(p(4000, null, null), 0)).toBeNull();
  });

  it("never quotes more than paying nightly, when a nightly rate exists", () => {
    const prices = p(4000, 25000, 80000);
    for (let nights = 1; nights <= 60; nights++) {
      const q = quoteForStay(prices, nights)!;
      expect(q.totalCents).toBeLessThanOrEqual(4000 * nights);
    }
  });
});

describe("formatting", () => {
  // Intl formats currency with a narrow no-break space (U+202F), so compare
  // against text with every kind of space normalised to a plain one.
  const plain = (s: string) => s.replace(/\s/g, " ");

  it("formats a rate with its period", () => {
    expect(plain(formatRate(35000, "week", "EUR"))).toBe("€350 / week");
  });

  it("formats money in the local currency, without stray decimals", () => {
    expect(plain(formatMoney(5000, "EUR"))).toBe("€50");
    expect(plain(formatMoney(5000, "GBP"))).toBe("£50");
    expect(plain(formatMoney(5000, "USD"))).toBe("$50");
    expect(plain(formatMoney(5000, "CHF"))).toBe("CHF 50");
  });

  it("lists every quoted rate", () => {
    expect(plain(formatAllRates(p(4000, 25000, null), "GBP")))
      .toBe("£40 / night · £250 / week");
  });
});
