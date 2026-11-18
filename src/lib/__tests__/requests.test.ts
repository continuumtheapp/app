import { describe, it, expect } from "vitest";
import { effectiveStatus, budgetPerNightCents, requestToSearch, type HousingRequest } from "../requests";
import { toDayNumber } from "../dates";

const d = toDayNumber;

const request = (over: Partial<HousingRequest> = {}): HousingRequest => ({
  id: 1, seekerId: "u", city: "Berlin", country: "DE", currency: "EUR", note: null, cityLat: 52.52, cityLng: 13.405, areas: [],
  checkIn: d("2026-03-01"), checkOut: d("2026-03-15"), datesFlexible: false,
  roomType: "either", guests: 2, withChildren: false, withPets: false,
  maxBudgetCents: null, budgetPeriod: null, needsAnmeldung: false, flintaOnly: false,
  status: "open", telegramMessageId: null, createdAt: 0, updatedAt: 0,
  ...over,
});

describe("effective status", () => {
  it("stays open while any night of the stay is still ahead", () => {
    expect(effectiveStatus(request(), d("2026-03-14"))).toBe("open");
  });

  it("expires on its own on the check-out day", () => {
    // Half-open: the 15th is check-out, so nothing of the stay is left.
    expect(effectiveStatus(request(), d("2026-03-15"))).toBe("expired");
  });

  it("keeps a status the seeker chose, even after the dates pass", () => {
    expect(effectiveStatus(request({ status: "found" }), d("2026-04-01"))).toBe("found");
    expect(effectiveStatus(request({ status: "closed" }), d("2026-04-01"))).toBe("closed");
  });
});

describe("budget per night", () => {
  it("normalises each period the way listing prices are", () => {
    expect(budgetPerNightCents(5000, "night")).toBe(5000);
    expect(budgetPerNightCents(35000, "week")).toBe(5000);
    expect(budgetPerNightCents(90000, "month")).toBe(3000);
  });

  it("means no budget when either half is missing", () => {
    expect(budgetPerNightCents(null, "month")).toBeNull();
    expect(budgetPerNightCents(90000, null)).toBeNull();
  });
});

describe("request to search", () => {
  it("searches any type of place when the seeker takes either", () => {
    expect(requestToSearch(request()).roomType).toBeNull();
    expect(requestToSearch(request({ roomType: "shared" })).roomType).toBe("shared");
  });

  it("turns hard needs into hard filters", () => {
    const s = requestToSearch(request({ needsAnmeldung: true, withPets: true, flintaOnly: true }));
    expect(s).toMatchObject({ anmeldung: true, pets: true, flintaOnly: true });
  });

  it("looks around the city it's for", () => {
    const s = requestToSearch(request({ city: "Lisbon", country: "PT", cityLat: 38.72, cityLng: -9.14 }));
    expect(s.near).toEqual({ lat: 38.72, lng: -9.14, radiusM: 25_000 });
  });

  it("carries the stay, people and budget across", () => {
    const s = requestToSearch(request({ maxBudgetCents: 90000, budgetPeriod: "month" }));
    expect(s).toMatchObject({
      checkIn: d("2026-03-01"), checkOut: d("2026-03-15"), guests: 2,
      maxPricePerNightCents: 3000,
    });
  });
});
