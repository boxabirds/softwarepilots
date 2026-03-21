import { test, expect } from "@playwright/test";

/**
 * E2E tests for progress tracking indicators on the curriculum browser page.
 * Verifies that section status indicators are rendered when progress data exists.
 */

const MOCK_PROFILES = [
  {
    profile: "level-1",
    title: "New Graduate",
    starting_position: "Fresh from bootcamp or CS degree",
    module_count: 2,
    section_count: 4,
  },
  {
    profile: "level-10",
    title: "Veteran Engineer",
    starting_position: "5+ years shipping production code",
    module_count: 2,
    section_count: 4,
  },
  {
    profile: "level-20",
    title: "Senior Tech Leader",
    starting_position: "Leading teams and architecture decisions",
    module_count: 2,
    section_count: 4,
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
  {
    id: "2.1",
    module_id: "2",
    module_title: "Module 2: Core Skills",
    title: "Reading Code",
    key_intuition: "Code tells a story",
  },
];

test.describe("Progress tracking on curriculum browser", () => {
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
  });

  test("sections are visible after expanding a track", async ({ page }) => {
    // Mock sections for level-1
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

    // Mock progress with no data (all not_started)
    await page.route("**/api/curriculum/level-1/progress", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    });

    await page.goto("/curriculum");

    // Click to expand
    await page.getByText("New Graduate").click();

    // Sections should be visible
    await expect(page.getByText("What is Software Pilotry?")).toBeVisible();
    await expect(page.getByText("The Pilot Mindset")).toBeVisible();
    await expect(page.getByText("Reading Code")).toBeVisible();
  });

  test("section progress indicators appear when progress data exists", async ({ page }) => {
    // Mock sections for level-1
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

    // Mock progress with some data
    await page.route("**/api/curriculum/level-1/progress", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            section_id: "1.1",
            status: "completed",
            understanding_level: "solid",
            updated_at: new Date().toISOString(),
          },
          {
            section_id: "1.2",
            status: "in_progress",
            understanding_level: "emerging",
            updated_at: new Date().toISOString(),
          },
        ]),
      });
    });

    await page.goto("/curriculum");

    // Click to expand
    await page.getByText("New Graduate").click();

    // Wait for sections to load
    await expect(page.getByText("What is Software Pilotry?")).toBeVisible();

    // Progress summary text should appear (from ModuleTree component)
    await expect(page.getByText("1 of 2 completed")).toBeVisible();
  });
});
