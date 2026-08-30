/**
 * Geocoding, called ONCE when a listing is saved — never on page view.
 *
 * That keeps us to a handful of requests a day, comfortably inside
 * Nominatim's usage policy (max 1 req/sec, identifying User-Agent required,
 * results must be cached rather than re-fetched).
 */

/** Berlin's bounding box. Listings outside it are rejected: this is a Berlin board. */
export const BERLIN_BBOX = {
  south: 52.338,
  north: 52.675,
  west: 13.088,
  east: 13.761,
} as const;

/** Roughly the city centre; the map opens here before any results load. */
export const BERLIN_CENTER = { lat: 52.52, lng: 13.405 } as const;

export function isInBerlin(lat: number, lng: number): boolean {
  return (
    lat >= BERLIN_BBOX.south && lat <= BERLIN_BBOX.north &&
    lng >= BERLIN_BBOX.west && lng <= BERLIN_BBOX.east
  );
}

export interface GeocodeResult {
  lat: number;
  lng: number;
  displayName: string;
}

export type GeocodeOutcome =
  | { ok: true; result: GeocodeResult }
  | { ok: false; reason: "not_found" | "outside_berlin" | "unavailable"; message: string };

const NOMINATIM = "https://nominatim.openstreetmap.org/search";

/**
 * Resolve a free-text address to coordinates, constrained to Berlin.
 *
 * `contactEmail` goes into the User-Agent: Nominatim's policy requires an
 * identifying agent and rejects stock HTTP-library defaults.
 */
export async function geocodeBerlinAddress(
  address: string,
  contactEmail: string,
): Promise<GeocodeOutcome> {
  const query = /berlin/i.test(address) ? address : `${address}, Berlin, Germany`;

  const url = new URL(NOMINATIM);
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "de");
  // Bias results to Berlin; still verified against the bbox below.
  url.searchParams.set(
    "viewbox",
    `${BERLIN_BBOX.west},${BERLIN_BBOX.north},${BERLIN_BBOX.east},${BERLIN_BBOX.south}`,
  );
  url.searchParams.set("bounded", "1");

  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        "User-Agent": `BerlinHousingBoard/1.0 (${contactEmail})`,
        "Accept-Language": "de,en",
      },
    });
  } catch {
    return { ok: false, reason: "unavailable", message: "Could not reach the address lookup service. Please try again." };
  }

  if (!response.ok) {
    return { ok: false, reason: "unavailable", message: "The address lookup service is busy. Please try again in a moment." };
  }

  const hits = (await response.json()) as { lat: string; lon: string; display_name: string }[];
  if (!Array.isArray(hits) || hits.length === 0) {
    return { ok: false, reason: "not_found", message: "We couldn't find that address. Try adding a street number or a nearby cross street." };
  }

  const lat = Number(hits[0].lat);
  const lng = Number(hits[0].lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { ok: false, reason: "not_found", message: "We couldn't read that address. Please try a different form of it." };
  }
  if (!isInBerlin(lat, lng)) {
    return { ok: false, reason: "outside_berlin", message: "That address is outside Berlin. This board only covers Berlin for now." };
  }

  return { ok: true, result: { lat, lng, displayName: hits[0].display_name } };
}
