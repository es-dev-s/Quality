import path from "node:path";
import { defineConfig } from "vitest/config";

/**
 * Unit tests run without a database. Integration tests (tests/integration)
 * only run when TEST_DATABASE_URL points at a disposable Postgres; they are
 * skipped otherwise so `npm test` never touches the app database.
 */
const testDatabaseUrl = process.env.TEST_DATABASE_URL?.trim();

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    fileParallelism: false,
    env: testDatabaseUrl
      ? {
          DATABASE_URL: testDatabaseUrl,
          DIRECT_URL: testDatabaseUrl,
          DATABASE_URL_SESSION: "",
        }
      : {},
  },
});
