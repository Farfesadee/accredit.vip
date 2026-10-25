import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "../",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: "https://accredit.vip",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 5"] },
    },
  ],
});
