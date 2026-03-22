import { test, expect } from "@playwright/test";

/**
 * E2E tests for claim-based progress display on the Dashboard.
 * Mocks API responses to verify the full frontend rendering pipeline
 * for claim_progress percentage rings and needs_review status.
 */

const MOCK_PROFILES = [
  {
    profile: "level-1",
    title: "New Graduate",
    starting_position: "Fresh out of university",
    module_count: 3,
    section_count: 6,
  },
];

const MOCK_SECTIONS = [
  {
    id: "1.1",
    module_id: "1",
    module_title: "Module 1: Foundations",
    title: "What is Software Pilotry?",
    key_intuition: "Software pilots bridge human judgment and AI capability",
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
    module_title: "Module 2: Practice",
    title: "CI/CD Fundamentals",
    key_intuition: "Continuous delivery reduces risk",
  },
];

const MOCK_PROGRESS_WITH_CLAIMS = [
  {
    section_id: "1.1",
    status: "in_progress",
    understanding_level: "developing",
    claim_progress: {
      demonstrated: 3,
      total: 6,
      percentage: 50,
      missing: ["c4", "c5", "c6"],
    },
    updated_at: "2026-03-22T10:00:00Z",
  },
  {
    section_id: "1.2",
    status: "completed",
    understanding_level: "solid",
    claim_progress: {
      demonstrated: 5,
      total: 5,
      percentage: 100,
      missing: [],
    },
    updated_at: "2026-03-22T09:00:00Z",
  },
  {
    section_id: "2.1",
    status: "needs_review",
    understanding_level: "developing",
    claim_progress: {
      demonstrated: 2,
      total: 7,
      percentage: 29,
      missing: ["c3", "c4", "c5", "c6", "c7"],
    },
    updated_at: "2026-03-22T08:00:00Z",
  },
];

test.describe("Claim progress on Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    // Mock auth session
    await page.route("**/api/auth/me", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          learner_id: "test-learner",
          email: "test@example.com",
          display_name: "Test User",
        }),
      })
    );

    // Mock profiles
    await page.route("**/api/curriculum", (route) => {
      if (route.request().url().endsWith("/api/curriculum")) {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(MOCK_PROFILES),
        });
      }
      return route.continue();
    });

    // Mock sections for level-1
    await page.route("**/api/curriculum/level-1", (route) => {
      if (route.request().url().endsWith("/api/curriculum/level-1")) {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(MOCK_SECTIONS),
        });
      }
      return route.continue();
    });

    // Mock progress with claim_progress data
    await page.route("**/api/curriculum/level-1/progress", (route) => {
      if (route.request().url().endsWith("/progress")) {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(MOCK_PROGRESS_WITH_CLAIMS),
        });
      }
      return route.continue();
    });
  });

  test("renders percentage rings when claim_progress is present", async ({ page }) => {
    await page.goto("/");

    // Click the profile card to expand
    await page.getByText("New Graduate").click();

    // Wait for sections to load
    await expect(page.getByText("What is Software Pilotry?")).toBeVisible();

    // Should render progress rings (not plain circles)
    const rings = page.getByTestId("progress-ring");
    await expect(rings).toHaveCount(3);
  });

  test("50% claim progress shows blue ring", async ({ page }) => {
    await page.goto("/");
    await page.getByText("New Graduate").click();
    await expect(page.getByText("What is Software Pilotry?")).toBeVisible();

    // First section (1.1) has 50% - should show blue arc
    const arcs = page.getByTestId("progress-arc");
    const firstArc = arcs.first();
    await expect(firstArc).toHaveAttribute("stroke", "#3b82f6");
  });

  test("100% completed section shows checkmark", async ({ page }) => {
    await page.goto("/");
    await page.getByText("New Graduate").click();
    await expect(page.getByText("The Pilot Mindset")).toBeVisible();

    // Second section (1.2) has 100% completed - should have checkmark
    const checkmarks = page.getByTestId("checkmark");
    await expect(checkmarks).toHaveCount(1);
  });

  test("needs_review section shows amber ring with refresh indicator", async ({ page }) => {
    await page.goto("/");
    await page.getByText("New Graduate").click();
    await expect(page.getByText("CI/CD Fundamentals")).toBeVisible();

    // Section 2.1 is needs_review - should have amber ring
    const refreshIndicators = page.getByTestId("refresh-indicator");
    await expect(refreshIndicators).toHaveCount(1);
  });

  test("needs_review section transitions to completed when claims re-demonstrated", async ({ page }) => {
    // First render: section 2.1 is needs_review
    await page.goto("/");
    await page.getByText("New Graduate").click();
    await expect(page.getByText("CI/CD Fundamentals")).toBeVisible();

    // Verify needs_review indicator is present
    const refreshIndicators = page.getByTestId("refresh-indicator");
    await expect(refreshIndicators).toHaveCount(1);

    // Now simulate re-demonstration by switching the mock to return completed status
    const updatedProgress = MOCK_PROGRESS_WITH_CLAIMS.map((p) =>
      p.section_id === "2.1"
        ? {
            ...p,
            status: "completed",
            claim_progress: {
              demonstrated: 7,
              total: 7,
              percentage: 100,
              missing: [],
            },
          }
        : p
    );

    // Re-route the progress endpoint with updated data
    await page.route("**/api/curriculum/level-1/progress", (route) => {
      if (route.request().url().endsWith("/progress")) {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(updatedProgress),
        });
      }
      return route.continue();
    });

    // Navigate away and back to trigger a fresh fetch
    await page.goto("/");
    await page.getByText("New Graduate").click();
    await expect(page.getByText("CI/CD Fundamentals")).toBeVisible();

    // The refresh indicator should be gone, replaced by a completed state
    const refreshAfter = page.getByTestId("refresh-indicator");
    await expect(refreshAfter).toHaveCount(0);

    // Should now have 2 checkmarks (section 1.2 and section 2.1)
    const checkmarks = page.getByTestId("checkmark");
    await expect(checkmarks).toHaveCount(2);
  });

  test("module header shows aggregate claim coverage", async ({ page }) => {
    await page.goto("/");
    await page.getByText("New Graduate").click();
    await expect(page.getByText("What is Software Pilotry?")).toBeVisible();

    // Module 1 has sections 1.1 (3/6) and 1.2 (5/5) = 8/11 claims
    const moduleSummary = page.getByTestId("module-claim-summary").first();
    await expect(moduleSummary).toContainText("8/11 claims");
  });
});
