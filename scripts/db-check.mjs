import postgres from "postgres";

/** Verifies the database is reachable and PostGIS is enabled. */
const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
const sql = postgres(url, { prepare: false });
try {
  const [v] = await sql`SELECT version()`;
  console.log("connected:", v.version.split(",")[0]);

  const avail = await sql`SELECT default_version FROM pg_available_extensions WHERE name = 'postgis'`;
  console.log("postgis available:", avail.length ? avail[0].default_version : "NO");

  await sql`CREATE EXTENSION IF NOT EXISTS postgis`;
  const [p] = await sql`SELECT PostGIS_Version() AS v`;
  console.log("postgis enabled:", p.v);
} catch (e) {
  console.error("FAILED:", e.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
