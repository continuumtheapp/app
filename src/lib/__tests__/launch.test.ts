import { describe, it, expect } from "vitest";
import { areaOf, approximate, basicsOnly } from "../visibility";
import { listingSchema } from "../validation";
import { ID_CHECK_KEY } from "../id-check";
import { escapeHtml } from "../bot";

describe("what people without an approved account see", () => {
  it("shows the district, not the street", () => {
    expect(areaOf("Weserstraße 10, Neukölln", "Berlin")).toBe("Neukölln, Berlin");
    expect(areaOf("Weserstraße 10, Neukölln, Berlin", "Berlin")).toBe("Neukölln, Berlin");
    expect(areaOf("Tempelhofer Feld, Columbiadamm, Tempelhof", "Berlin")).toBe("Tempelhof, Berlin");
    expect(areaOf("Carrer de Verdi 10, Gràcia, Barcelona", "Barcelona")).toBe("Gràcia, Barcelona");
  });

  it("never shows a bare street or a postcode as the area", () => {
    expect(areaOf("Weserstraße 10", "Berlin")).toBe("Berlin");
    expect(areaOf("Weserstraße 10, Neukölln, 12047", "Berlin")).toBe("Neukölln, Berlin");
    expect(areaOf("Rua Augusta 1, Lisbon", "Lisbon")).toBe("Lisbon");
  });

  it("moves pins to a ~500 m grid", () => {
    expect(approximate(52.4871)).toBeCloseTo(52.485, 6);
    expect(Math.abs(approximate(13.4312) - 13.4312)).toBeLessThanOrEqual(0.0025);
  });

  it("drops the description from search results", () => {
    const out = basicsOnly({ lat: 52.4871, lng: 13.4312, description: "Ring twice, 3rd floor", id: 1 });
    expect(out.description).toBeNull();
    expect(out.id).toBe(1);
  });
});

describe("posting a place", () => {
  const base = {
    title: "Room in Neukölln", address: "Weserstraße 10, Neukölln", lat: 52.48, lng: 13.43,
    priceNightCents: null, priceWeekCents: null, priceMonthCents: 60000,
    roomType: "shared", flatmateCount: 1, maxGuests: 1, flintaOnly: false, depositCents: 0,
    minNights: null, maxNights: null, blocks: [{ start: "2027-01-01", end: "2027-02-01" }],
    flexibleDays: [], photoKeys: [],
  };

  it("needs the Fair Rent Pledge", () => {
    expect(listingSchema.safeParse(base).success).toBe(false);
    expect(listingSchema.safeParse({ ...base, fairRentPledge: false }).success).toBe(false);
    expect(listingSchema.safeParse({ ...base, fairRentPledge: true }).success).toBe(true);
  });
});

describe("ID check uploads", () => {
  it("only accepts keys in the private id-checks folder", () => {
    expect(ID_CHECK_KEY.test("id-checks/123e4567-e89b-12d3-a456-426614174000.jpg")).toBe(true);
    expect(ID_CHECK_KEY.test("avatars/123e4567-e89b-12d3-a456-426614174000.jpg")).toBe(false);
    expect(ID_CHECK_KEY.test("id-checks/../avatars/x.jpg")).toBe(false);
  });
});

describe("bot posts", () => {
  it("escapes titles so they can't break the message's HTML", () => {
    expect(escapeHtml("Room <b>&</b> more")).toBe("Room &lt;b&gt;&amp;&lt;/b&gt; more");
  });
});

import { currencyFor, currencySymbol } from "../currency";

describe("local currency", () => {
  it("follows the country", () => {
    expect(currencyFor("DE")).toBe("EUR");
    expect(currencyFor("pt")).toBe("EUR");
    expect(currencyFor("GB")).toBe("GBP");
    expect(currencyFor("US")).toBe("USD");
    expect(currencyFor("CH")).toBe("CHF");
    expect(currencyFor(null)).toBe("EUR");
  });

  it("has a symbol for labels", () => {
    expect(currencySymbol("EUR")).toBe("€");
    expect(currencySymbol("GBP")).toBe("£");
    expect(currencySymbol("USD")).toBe("$");
    expect(currencySymbol("CHF")).toBe("CHF");
  });
});

import { reviewOpen } from "../stays";

describe("when a review can be written", () => {
  it("opens on the move-out day, or right away without one", () => {
    expect(reviewOpen({ endsOn: 100 }, 99)).toBe(false);
    expect(reviewOpen({ endsOn: 100 }, 100)).toBe(true);
    expect(reviewOpen({ endsOn: null }, 1)).toBe(true);
  });
});
