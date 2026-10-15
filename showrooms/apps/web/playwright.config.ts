import { defineConfig, devices } from "@playwright/test";

/**
 * Runs against a running API (with MEDIA_PROVIDER=local) and web server:
 *   pnpm --filter @showrooms/api seed && pnpm --filter @showrooms/api dev
 *   pnpm --filter @showrooms/web build && pnpm --filter @showrooms/web start
 *   pnpm --filter @showrooms/web test:e2e
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : undefined,
  },
  projects: [
    { name: "mobile-android", use: { ...devices["Pixel 7"] } },
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
  ],
});
