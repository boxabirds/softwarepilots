import { test, expect } from "@playwright/test";

/**
 * E2E tests for the Start Over flow on the section listing.
 * Verifies that clicking Start Over shows a confirmation dialog,
 * calls the archive endpoint, and navigates to a fresh session.
 */

const MOCK_PROFILES = [
  {
    profile: "level-1",
    title: "New Graduate",
    starting_position: "Fresh from bootcamp or CS degree",
    module_count: 1,
    section_count: 2,
  },
];

const MOCK_SECTIONS = [
  {
    id: "1.1",
    module_id: "1",
    module_title: "Module 1: Foundations",
    title: "What is Software Pilotry?",
    key_intuition: "Software is a living system",
  },
  {
    id: "1.2",
    module_id: "1",
    module_title: "Module 1: Foundations",
    title: "The Pilot Mindset",
    key_intuition: "Pilots observe before acting",
  },
];

const MOCK_PROGRESS_IN_PROGRESS = [
  {
    section_id: "1.1",
    status: "in_progress",
    understanding_level: "emerging",
    claim_progress: { demonstrated: 2, total: 5, percentage: 40 },
    updated_at: new Date().toISOString(),
  },
  {
    section_id: "1.2",
    status: "completed",
    claim_progress: { demonstrated: 4, total: 4, percentage: 100 },
    updated_at: new Date().toISOString(),
  },
];

test.describe("Start Over flow", () => {
  test.beforeEach(async ({ page }) => {
    // Mock auth
    await page.route("**/api/auth/session", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ id: "test-learner", github_login: "tester" }),
      });
    });

    await page.route("**/api/auth/me", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ id: "test-learner", github_login: "tester" }),
      });
    });

    // Mock curriculum profiles
    await page.route("**/api/curriculum", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/api/curriculum") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(MOCK_PROFILES),
        });
      } else {
        await route.continue();
      }
    });

    // Mock sections
    await page.route("**/api/curriculum/level-1", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/api/curriculum/level-1") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(MOCK_SECTIONS),
        });
      } else {
        await route.continue();
      }
    });

    // Mock progress
    await page.route("**/api/curriculum/level-1/progress", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_PROGRESS_IN_PROGRESS),
      });
    });
  });

  test("in_progress section shows Continue and Start Over buttons", async ({ page }) => {
    await page.goto("/dashboard");
    await page.getByText("New Graduate").click();

    // Wait for sections to render
    await expect(page.getByText("What is Software Pilotry?")).toBeVisible();

    // In-progress section should have Continue button and Start Over link
    const sectionRow = page.getByTestId("section-row-1.1");
    await expect(sectionRow.getByRole("link", { name: "Continue" })).toBeVisible();
    await expect(sectionRow.getByTestId("start-over")).toBeVisible();
  });

  test("completed section shows Review and Start Over buttons", async ({ page }) => {
    await page.goto("/dashboard");
    await page.getByText("New Graduate").click();

    await expect(page.getByText("The Pilot Mindset")).toBeVisible();

    const sectionRow = page.getByTestId("section-row-1.2");
    await expect(sectionRow.getByRole("link", { name: "Review" })).toBeVisible();
    await expect(sectionRow.getByTestId("start-over")).toBeVisible();
  });

  test("Start Over calls archive endpoint after confirmation and navigates", async ({ page }) => {
    let archiveCalled = false;

    // Mock archive endpoint
    await page.route("**/api/curriculum/level-1/1.1/archive", async (route) => {
      archiveCalled = true;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ archived: true }),
      });
    });

    // Mock the section detail page (navigation target)
    await page.route("**/api/curriculum/level-1/1.1", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/api/curriculum/level-1/1.1") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            id: "1.1",
            title: "What is Software Pilotry?",
            module_id: "1",
            module_title: "Module 1: Foundations",
            markdown: "# Test section",
          }),
        });
      } else {
        await route.continue();
      }
    });

    // Mock conversation endpoint for the section page
    await page.route("**/api/curriculum/level-1/1.1/conversation", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ messages: [], updated_at: null }),
      });
    });

    await page.goto("/dashboard");
    await page.getByText("New Graduate").click();
    await expect(page.getByText("What is Software Pilotry?")).toBeVisible();

    // Set up dialog handler to accept the confirmation
    page.on("dialog", async (dialog) => {
      expect(dialog.message()).toContain("archive your current session");
      await dialog.accept();
    });

    // Click Start Over on the in-progress section
    const sectionRow = page.getByTestId("section-row-1.1");
    await sectionRow.getByTestId("start-over").click();

    // Verify archive was called
    await page.waitForTimeout(500);
    expect(archiveCalled).toBe(true);

    // Verify navigation to the section page
    await expect(page).toHaveURL(/\/curriculum\/level-1\/1\.1/);
  });

  test("Start Over does nothing when confirmation is dismissed", async ({ page }) => {
    let archiveCalled = false;

    await page.route("**/api/curriculum/level-1/1.1/archive", async (route) => {
      archiveCalled = true;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ archived: true }),
      });
    });

    await page.goto("/dashboard");
    await page.getByText("New Graduate").click();
    await expect(page.getByText("What is Software Pilotry?")).toBeVisible();

    // Dismiss the confirmation dialog
    page.on("dialog", async (dialog) => {
      await dialog.dismiss();
    });

    const sectionRow = page.getByTestId("section-row-1.1");
    await sectionRow.getByTestId("start-over").click();

    // Wait a bit to ensure no async calls happen
    await page.waitForTimeout(300);
    expect(archiveCalled).toBe(false);

    // Should still be on the dashboard page
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("claim progress is displayed for in_progress section", async ({ page }) => {
    await page.goto("/dashboard");
    await page.getByText("New Graduate").click();

    await expect(page.getByText("What is Software Pilotry?")).toBeVisible();

    // Check claim progress text
    const sectionRow = page.getByTestId("section-row-1.1");
    await expect(sectionRow.getByTestId("claim-text")).toHaveText("2/5 claims");
  });
});
