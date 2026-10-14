import { defineConfig } from "@playwright/test";

const PORT = Number(process.env["E2E_PORT"] ?? 4100);
export const BASE_URL = `http://localhost:${PORT}`;

/**
 * E2E runs the real API (NODE_ENV=test, fresh PGlite) serving the exported web build from the same origin,
 * exactly as production does. Build first: `pnpm --filter @te/mobile build`.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env["CI"] ? 1 : 0,
  reporter: process.env["CI"] ? [["list"], ["html", { open: "never" }]] : "list",
  timeout: 60_000,
  use: { baseURL: BASE_URL, trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [
    {
      name: "narrow",
      use: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
    },
    { name: "wide", use: { viewport: { width: 1280, height: 800 } } },
  ],
  webServer: {
    command:
      "rm -rf .e2e-pglite && node --experimental-strip-types --disable-warning=ExperimentalWarning ../api/src/main.ts",
    url: `${BASE_URL}/health`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      NODE_ENV: "test",
      PORT: String(PORT),
      PUBLIC_URL: BASE_URL,
      PGLITE_DIR: ".e2e-pglite",
      WEB_DIST_DIR: "dist/web",
      BETTER_AUTH_SECRET: "e2e-only-secret-e2e-only-secret-e2e-only-secret",
      LOG_LEVEL: "warn",
    },
  },
});
