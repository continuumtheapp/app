import type { Bbox } from "./geo";

/** Parse the `bbox` query parameter, "south,west,north,east". Client-safe. */
export function parseBbox(value: string | null | undefined): Bbox | null {
  if (!value) return null;
  const parts = value.split(",").map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null;
  const [south, west, north, east] = parts;
  if (south >= north || west >= east) return null;
  return { south, west, north, east };
}
