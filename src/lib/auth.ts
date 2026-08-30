/**
 * Authentication: Google sign-in or an email magic link.
 *
 * No passwords anywhere. Beyond being friendlier, this sidesteps password
 * hashing, which is genuinely awkward under Workers' CPU limits.
 *
 * Magic links last 24 hours rather than the usual 15 minutes: this is a
 * community noticeboard, not a bank, and a link that dies before someone gets
 * back to their inbox is the likelier failure. Tokens are single-use — the
 * plugin consumes them atomically on first verification.
 */
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { magicLink } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import { getDb } from "@/db";
import * as schema from "@/db/schema";
import { isEmailConfigured, isGoogleConfigured } from "./env";
import { sendMagicLinkEmail } from "./email";

export const MAGIC_LINK_EXPIRY_SECONDS = 60 * 60 * 24; // 24 hours

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

    // Passwords are deliberately not an option.
    emailAndPassword: { enabled: false },

    socialProviders: isGoogleConfigured()
      ? {
          google: {
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
          },
        }
      : {},

    user: {
      additionalFields: {
        contactMethod: { type: "string", required: false, input: false },
        contactHandle: { type: "string", required: false, input: false },
        isAdmin: { type: "boolean", required: false, input: false, defaultValue: false },
        isBanned: { type: "boolean", required: false, input: false, defaultValue: false },
      },
    },

    session: {
      expiresIn: 60 * 60 * 24 * 60, // 60 days
      updateAge: 60 * 60 * 24,      // refresh at most daily
      cookieCache: { enabled: true, maxAge: 5 * 60 },
    },

    plugins: [
      magicLink({
        expiresIn: MAGIC_LINK_EXPIRY_SECONDS,
        sendMagicLink: async ({ email, url }) => {
          if (!isEmailConfigured()) {
            // Without a mail provider the link would vanish silently. In dev,
            // print it so sign-in still works; in production, fail loudly.
            if (process.env.NODE_ENV === "production") {
              throw new Error("RESEND_API_KEY is not configured; cannot send magic links.");
            }
            console.warn(`\n[dev] Magic link for ${email}:\n${url}\n`);
            return;
          }
          await sendMagicLinkEmail(email, url);
        },
      }),
      // Must stay last: it writes Set-Cookie headers for Next server actions.
      nextCookies(),
    ],
  });
}

export type Auth = ReturnType<typeof getAuth>;
