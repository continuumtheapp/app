import { suggestAddresses } from "@/lib/geo";
import { requireUser, authErrorResponse } from "@/lib/session";

/**
 * Address suggestions for the listing form.
 *
 * Proxied through our server rather than called from the browser, so the
 * request rate stays under our control and the service sees one identified
 * client rather than every visitor.
 *
 * Sign-in required so the endpoint cannot be used as an open geocoding proxy.
 */
export async function GET(request: Request) {
  try {
    await requireUser();

    const query = new URL(request.url).searchParams.get("q") ?? "";
    if (query.trim().length < 3) return Response.json({ suggestions: [] });

    const suggestions = await suggestAddresses(query);
    return Response.json({ suggestions });
  } catch (error) {
    return authErrorResponse(error) ?? Response.json({ suggestions: [] });
  }
}
