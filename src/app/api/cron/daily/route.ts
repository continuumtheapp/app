import { expireStaleListings } from "@/lib/listings";
import { syncListingPost } from "@/lib/bot";

/**
 * Once a day (vercel.json): archive places whose dates have all passed, and
 * take their posts out of the group. Vercel sends CRON_SECRET as a bearer
 * token; anyone else gets a 401.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const expired = await expireStaleListings();
  for (const id of expired) await syncListingPost(id);
  return Response.json({ expired: expired.length });
}
