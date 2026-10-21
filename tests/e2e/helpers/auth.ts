import { expect, type Page } from "@playwright/test";

/** Fixed OTP from `.env` (`AUTH_DEV_OTP`). Required for e2e. */
export function getDevOtp(): string {
  const otp = process.env.AUTH_DEV_OTP?.trim();
  if (!otp) {
    throw new Error(
      "Set AUTH_DEV_OTP in .env (e.g. 123456) before running Playwright e2e",
    );
  }
  return otp;
}

export function uniqueEmail(prefix = "e2e"): string {
  return `${prefix}.${Date.now()}.${Math.floor(Math.random() * 1e6)}@example.com`;
}

/** Sign up a new garage owner and land on the dashboard. */
export async function signupAsOwner(
  page: Page,
  options: {
    name?: string;
    email?: string;
    garageName?: string;
  } = {},
) {
  const name = options.name ?? "E2E Owner";
  const email = options.email ?? uniqueEmail("owner");
  const garageName = options.garageName ?? `E2E Garage ${Date.now()}`;

  await page.goto("/signup", { waitUntil: "domcontentloaded" });
  await expect(page.getByLabel("Your name")).toBeVisible();
  await page.getByLabel("Your name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Garage name").fill(garageName);
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByLabel("One-time code")).toBeVisible();
  await page.getByLabel("One-time code").fill(getDevOtp());
  await page.getByRole("button", { name: "Verify and continue" }).click();

  await expect(page).toHaveURL(/\/dashboard/, { timeout: 60_000 });
  await expect(page.getByRole("heading", { name: "Home" })).toBeVisible();

  return { name, email, garageName };
}

/** Log in an existing user with the fixed dev OTP. */
export async function loginWithOtp(page: Page, email: string) {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await expect(page.getByLabel("Email")).toBeVisible();
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByLabel("One-time code")).toBeVisible();
  await page.getByLabel("One-time code").fill(getDevOtp());
  await page.getByRole("button", { name: "Verify and continue" }).click();

  await expect(page).toHaveURL(/\/dashboard/, { timeout: 60_000 });
}
