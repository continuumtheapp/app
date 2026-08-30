import { defineConfig } from "vitest/config";
import { config } from "dotenv";

const { parsed } = config({ path: ".env.local", quiet: true });

/**
 * Runs only the SQL/TypeScript parity check.
 *
 * The env vars are passed through `test.env` rather than relying on the parent
 * process: vitest runs tests in worker threads that do not inherit them, so a
 * plain `--env-file` leaves DATABASE_URL unset inside the test and the suite
 * silently skips itself.
 */
export default defineConfig({
  test: {
    env: parsed ?? {},
    include: ["**/sql-parity.test.ts"],
    testTimeout: 600_000,
    hookTimeout: 120_000,
  },
});
