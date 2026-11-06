import { expect, test } from "@playwright/test";

test("GST export is reachable from invoices nav path", async ({ page }) => {
  await page.goto("/invoices", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/(login|invoices)/);

  if (page.url().includes("/login")) {
    await expect(page.locator("body")).toBeVisible();
    return;
  }

  await page.getByRole("link", { name: /Export for GST|GST/i }).click();
  await expect(page).toHaveURL(/\/invoices\/export-gst/);
  await expect(
    page.getByRole("heading", { name: /Export for GST|GST/i }),
  ).toBeVisible();
});
