import { test, expect } from "@playwright/test";

/**
 * E2E tests for the curriculum selection page (/curriculum).
 * Mocks the auth session and API responses to avoid needing a live backend.
 */

const MOCK_PROFILES = [
  {
    profile: "new-grad",
    title: "New Graduate",
    starting_position: "Fresh from bootcamp or CS degree",
    module_count: 3,
    section_count: 12,
  },
  {
    profile: "veteran",
    title: "Veteran Engineer",
    starting_position: "5+ years shipping production code",
    module_count: 3,
    section_count: 10,
  },
  {
    profile: "senior-leader",
    title: "Senior Tech Leader",
    starting_position: "Leading teams and architecture decisions",
    module_count: 3,
    section_count: 8,
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

test.describe("Curriculum selection page", () => {
  test.beforeEach(async ({ page }) => {
    // Mock auth session
    await page.route("**/api/auth/session", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ id: "test-learner", github_login: "tester" }),
      });
    });

    // Also mock /api/auth/me for AuthGuard
    await page.route("**/api/auth/me", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ id: "test-learner", github_login: "tester" }),
      });
    });

    // Mock curriculum profiles listing
    await page.route("**/api/curriculum", async (route) => {
      // Only intercept the exact listing endpoint, not sub-paths
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

  test("displays 3 track cards", async ({ page }) => {
    await page.goto("/curriculum");

    await expect(page.getByText("New Graduate")).toBeVisible();
    await expect(page.getByText("Veteran Engineer")).toBeVisible();
    await expect(page.getByText("Senior Tech Leader")).toBeVisible();
  });

  test("clicking a track card reveals sections", async ({ page }) => {
    // Mock sections for new-grad
    await page.route("**/api/curriculum/new-grad", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/api/curriculum/new-grad") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(MOCK_SECTIONS),
        });
      } else {
        await route.continue();
      }
    });

    // Mock progress (empty)
    await page.route("**/api/curriculum/new-grad/progress", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    });

    await page.goto("/curriculum");

    // Click the New Graduate card
    await page.getByText("New Graduate").click();

    // Sections should appear
    await expect(page.getByText("What is Software Pilotry?")).toBeVisible();
    await expect(page.getByText("The Pilot Mindset")).toBeVisible();
  });

  test("clicking a section navigates to session page", async ({ page }) => {
    // Mock sections for new-grad
    await page.route("**/api/curriculum/new-grad", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/api/curriculum/new-grad") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(MOCK_SECTIONS),
        });
      } else {
        await route.continue();
      }
    });

    // Mock progress (empty)
    await page.route("**/api/curriculum/new-grad/progress", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    });

    await page.goto("/curriculum");

    // Click the New Graduate card to expand
    await page.getByText("New Graduate").click();

    // Click a section link
    await page.getByText("What is Software Pilotry?").click();

    // Should navigate to the session page
    await page.waitForURL("**/curriculum/new-grad/1.1");
    expect(page.url()).toContain("/curriculum/new-grad/1.1");
  });
});
