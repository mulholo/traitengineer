// Plain JS (not TS) so Node can load it from vitest.config.ts without type stripping.
import { defineConfig } from "vitest/config";

/** Shared Vitest settings for every package. Packages extend this via mergeConfig. */
export const vitestPreset = defineConfig({
  test: {
    include: ["src/**/*.test.ts", "test/**/*.test.ts"],
    environment: "node",
    testTimeout: 20_000,
    hookTimeout: 30_000,
    passWithNoTests: false,
  },
});
