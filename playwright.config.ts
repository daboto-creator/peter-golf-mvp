import { defineConfig, devices } from "@playwright/test";

const e2ePort = process.env.E2E_PORT ?? "3000";
const remoteBaseUrl = process.env.PLAYWRIGHT_BASE_URL?.trim();
const e2eBaseUrl = remoteBaseUrl ?? `http://localhost:${e2ePort}`;
const allowRemoteMutations = process.env.PLAYWRIGHT_ALLOW_MUTATIONS === "1";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: e2eBaseUrl,
    trace: "on-first-retry",
  },
  grepInvert: remoteBaseUrl && !allowRemoteMutations ? /@mutating/ : undefined,
  projects: [
    {
      name: "Desktop Chrome",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "Mobile Chrome",
      use: { ...devices["Pixel 7"] },
    },
    {
      name: "Mobile Safari",
      use: { ...devices["iPhone 15"] },
    },
    {
      name: "Tablet",
      use: { ...devices["iPad Pro 11"] },
    },
  ],
  webServer: remoteBaseUrl
    ? undefined
    : {
        command: `npm run dev -- --hostname localhost --port ${e2ePort}`,
        url: e2eBaseUrl,
        reuseExistingServer: !process.env.CI,
      },
});
