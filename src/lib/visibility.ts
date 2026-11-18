/**
 * What someone without an approved account may see of a listing.
 *
 * Agreed with Boris on 13 Nov 2026: anyone can browse the basics (what kind of
 * place, roughly where, how much, when). The full details (exact address,
 * description, all the photos, who's hosting) and the contact button are
 * for approved members. It keeps the board useful to look at from outside
 * while not handing hosts' addresses and names to anyone who opens a link.
 */

/** Pins move to a ~500 m grid: close enough to judge the area, not the building. */
const GRID = 0.005;

export function approximate(value: number): number {
  return Math.round(value / GRID) * GRID;
}

/**
 * Roughly where a listing is: its district and city, e.g. "Gràcia,
 * Barcelona". Addresses picked from suggestions are "street, district,
 * city"; older Berlin ones have no city at the end.
 */
export function areaOf(address: string, city: string): string {
  const parts = address.split(",").map((p) => p.trim()).filter(Boolean);
  // Drop the street, and anything that's just a postcode.
  const rest = parts.slice(1).filter((p) => !/^[\d\s-]+$/.test(p));
  if (!rest.some((p) => p.toLowerCase() === city.toLowerCase())) rest.push(city);
  return rest.slice(-2).join(", ");
}

/** A search result as shown to someone who isn't an approved member. */
export function basicsOnly<T extends { lat: number; lng: number; description: string | null }>(
  listing: T,
): T {
  return {
    ...listing,
    lat: approximate(listing.lat),
    lng: approximate(listing.lng),
    description: null,
  };
}
