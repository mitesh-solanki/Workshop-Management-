import { expect, test } from "@playwright/test";

/**
 * End-to-end smoke for prompts 1–5:
 * dashboard → customer → vehicle → order → inspection → estimate approval.
 */
test.describe.configure({ mode: "serial" });

const stamp = Date.now();
const customerName = `Smoke Customer ${stamp}`;
const customerPhone = `98${String(stamp).slice(-8)}`;
const registration = `GJ01SM${String(stamp).slice(-4)}`;

test("dashboard is reachable when signed in", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Home" })).toBeVisible();
  await expect(page.getByText(/Welcome to/)).toBeVisible();
});

test("settings page loads", async ({ page }) => {
  await page.goto("/settings");
  await expect(
    page.getByRole("heading", { name: "Garage settings" }),
  ).toBeVisible();
});

test("create customer", async ({ page }) => {
  await page.goto("/customers");
  await page.getByRole("link", { name: "Add" }).click();
  await expect(
    page.getByRole("heading", { name: "New customer" }),
  ).toBeVisible();

  await page.getByLabel("Name").fill(customerName);
  await page.getByLabel("Phone").fill(customerPhone);
  await page.getByRole("button", { name: "Create customer" }).click();

  await expect(page.getByRole("heading", { name: customerName })).toBeVisible();
  await expect(page.getByText(customerPhone)).toBeVisible();
});

test("add vehicle to customer", async ({ page }) => {
  await page.goto("/customers");
  await page.getByRole("link", { name: customerName }).click();
  await page.getByRole("link", { name: "Add vehicle" }).click();

  await page.getByLabel("Registration number").fill(registration);
  await page.getByLabel("Make").fill("Maruti");
  await page.getByLabel("Model").fill("Swift");
  await page.getByRole("button", { name: "Add vehicle" }).click();

  await expect(page.getByRole("heading", { name: customerName })).toBeVisible();
  await expect(
    page.getByText(registration.toUpperCase().replace(/\s+/g, "")),
  ).toBeVisible();
});

test("create service order from vehicle", async ({ page }) => {
  const normalizedReg = registration.toUpperCase().replace(/\s+/g, "");

  await page.goto("/customers");
  await page.getByRole("link", { name: customerName }).click();
  await page.getByRole("link", { name: "New order" }).click();

  await expect(
    page.getByRole("heading", { name: "New service order" }),
  ).toBeVisible();
  await page.getByLabel("Complaint").fill("Brake noise on left side");
  await page.getByRole("button", { name: "Create order" }).click();

  await page.waitForURL(
    (url) => /^\/orders\/[^/]+$/.test(url.pathname),
    { timeout: 60_000 },
  );
  await expect(
    page.getByRole("heading", { name: normalizedReg }),
  ).toBeVisible();
  await expect(page.getByText("Brake noise on left side")).toBeVisible();
});

test("inspection: checklist + suggested repair", async ({ page }) => {
  const normalizedReg = registration.toUpperCase().replace(/\s+/g, "");

  await page.goto("/orders");
  await page
    .getByRole("link")
    .filter({ hasText: normalizedReg })
    .first()
    .click();
  await expect(page.getByRole("heading", { name: normalizedReg })).toBeVisible();

  await page.getByRole("link", { name: "Open inspection" }).click();
  await expect(
    page.getByRole("heading", { name: "Digital inspection" }),
  ).toBeVisible();

  const brakesCard = page.locator("article").filter({ hasText: "Brakes" });
  await brakesCard.getByLabel("Needs attention").check();
  await brakesCard.getByRole("button", { name: "Save item" }).click();
  await expect(brakesCard.getByText("Item saved")).toBeVisible();

  await page.locator("#repair-desc").fill("Replace brake pads");
  await page.locator("#repair-price").fill("500");
  await page.getByRole("button", { name: "Add suggested repair" }).click();
  await expect(page.getByText("Suggested repair added")).toBeVisible();
  await expect(page.getByText("Replace brake pads")).toBeVisible();
});

test("estimate: create and approve a line", async ({ page }) => {
  const normalizedReg = registration.toUpperCase().replace(/\s+/g, "");

  await page.goto("/orders");
  await page
    .getByRole("link")
    .filter({ hasText: normalizedReg })
    .first()
    .click();
  await expect(page.getByRole("heading", { name: normalizedReg })).toBeVisible();

  await page.getByRole("link", { name: "Open estimate" }).click();
  await expect(
    page.getByRole("heading", { name: "Estimate and approval" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Create estimate" }).click();
  // Form unmounts after create (page switches to estimate view).
  await expect(
    page.getByRole("heading", { name: "Revision 1" }),
  ).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Replace brake pads")).toBeVisible();

  const lineCard = page.locator("li").filter({ hasText: "Replace brake pads" });
  await expect(lineCard.locator("span", { hasText: "Pending" })).toBeVisible();
  await lineCard.getByRole("button", { name: "Save approval" }).click();
  await expect(lineCard.locator("span", { hasText: "Approved" })).toBeVisible({
    timeout: 30_000,
  });
  await expect(
    lineCard.getByRole("button", { name: "Save approval" }),
  ).toBeDisabled();
});
