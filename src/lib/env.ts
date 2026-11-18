/**
 * Environment configuration.
 *
 * Secrets live in .env.local for development and in Vercel's project settings
 * for production. See .env.example for the full list and where to get each one.
 */

export interface AppEnv {
  DATABASE_URL: string;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  /** From @BotFather → your bot → Login Widget. */
  TELEGRAM_CLIENT_ID: string;
  TELEGRAM_CLIENT_SECRET: string;
  R2_ACCOUNT_ID: string;
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
  R2_BUCKET: string;
  /** Private bucket for ID checks: no public access, EU jurisdiction. */
  R2_ID_BUCKET: string;
  /** Public base URL photos are served from (R2 custom domain or r2.dev). */
  PHOTOS_BASE_URL: string;
}

export function env(): Partial<AppEnv> {
  return process.env as unknown as Partial<AppEnv>;
}

/**
 * Read a required secret, failing loudly at the point of use rather than
 * silently behaving as if the feature were disabled.
 */
export function requireEnv<K extends keyof AppEnv>(key: K): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(
      `Missing ${String(key)}. Add it to .env.local locally, or to the project's environment variables in Vercel.`,
    );
  }
  return value;
}

export function isTelegramConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_CLIENT_ID && process.env.TELEGRAM_CLIENT_SECRET);
}
