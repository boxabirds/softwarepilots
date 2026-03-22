import { test, expect } from "@playwright/test";

/**
 * E2E tests for dashboard auto-refresh on window focus.
 * Verifies that progress data refreshes when the page regains focus
 * after a learner returns from a Socratic session.
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
];

const INITIAL_PROGRESS = [
  {
    section_id: "1.1",
    status: "in_progress",
    understanding_level: "emerging",
    updated_at: "2026-03-22T00:00:00Z",
  },
];

const UPDATED_PROGRESS = [
  {
    section_id: "1.1",
    status: "completed",
    understanding_level: "solid",
    updated_at: "2026-03-22T01:00:00Z",
  },
];

test.describe("Dashboard focus refresh", () => {
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
  });

  test("refreshes progress data when window regains focus", async ({ page }) => {
    let progressCallCount = 0;

    // Start with initial progress, switch to updated after first call
    await page.route("**/api/curriculum/level-1/progress", async (route) => {
      progressCallCount++;
      const data = progressCallCount <= 1 ? INITIAL_PROGRESS : UPDATED_PROGRESS;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(data),
      });
    });

    await page.goto("/curriculum");

    // Expand the track
    await page.getByText("New Graduate").click();

    // Wait for sections to load
    await expect(page.getByText("What is Software Pilotry?")).toBeVisible();

    // The initial progress fetch should have happened (call count >= 1)
    expect(progressCallCount).toBeGreaterThanOrEqual(1);
    const callsBefore = progressCallCount;

    // Simulate window focus event
    await page.evaluate(() => {
      window.dispatchEvent(new Event("focus"));
    });

    // Wait for the refresh call to happen
    await page.waitForTimeout(500);
    expect(progressCallCount).toBeGreaterThan(callsBefore);
  });

  test("does not fetch progress on focus when no profile is expanded", async ({ page }) => {
    let progressCallCount = 0;

    await page.route("**/api/curriculum/level-1/progress", async (route) => {
      progressCallCount++;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(INITIAL_PROGRESS),
      });
    });

    await page.goto("/curriculum");

    // Wait for page load
    await expect(page.getByText("New Graduate")).toBeVisible();

    // No profile expanded - fire focus
    await page.evaluate(() => {
      window.dispatchEvent(new Event("focus"));
    });

    await page.waitForTimeout(500);

    // Should not have fetched progress at all
    expect(progressCallCount).toBe(0);
  });
});
