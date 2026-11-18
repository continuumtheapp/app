/**
 * Telegram sign-in: turning Telegram's ID token into SimbaCasa's user.
 *
 * Telegram Login is standard OpenID Connect (https://oauth.telegram.org), run
 * by better-auth's generic OAuth plugin, which verifies the ID token against
 * Telegram's published keys before any of this code sees it.
 *
 * Two quirks shape this file:
 *  - Telegram never shares an email, and SimbaCasa never asks for one, but
 *    better-auth's user table requires the column. Each user gets an internal
 *    placeholder on the reserved .invalid domain, which can never receive
 *    mail. It is never shown or used.
 *  - There is no userinfo endpoint; everything comes from the token's claims.
 */
export const TELEGRAM_PROVIDER_ID = "telegram";
export const TELEGRAM_DISCOVERY_URL = "https://oauth.telegram.org/.well-known/openid-configuration";

/**
 * openid + profile give the name, @username and photo. telegram:bot_access
 * lets our bot message the person later — alerts, contact notifications —
 * without them having to start the bot first.
 */
export const TELEGRAM_SCOPES = ["openid", "profile", "telegram:bot_access"];

const PLACEHOLDER_EMAIL_DOMAIN = "users.telegram.invalid";

export interface TelegramClaims {
  sub?: string;
  /** Numeric Telegram user ID — the one the Bot API uses. */
  id?: number | string;
  name?: string;
  preferred_username?: string;
  picture?: string;
  [claim: string]: unknown;
}

/** What better-auth needs to create or find the user, from verified claims. */
export function telegramUserInfo(claims: TelegramClaims) {
  if (!claims.sub) return null;
  return {
    ...claims,
    id: claims.sub,
    name: claims.name ?? "",
    image: claims.picture,
    email: placeholderEmail(claims.sub),
    emailVerified: false,
  };
}

export function placeholderEmail(subject: string): string {
  return `${subject.replace(/[^\w-]/g, "")}@${PLACEHOLDER_EMAIL_DOMAIN}`;
}

/** The fields SimbaCasa keeps in step with Telegram on every sign-in. */
export function telegramIdentity(claims: TelegramClaims): {
  telegramId: number | null;
  telegramHandle: string | null;
} {
  const id = Number(claims.id);
  const username = claims.preferred_username?.trim().replace(/^@/, "");
  return {
    telegramId: Number.isSafeInteger(id) && id > 0 ? id : null,
    // No username means nobody can open a chat with them: they can browse,
    // but not post or reveal contacts until they set one in Telegram.
    telegramHandle: username ? `@${username}` : null,
  };
}

/**
 * Claims from an ID token that better-auth has already verified and stored.
 * Only decodes: the signature was checked at sign-in, before it was stored.
 */
export function claimsFromStoredIdToken(idToken: string): TelegramClaims | null {
  const payload = idToken.split(".")[1];
  if (!payload) return null;
  try {
    const claims: unknown = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return claims && typeof claims === "object" ? (claims as TelegramClaims) : null;
  } catch {
    return null;
  }
}
