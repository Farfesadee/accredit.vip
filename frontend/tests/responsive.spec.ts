import { expect, test } from "@playwright/test";

const publicPages = [
  "/",
  "/pricing",
  "/attend",
  "/contact",
  "/features/post-invite",
  "/features/post-event",
  "/features/qr-accreditation",
  "/features/guest-management",
  "/features/live-analytics",
  "/features/ai-assistance",
];

test.describe("responsive layout", () => {
  for (const path of publicPages) {
    test(`${path} does not create horizontal overflow`, async ({ page }) => {
      await page.goto(path, { waitUntil: "domcontentloaded" });
      await page.locator("body").waitFor({ state: "visible" });

      const overflow = await page.evaluate(() => {
        const root = document.documentElement;
        const body = document.body;
        return Math.max(root.scrollWidth, body.scrollWidth) - root.clientWidth;
      });

      expect(overflow).toBeLessThanOrEqual(1);
    });
  }
});
