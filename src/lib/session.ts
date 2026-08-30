/**
 * Session helpers for server components and route handlers.
 *
 * Sessions are validated HERE, never in middleware: on Workers, middleware
 * runs before the D1 binding is usable for this kind of work, so middleware
 * does a cheap cookie-presence check only and every real authorisation
 * decision happens in the route.
 */
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { getAuth } from "./auth";
import { getDb } from "@/db";
import { users, type User } from "@/db/schema";

/** The signed-in user, or null. */
export async function currentUser(): Promise<User | null> {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session?.user?.id) return null;

  const rows = await getDb().select().from(users).where(eq(users.id, session.user.id)).limit(1);
  return rows[0] ?? null;
}

/** The signed-in user, or throw. Use in routes that must not be reached anonymously. */
export async function requireUser(): Promise<User> {
  const user = await currentUser();
  if (!user) throw new UnauthorizedError();
  if (user.isBanned) throw new BannedError();
  return user;
}

/**
 * A user who may post or reveal contacts: signed in, not banned, and has given
 * a Telegram or WhatsApp handle. The handle is mandatory because the whole
 * platform hands off to chat — a listing nobody can respond to is worthless.
 */
export async function requireContactableUser(): Promise<User> {
  const user = await requireUser();
  if (!user.contactMethod || !user.contactHandle) throw new ContactRequiredError();
  return user;
}

export async function requireAdmin(): Promise<User> {
  const user = await requireUser();
  if (!user.isAdmin) throw new ForbiddenError();
  return user;
}

export class UnauthorizedError extends Error {
  constructor() { super("You need to sign in to do that."); }
}
export class BannedError extends Error {
  constructor() { super("This account has been suspended."); }
}
export class ContactRequiredError extends Error {
  constructor() { super("Add a Telegram or WhatsApp handle first, so people can reach you."); }
}
export class ForbiddenError extends Error {
  constructor() { super("You don't have access to that."); }
}

/** Map a thrown auth error to an HTTP response. */
export function authErrorResponse(error: unknown): Response | null {
  if (error instanceof UnauthorizedError) return json(401, error.message);
  if (error instanceof BannedError) return json(403, error.message);
  if (error instanceof ContactRequiredError) return json(403, error.message, { needsContact: true });
  if (error instanceof ForbiddenError) return json(403, error.message);
  return null;
}

function json(status: number, error: string, extra: Record<string, unknown> = {}) {
  return Response.json({ error, ...extra }, { status });
}
