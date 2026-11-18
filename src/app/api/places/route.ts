import { suggestPlaces } from "@/lib/geo";

/**
 * City suggestions for the search form. Open to everyone, since anyone can
 * search; proxied through our server so the geocoding service sees one
 * client, and cached because people type the same few cities.
 */
export async function GET(request: Request) {
  const query = (new URL(request.url).searchParams.get("q") ?? "").trim().slice(0, 80);
  if (query.length < 2) return Response.json({ places: [] });
  const places = await suggestPlaces(query);
  return Response.json({ places }, {
    headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" },
  });
}
