import { expect, test } from "@playwright/test";

const otp = process.env.AUTH_DEV_OTP?.trim() || "123456";

test("owner reaches payroll from nav and can generate month", async ({
  page,
}) => {
  const stamp = Date.now();
  const email = `e2e.payroll.${stamp}@example.com`;

  await page.goto("/signup", { waitUntil: "domcontentloaded" });
  await page.getByLabel("Your name").fill("E2E Payroll Owner");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Garage name").fill(`E2E Payroll Garage ${stamp}`);
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByLabel("One-time code")).toBeVisible({
    timeout: 30_000,
  });
  await page.getByLabel("One-time code").fill(otp);
  await page.getByRole("button", { name: /Verify/i }).click();

  await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });

  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Payroll" })
    .click();

  await expect(page).toHaveURL(/\/payroll/);
  await expect(
    page.getByRole("heading", { name: "Payroll", level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Add Payroll" }).first(),
  ).toBeVisible();

  await page.goto("/payroll?tab=bonuses");
  await expect(
    page.getByRole("heading", { name: "Bonuses", level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Give Bonus" }).first(),
  ).toBeVisible();

  await page.goto("/payroll?tab=advances");
  await expect(
    page.getByRole("heading", { name: "Advances", level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Give Advance" }).first(),
  ).toBeVisible();
});
