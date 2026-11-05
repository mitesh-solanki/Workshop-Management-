import { expect, test } from "@playwright/test";

const otp = process.env.AUTH_DEV_OTP?.trim() || "123456";

test("owner reaches expenses from nav and can open add dialog", async ({
  page,
}) => {
  const stamp = Date.now();
  const email = `e2e.expenses.${stamp}@example.com`;

  await page.goto("/signup", { waitUntil: "domcontentloaded" });
  await page.getByLabel("Your name").fill("E2E Expenses Owner");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Garage name").fill(`E2E Expenses Garage ${stamp}`);
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByLabel("One-time code")).toBeVisible({
    timeout: 30_000,
  });
  await page.getByLabel("One-time code").fill(otp);
  await page.getByRole("button", { name: /Verify/i }).click();

  await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });

  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Expenses" })
    .click();

  await expect(page).toHaveURL(/\/expenses/);
  await expect(
    page.getByRole("heading", { name: "Expenses", level: 1 }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Add Expense" }).first().click();
  await expect(
    page.getByRole("heading", { name: "New Expense" }),
  ).toBeVisible();
  await expect(page.getByLabel("Amount (₹)")).toBeVisible();
});
