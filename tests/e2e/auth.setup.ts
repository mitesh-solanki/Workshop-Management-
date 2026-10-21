import fs from "node:fs";
import path from "node:path";
import { test as setup } from "@playwright/test";
import { signupAsOwner } from "./helpers/auth";

const authDir = path.join(__dirname, "../../playwright/.auth");
const authFile = path.join(authDir, "owner.json");

setup("authenticate as owner", async ({ page }) => {
  fs.mkdirSync(authDir, { recursive: true });
  await signupAsOwner(page, {
    name: "Smoke Owner",
    garageName: `Smoke Garage ${Date.now()}`,
  });
  await page.context().storageState({ path: authFile });
});
