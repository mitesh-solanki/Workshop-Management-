import { expect, test } from "@playwright/test";

test("home page renders", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/(login)?$/);
  await expect(page.locator("body")).toBeVisible();
});
