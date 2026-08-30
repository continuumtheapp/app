import postgres from "postgres";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Applies drizzle-generated migrations.
 *
 * Uses the direct (non-pooled) connection: DDL cannot run through pgbouncer's
 * transaction pooling. Written by hand rather than using `drizzle-kit migrate`,
 * which hangs against this database after creating its bookkeeping table.
 */
const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL_UNPOOLED or DATABASE_URL must be set.");
  process.exit(1);
}

const sql = postgres(url, { prepare: false, onnotice: () => {} });
const dir = "drizzle/migrations";

try {
  await sql`CREATE TABLE IF NOT EXISTS applied_migrations (
    name text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`;

  const done = new Set(
    (await sql`SELECT name FROM applied_migrations`).map((r) => r.name),
  );
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();

  for (const file of files) {
    if (done.has(file)) {
      console.log(`skip  ${file} (already applied)`);
      continue;
    }
    const body = readFileSync(join(dir, file), "utf8");
    // drizzle separates statements with this marker.
    const statements = body
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);

    for (const statement of statements) {
      await sql.unsafe(statement);
    }
    await sql`INSERT INTO applied_migrations (name) VALUES (${file})`;
    console.log(`apply ${file} (${statements.length} statements)`);
  }
  console.log("Migrations up to date.");
} catch (error) {
  console.error("Migration failed:", error.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
