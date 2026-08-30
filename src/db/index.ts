import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Postgres client.
 *
 * One pooled connection per server instance, reused across requests. In
 * development Next.js reloads modules on every edit, so the client is stashed
 * on globalThis to avoid opening a new pool each time and exhausting the
 * database's connection limit.
 */
const connectionString = process.env.DATABASE_URL;

declare global {
  // eslint-disable-next-line no-var
  var __continuumSql: ReturnType<typeof postgres> | undefined;
}

function client() {
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.",
    );
  }
  if (process.env.NODE_ENV === "production") {
    return postgres(connectionString, { prepare: false });
  }
  globalThis.__continuumSql ??= postgres(connectionString, { prepare: false });
  return globalThis.__continuumSql;
}

export function getDb() {
  return drizzle(client(), { schema });
}

/** Raw SQL handle, for the hand-written search queries in src/lib/search-query.ts. */
export function getSql() {
  return client();
}

export { schema };
