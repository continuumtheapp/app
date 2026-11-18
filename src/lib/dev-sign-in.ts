/**
 * Development-only sign-in as one of the seed members.
 *
 * Telegram is the only real way in, and Telegram can't redirect back to
 * localhost — so without this, nothing behind sign-in could be tried locally
 * before the bot exists. It is deliberately narrow:
 *  - it exists only under `next dev` (NODE_ENV "development"); Vercel builds,
 *    previews included, run in production mode and never register it;
 *  - it only signs in as the fixed seed members below, never a real person,
 *    even though the development database may be shared.
 */
import { createAuthEndpoint } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import type { BetterAuthPlugin } from "better-auth";
import { z } from "zod";

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

export function isDevSignInEnabled(): boolean {
  return process.env.NODE_ENV === "development";
}

export function devSignIn() {
  return {
    id: "dev-sign-in",
    endpoints: {
      devSignIn: createAuthEndpoint("/dev/sign-in", {
        method: "POST",
        body: z.object({ userId: z.string() }),
      }, async (ctx) => {
        // Belt and braces: the plugin is only registered in development.
        if (!isDevSignInEnabled() || !TEST_MEMBER_IDS.has(ctx.body.userId)) {
          throw ctx.error("NOT_FOUND");
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
