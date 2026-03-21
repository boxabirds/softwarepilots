import { test, expect } from "@playwright/test";

/**
 * E2E tests for the progress dashboard page (/curriculum/:profile/progress).
 * Mocks the auth session and API responses to avoid needing a live backend.
 */

const MOCK_SUMMARY = {
  overall_narrative: "You are making steady progress through the curriculum.",
  sections: [
    {
      section_id: "1.1",
      title: "What is Software Pilotry?",
      status: "completed",
      understanding_level: "solid",
      concepts: {
        "pilot mindset": { level: "strong", review_count: 3 },
      },
    },
    {
      section_id: "1.2",
      title: "The Pilot Mindset",
      status: "in_progress",
      understanding_level: "emerging",
      concepts: {
        observation: { level: "emerging", review_count: 1 },
      },
    },
    {
      section_id: "2.1",
      title: "CI/CD Fundamentals",
      status: "not_started",
      concepts: {},
    },
  ],
  stats: {
    completed: 1,
    in_progress: 1,
    paused: 0,
    not_started: 1,
    total: 3,
  },
  concepts_due_for_review: [
    { concept: "observation", section_id: "1.2", days_overdue: 2 },
  ],
};

test.describe("Progress dashboard page", () => {
  test.beforeEach(async ({ page }) => {
    // Mock auth session
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

    // Mock the summary endpoint
    await page.route(
      "**/api/curriculum/new-grad/progress/summary",
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(MOCK_SUMMARY),
        });
      }
    );
  });

  test("displays progress narrative", async ({ page }) => {
    await page.goto("/curriculum/new-grad/progress");

    await expect(
      page.getByText("You are making steady progress through the curriculum.")
    ).toBeVisible();
  });

  test("displays stats bar with correct counts", async ({ page }) => {
    await page.goto("/curriculum/new-grad/progress");

    await expect(page.getByText("1 completed")).toBeVisible();
    await expect(page.getByText("1 in progress")).toBeVisible();
    await expect(page.getByText("1 not started")).toBeVisible();
  });

  test("shows module cards that expand on click", async ({ page }) => {
    await page.goto("/curriculum/new-grad/progress");

    // Module cards should be present
    const moduleCards = page.getByTestId("module-card");
    await expect(moduleCards.first()).toBeVisible();

    // Click to expand
    await moduleCards.first().getByRole("button").click();

    // Section cards should appear
    const sectionCards = page.getByTestId("section-card");
    await expect(sectionCards.first()).toBeVisible();
  });

  test("clicking a section navigates to Socratic session", async ({
    page,
  }) => {
    await page.goto("/curriculum/new-grad/progress");

    // Expand first module
    const moduleCards = page.getByTestId("module-card");
    await moduleCards.first().getByRole("button").click();

    // Click a section link
    await page
      .getByText("What is Software Pilotry?")
      .click();

    // Should navigate to the session
    await page.waitForURL("**/curriculum/new-grad/1.1");
    expect(page.url()).toContain("/curriculum/new-grad/1.1");
  });
});
