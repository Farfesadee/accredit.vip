import { expect, test } from "@playwright/test";

test.setTimeout(180000);

async function check(page: any, path: string, login = false) {
  if (login) {
    await page.goto("/login", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.fill('input[type="email"]', "blackmarket@accredit.vip");
    await page.fill('input[type="password"]', "BlackMarket2026!");
    await page.click('button[type="submit"]');
    await page.waitForURL("**/dashboard**", { timeout: 20000 }).catch(() => {});
  }
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(3000);
  const overflow = await page.evaluate(() => {
    const root = document.documentElement;
    return Math.max(root.scrollWidth, document.body.scrollWidth) - root.clientWidth;
  });
  // eslint-disable-next-line no-console
  console.log(`${path}: overflow=${overflow}px`);
  expect(overflow).toBeLessThanOrEqual(1);
}

test.describe("final mobile check", () => {
  test("event page", async ({ page }) => {
    await check(page, "/events/77");
  });
  test("wallet + report", async ({ page }) => {
    await check(page, "/dashboard/wallet", true);
    await check(page, "/dashboard/events/77/report");
  });
});
