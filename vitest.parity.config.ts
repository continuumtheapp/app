import { defineConfig } from "vitest/config";
import { config } from "dotenv";

config({ path: ".env.local" });

/** Runs only the SQL/TypeScript parity check. Requires a local D1: `npm run db:migrate:local`. */
export default defineConfig({
  test: {
    include: ["**/sql-parity.test.ts"],
    testTimeout: 600_000,
    hookTimeout: 120_000,
  },
});
