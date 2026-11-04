import { expect, test } from "@playwright/test";

test("reports nav path is reachable or redirects to login", async ({
  page,
}) => {
  await page.goto("/reports", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/(login|reports)/);
  await expect(page.locator("body")).toBeVisible();
});
