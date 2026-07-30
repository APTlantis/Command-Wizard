import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  use: {
    baseURL: "http://127.0.0.1:5173",
    trace: "on-first-retry"
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 920 } } },
    { name: "narrow", use: { ...devices["Desktop Chrome"], viewport: { width: 900, height: 860 } } }
  ]
});
