/**
 * Authentication: sign in with Telegram.
 *
 * The community lives on Telegram, so the Telegram account is the identity:
 * it is the only way to sign in. No passwords, no email. See
 * src/lib/telegram.ts for how Telegram's ID token becomes a user, and
 * syncTelegramIdentity() below for how the @username stays current.
 *
 * Under `next dev` only, devSignIn() also lets you sign in as a seed member,
 * since Telegram can't redirect back to localhost. See src/lib/dev-sign-in.ts.
 */
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { genericOAuth } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import * as schema from "@/db/schema";
import { isTelegramConfigured } from "./env";
import { devSignIn, isDevSignInEnabled } from "./dev-sign-in";
import {
  TELEGRAM_PROVIDER_ID, TELEGRAM_DISCOVERY_URL, TELEGRAM_SCOPES,
  telegramUserInfo, telegramIdentity, claimsFromStoredIdToken, type TelegramClaims,
} from "./telegram";

export function getAuth() {
  return betterAuth({
    database: drizzleAdapter(getDb(), {
      provider: "pg",
      schema: {
        user: schema.users,
        session: schema.sessions,
        account: schema.accounts,
        verification: schema.verifications,
      },
    }),

    secret: process.env.BETTER_AUTH_SECRET,
    baseURL: process.env.BETTER_AUTH_URL,

    // Telegram is the only way in: no passwords, no email links.
    emailAndPassword: { enabled: false },

    databaseHooks: {
      session: { create: { after: (session) => syncTelegramIdentity(session.userId) } },
    },

    /**
     * telegramId, telegramHandle, bio, memberStatus, invitedById, isAdmin and isBanned are
     * deliberately NOT declared as additionalFields.
     *
     * They are SimbaCasa's own columns, written by syncTelegramIdentity(), the
     * profile form and the admin actions, and read through Drizzle —
     * better-auth never needs them.
     * Declaring them made it write an empty string for contactMethod while
     * leaving contactHandle null, which violates ck_users_contact_paired and
     * made every Google sign-in fail with an internal_server_error.
     */

    session: {
      expiresIn: 60 * 60 * 24 * 60, // 60 days
      updateAge: 60 * 60 * 24,      // refresh at most daily
      cookieCache: { enabled: true, maxAge: 5 * 60 },
    },

    plugins: [
      ...(isTelegramConfigured()
        ? [genericOAuth({
            config: [{
              providerId: TELEGRAM_PROVIDER_ID,
              discoveryUrl: TELEGRAM_DISCOVERY_URL,
              // Refuse to start rather than fall back to unverified tokens.
              requireIdTokenVerification: true,
              clientId: process.env.TELEGRAM_CLIENT_ID!,
              clientSecret: process.env.TELEGRAM_CLIENT_SECRET!,
              authentication: "basic",
              scopes: TELEGRAM_SCOPES,
              pkce: true,
              // Telegram has no userinfo endpoint. The ID token was verified
              // against Telegram's keys before this runs.
              getUserInfo: async (tokens) =>
                tokens.idToken
                  ? telegramUserInfo(claimsFromStoredIdToken(tokens.idToken) ?? {})
                  : null,
            }],
          })]
        : []),
      ...(isDevSignInEnabled() ? [devSignIn()] : []),
      // Must stay last: it writes Set-Cookie headers for Next server actions.
      nextCookies(),
    ],
  });
}

/**
 * Copy the Telegram ID and @username onto the user, on every sign-in.
 *
 * Usernames can change or be removed in Telegram, so a copy taken once would
 * go stale. Reads the ID token better-auth stored on the account at sign-in.
 */
async function syncTelegramIdentity(userId: string): Promise<void> {
  const db = getDb();
  const [account] = await db.select({ idToken: schema.accounts.idToken })
    .from(schema.accounts)
    .where(and(eq(schema.accounts.userId, userId),
      eq(schema.accounts.providerId, TELEGRAM_PROVIDER_ID)))
    .limit(1);
  const claims: TelegramClaims | null = account?.idToken
    ? claimsFromStoredIdToken(account.idToken)
    : null;
  if (!claims) return;

  const { telegramId, telegramHandle } = telegramIdentity(claims);
  await db.update(schema.users)
    .set({ telegramHandle, ...(telegramId !== null ? { telegramId } : {}), updatedAt: new Date() })
    .where(eq(schema.users.id, userId));
}
