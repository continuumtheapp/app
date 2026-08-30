import { describe, it, expect } from "vitest";
import { toPricePerNightCents, estimateStayCostCents, formatPrice, formatEuros } from "../pricing";

describe("price normalisation", () => {
  it("leaves a nightly price untouched", () => {
    expect(toPricePerNightCents(5000, "night")).toBe(5000);
  });

  it("divides a weekly price by seven", () => {
    expect(toPricePerNightCents(70000, "week")).toBe(10000);
  });

  it("divides a monthly price by thirty", () => {
    expect(toPricePerNightCents(90000, "month")).toBe(3000);
  });

  it("rounds to whole cents", () => {
    expect(toPricePerNightCents(10000, "week")).toBe(1429); // 100/7 = 14.2857
  });

  it("makes differently-quoted listings comparable", () => {
    // €50/night, €350/week and €1500/month, ranked by true nightly cost.
    const nightly = toPricePerNightCents(5000, "night");
    const weekly = toPricePerNightCents(35000, "week");
    const monthly = toPricePerNightCents(150000, "month");
    expect(nightly).toBe(5000);
    expect(weekly).toBe(5000);
    expect(monthly).toBe(5000);
  });

  it("estimates a stay total", () => {
    expect(estimateStayCostCents(5000, 20)).toBe(100000);
  });
});

describe("formatting", () => {
  it("formats euros without stray decimals", () => {
    expect(formatEuros(5000).replace(/ /g, " ")).toBe("50 €");
  });

  it("formats a price with its period", () => {
    expect(formatPrice(35000, "week").replace(/ /g, " ")).toBe("350 € / week");
  });
});
