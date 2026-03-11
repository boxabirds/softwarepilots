import { test, expect } from "@playwright/test";

test("landing page loads with sign-in button", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Software Pilotry")).toBeVisible();
  await expect(page.getByText("Sign in with GitHub")).toBeVisible();
});
