import { expect, test } from "@playwright/test";

test("login page renders", async ({ page }) => {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { name: "Sign in" }),
  ).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Create garage" }),
  ).toBeVisible();
});

test("signup page renders", async ({ page }) => {
  await page.goto("/signup", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { name: "Create your garage" }),
  ).toBeVisible();
  await expect(page.getByLabel("Your name")).toBeVisible();
  await expect(page.getByLabel("Garage name")).toBeVisible();
});
