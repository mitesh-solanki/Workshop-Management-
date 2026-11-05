import { expect, test } from "@playwright/test";

const otp = process.env.AUTH_DEV_OTP?.trim() || "123456";

test("owner reaches daily summary from nav", async ({ page }) => {
  const stamp = Date.now();
  const email = `e2e.daily.summary.${stamp}@example.com`;

  await page.goto("/signup", { waitUntil: "domcontentloaded" });
  await page.getByLabel("Your name").fill("E2E Daily Summary Owner");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Garage name").fill(`E2E Daily Summary Garage ${stamp}`);
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByLabel("One-time code")).toBeVisible({
    timeout: 30_000,
  });
  await page.getByLabel("One-time code").fill(otp);
  await page.getByRole("button", { name: /Verify/i }).click();

  await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });

  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Daily Summary" })
    .click();

  await expect(page).toHaveURL(/\/daily-summary/);
  await expect(
    page.getByRole("heading", { name: "Daily Summary", level: 1 }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Download PDF" })).toBeVisible();
  await expect(page.getByLabel("Day")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Job Cards", exact: true }).first(),
  ).toBeVisible();
});
