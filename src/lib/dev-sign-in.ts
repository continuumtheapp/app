/**
 * Sign-in as one of the seed members, for testing.
 *
 * Telegram is the only real way in, and Telegram can't redirect back to
 * localhost — so without this, nothing behind sign-in could be tried before
 * the bot exists. It is deliberately narrow:
 *  - under `next dev` it just works;
 *  - on Vercel it exists only while TEST_SIGN_IN_CODE is set (during the test
 *    phase, so people like Boris can try the site from home), and every
 *    sign-in needs that code: the members include an admin;
 *  - it only signs in as the fixed seed members below, never a real person.
 * Remove TEST_SIGN_IN_CODE in Vercel to switch it off.
 */
import { createAuthEndpoint } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import type { BetterAuthPlugin } from "better-auth";
import { z } from "zod";
import { timingSafeEqual } from "node:crypto";

/** Seed members from scripts/seed.ts, chosen to cover the cases worth trying. */
export const DEV_TEST_MEMBERS = [
  { id: "u_anna", label: "Anna", note: "@anna_b · admin" },
  { id: "u_cleo", label: "Cleo", note: "@cleo_k · member" },
  { id: "u_ben", label: "Ben", note: "no Telegram username — can't post" },
  { id: "u_dara", label: "Dara", note: "member · ID not checked yet" },
  { id: "u_finn", label: "Finn", note: "asked to join via Cleo's link · waiting" },
  { id: "u_gil", label: "Gil", note: "new: signed in, hasn't asked to join" },
] as const;

const TEST_MEMBER_IDS: ReadonlySet<string> = new Set(DEV_TEST_MEMBERS.map((m) => m.id));

const isDevelopment = () => process.env.NODE_ENV === "development";

export function isDevSignInEnabled(): boolean {
  return isDevelopment() || Boolean(process.env.TEST_SIGN_IN_CODE);
}

/** Outside development, a test sign-in needs the shared code. */
export function testSignInNeedsCode(): boolean {
  return !isDevelopment();
}

function codeMatches(given: string | undefined): boolean {
  const expected = process.env.TEST_SIGN_IN_CODE;
  if (!expected || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function devSignIn() {
  return {
    id: "dev-sign-in",
    endpoints: {
      devSignIn: createAuthEndpoint("/dev/sign-in", {
        method: "POST",
        body: z.object({ userId: z.string(), code: z.string().max(200).optional() }),
      }, async (ctx) => {
        // Belt and braces: the plugin is only registered when enabled.
        if (!isDevSignInEnabled() || !TEST_MEMBER_IDS.has(ctx.body.userId)) {
          throw ctx.error("NOT_FOUND");
        }
        if (testSignInNeedsCode() && !codeMatches(ctx.body.code)) {
          throw ctx.error("FORBIDDEN", { message: "That test code isn't right." });
        }
        const user = await ctx.context.internalAdapter.findUserById(ctx.body.userId);
        if (!user) {
          throw ctx.error("BAD_REQUEST", { message: "Seed members not found. Run npm run db:seed." });
        }
        const session = await ctx.context.internalAdapter.createSession(user.id);
        await setSessionCookie(ctx, { session, user });
        return ctx.json({ ok: true });
      }),
    },
  } satisfies BetterAuthPlugin;
}
