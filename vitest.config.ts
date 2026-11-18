import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Same "@/" alias as tsconfig.json, for lib modules that import the db.
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    // The SQL parity test shells out to wrangler for every query, so it takes
    // ~90s. It is excluded from the default run and gets its own script:
    //   npm run test:parity
    exclude: ["**/node_modules/**", "**/sql-parity.test.ts"],
  },
});
