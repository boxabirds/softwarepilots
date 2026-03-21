import { test, expect } from "@playwright/test";

/**
 * E2E tests for topic coverage display - breadcrumb N/M format and
 * sidebar per-section N/M counts.
 */

const MOCK_SECTION = {
  id: "1.1",
  module_id: "1",
  module_title: "Module 1: Foundations",
  title: "What is Software Pilotry?",
  markdown: "# Software Pilotry\n\nSoftware is a living system.",
  key_intuition: "Software is a living system that requires constant attention",
};

const MOCK_PROGRESS = [
  {
    section_id: "1.1",
    status: "in_progress",
    understanding_level: "developing",
    concepts_json: JSON.stringify({
      "living system": { level: "solid", next_review: "2099-01-01T00:00:00Z", review_count: 2 },
      "constant attention": { level: "developing", next_review: "2020-01-01T00:00:00Z", review_count: 1 },
    }),
    updated_at: "2026-03-20T12:00:00Z",
  },
  {
    section_id: "1.2",
    status: "in_progress",
    understanding_level: "emerging",
    concepts_json: JSON.stringify({
      "decomposition": { level: "emerging", next_review: "2099-01-01T00:00:00Z", review_count: 1 },
    }),
    updated_at: "2026-03-20T12:00:00Z",
  },
];

const SESSION_URL = "/curriculum/new-grad/1.1";

test.describe("Topic coverage display", () => {
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

    // Mock section metadata
    await page.route("**/api/curriculum/new-grad/1.1", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/api/curriculum/new-grad/1.1") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(MOCK_SECTION),
        });
      } else {
        await route.continue();
      }
    });

    // Mock progress API with concepts_json data
    await page.route("**/api/curriculum/new-grad/progress", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/api/curriculum/new-grad/progress") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(MOCK_PROGRESS),
        });
      } else {
        await route.continue();
      }
    });

    // Mock conversation load (empty = fresh session)
    await page.route("**/api/curriculum/new-grad/1.1/conversation", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ messages: [], updated_at: null }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ saved: true }),
        });
      }
    });

    // Mock socratic chat
    await page.route("**/api/socratic", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          reply: "Let's explore software pilotry.",
          tool_type: "socratic_probe",
          topic: "introduction",
          confidence_assessment: "medium",
        }),
      });
    });
  });

  test("breadcrumb shows N/M format", async ({ page }) => {
    await page.goto(SESSION_URL);

    // Wait for breadcrumbs to update with coverage data
    const breadcrumbs = page.getByTestId("breadcrumbs");
    await expect(breadcrumbs).toContainText(/\d+\/\d+/);
  });

  test("sidebar shows per-section N/M counts", async ({ page }) => {
    await page.goto(SESSION_URL);

    // Wait for the section coverage badge to appear
    const sectionBadge = page.getByTestId("section-coverage-1.1");
    await expect(sectionBadge).toBeVisible();
    // Should show "2/N" where 2 = concepts in mock data
    await expect(sectionBadge).toContainText(/2\/\d+/);
  });
});
