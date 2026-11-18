/**
 * Geocoding: address suggestions while a host types, city suggestions for
 * searches, and a check of the address when a listing is saved. Worldwide.
 *
 * Uses Photon (photon.komoot.io), built on OpenStreetMap data and meant for
 * search-as-you-type. Nominatim, used before, forbids autocomplete in its
 * usage policy and started refusing our requests. Photon asks for fair use:
 * the forms debounce, and requests go through our server.
 */

/** Where the map opens when there's nothing else to show: most of the board is Berlin. */
export const DEFAULT_CENTER = { lat: 52.52, lng: 13.405 } as const;

export interface Bbox { south: number; west: number; north: number; east: number }

export interface GeocodeResult {
  lat: number;
  lng: number;
  displayName: string;
  city: string;
  /** ISO 3166-1 alpha-2, e.g. "DE". */
  country: string;
}

export interface AddressSuggestion {
  /** What the host sees and what gets stored as the listing's address. */
  label: string;
  lat: number;
  lng: number;
  city: string;
  country: string;
}

/** A city to search in. */
export interface PlaceSuggestion {
  /** "Lisbon", what's stored and shown. */
  name: string;
  /** "Lisbon, Portugal", to tell apart places with the same name. */
  label: string;
  country: string;
  lat: number;
  lng: number;
  bbox: Bbox;
}

const PHOTON = "https://photon.komoot.io/api/";
const USER_AGENT = "SimbaCasa/1.0 (+https://simbacasa.vercel.app)";

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: {
    name?: string; street?: string; housenumber?: string;
    district?: string; locality?: string; city?: string; postcode?: string;
    state?: string; country?: string; countrycode?: string;
    osm_key?: string; osm_value?: string;
    /** [west, north, east, south] */
    extent?: [number, number, number, number];
  };
}

/** Photon features, or null if the service couldn't be reached. */
async function photon(params: Record<string, string>): Promise<PhotonFeature[] | null> {
  const url = new URL(PHOTON);
  // English names where OpenStreetMap has them: "Lisbon", not "Lisboa".
  url.searchParams.set("lang", "en");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    return null;
  }
  if (!response.ok) return null;
  const body = (await response.json()) as { features?: PhotonFeature[] };
  return body.features ?? [];
}

/** The city an address is in. Small places have no city, only a name. */
function cityOf(p: PhotonFeature["properties"]): string | null {
  return p.city ?? (p.osm_key === "place" ? p.name : null) ?? p.locality ?? p.state ?? null;
}

async function addressSearch(query: string, limit: number): Promise<AddressSuggestion[] | null> {
  // Ask for extra: results without a usable street or city get dropped.
  const features = await photon({ q: query, limit: String(limit * 2) });
  if (features === null) return null;
  const seen = new Set<string>();
  const out: AddressSuggestion[] = [];
  for (const f of features) {
    const [lng, lat] = f.geometry?.coordinates ?? [];
    const city = cityOf(f.properties);
    const country = f.properties.countrycode?.toUpperCase();
    if (lat === undefined || !city || !country) continue;
    // A whole city or country isn't an address.
    if (f.properties.osm_key === "place" && ["city", "town", "country", "state"].includes(f.properties.osm_value ?? "")) continue;
    const label = photonLabel(f.properties, city);
    if (!label || seen.has(label)) continue;
    seen.add(label);
    out.push({ label, lat, lng, city, country });
    if (out.length === limit) break;
  }
  return out;
}

/**
 * "Weserstraße 10, Neukölln, Berlin": street, district and city, so the
 * address makes sense to someone in another country too.
 */
export function photonLabel(p: PhotonFeature["properties"], city: string): string | null {
  const area = p.district ?? p.locality;
  const street = p.street
    ? [p.street, p.housenumber].filter(Boolean).join(" ")
    : p.osm_key === "highway" ? p.name : null;
  const place = street ?? p.name;
  if (!place) return null;
  // A named place (a park, a station) also gets its street, if known.
  const parts = street && p.name && p.osm_key !== "highway" && p.osm_key !== "place" && p.osm_key !== "building"
    ? [p.name, street, area, city] : [place, area, city];
  const unique = parts.filter((x, i): x is string => Boolean(x) && parts.indexOf(x) === i);
  return unique.join(", ");
}

/**
 * Address suggestions for the listing form.
 *
 * Picking a suggestion fixes the exact coordinates, so we never have to guess
 * from free text at save time — which is where wrong pins come from.
 */
export async function suggestAddresses(query: string, limit = 6): Promise<AddressSuggestion[]> {
  if (query.trim().length < 3) return [];
  return (await addressSearch(query, limit)) ?? [];
}

/** A box around a point, for places OpenStreetMap gives no outline for. */
export function boxAround(lat: number, lng: number, km = 15): Bbox {
  const dLat = km / 111;
  const dLng = km / (111 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
  return { south: lat - dLat, north: lat + dLat, west: lng - dLng, east: lng + dLng };
}

/** City suggestions for the search and request forms. */
export async function suggestPlaces(query: string, limit = 6): Promise<PlaceSuggestion[]> {
  if (query.trim().length < 2) return [];
  const features = await photon({ q: query, limit: String(limit), layer: "city" });
  const out: PlaceSuggestion[] = [];
  const seen = new Set<string>();
  for (const f of features ?? []) {
    const [lng, lat] = f.geometry?.coordinates ?? [];
    const name = f.properties.name;
    const country = f.properties.countrycode?.toUpperCase();
    if (lat === undefined || !name || !country) continue;
    const label = [name, f.properties.country].filter(Boolean).join(", ");
    if (seen.has(label)) continue;
    seen.add(label);
    const e = f.properties.extent;
    const bbox = e ? { west: e[0], north: e[1], east: e[2], south: e[3] } : boxAround(lat, lng);
    out.push({ name, label, country, lat, lng, bbox });
  }
  return out;
}

export type GeocodeOutcome =
  | { ok: true; result: GeocodeResult }
  | { ok: false; reason: "not_found" | "unavailable"; message: string };

/**
 * Resolve a free-text address to coordinates. Used on save: a picked
 * suggestion's label finds itself again.
 */
export async function geocodeAddress(address: string): Promise<GeocodeOutcome> {
  const hits = await addressSearch(address, 1);
  if (hits === null) {
    return { ok: false, reason: "unavailable", message: "Could not reach the address lookup service. Please try again." };
  }
  if (hits.length === 0) {
    return { ok: false, reason: "not_found", message: "We couldn't find that address. Try adding the street number and city, or pick a suggestion." };
  }
  const { lat, lng, label, city, country } = hits[0];
  return { ok: true, result: { lat, lng, displayName: label, city, country } };
}
