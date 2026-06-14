import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "walkthrough.spec.ts",
  timeout: 120_000,
  outputDir: "./walkthrough-artifacts",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    video: { mode: "on", size: { width: 1440, height: 900 } },
    viewport: { width: 1440, height: 900 }
  }
});
