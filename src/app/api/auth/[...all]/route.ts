import { getAuth } from "@/lib/auth";

/** better-auth mounts all of its endpoints under /api/auth/*. */
async function handler(request: Request): Promise<Response> {
  return getAuth().handler(request);
}

export { handler as GET, handler as POST };
