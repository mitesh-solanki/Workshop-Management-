import { expect, test } from "@playwright/test";

const otp = process.env.AUTH_DEV_OTP?.trim() || "123456";

test("owner cannot open My Salary from nav", async ({ page }) => {
  const stamp = Date.now();
  const email = `e2e.mypay.${stamp}@example.com`;

  await page.goto("/signup", { waitUntil: "domcontentloaded" });
  await page.getByLabel("Your name").fill("E2E My Salary Owner");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Garage name").fill(`E2E My Salary Garage ${stamp}`);
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByLabel("One-time code")).toBeVisible({
    timeout: 30_000,
  });
  await page.getByLabel("One-time code").fill(otp);
  await page.getByRole("button", { name: /Verify/i }).click();

  await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });

  const nav = page.getByRole("navigation", { name: "Main navigation" });
  await expect(nav.getByRole("link", { name: "My Salary" })).toHaveCount(0);
  await expect(nav.getByRole("link", { name: "Payroll" })).toBeVisible();

  await page.goto("/my-pay");
  await expect(
    page.getByRole("heading", { name: "My Salary Locked", exact: true }),
  ).toBeVisible();
});
