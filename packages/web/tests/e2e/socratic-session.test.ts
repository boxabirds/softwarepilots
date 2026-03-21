import { test, expect } from "@playwright/test";

/**
 * E2E tests for the Socratic session page (/curriculum/:profile/:sectionId).
 * Mocks auth, section metadata, conversation loading, and socratic chat endpoints.
 */

const MOCK_SECTION = {
  id: "1.1",
  module_id: "1",
  module_title: "Module 1: Foundations",
  title: "What is Software Pilotry?",
  markdown: "# Software Pilotry\n\nSoftware is a living system.",
  key_intuition: "Software is a living system that requires constant attention",
};

const SESSION_URL = "/curriculum/new-grad/1.1";

test.describe("Socratic session page", () => {
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

    // Mock conversation load (empty = fresh session)
    await page.route("**/api/curriculum/new-grad/1.1/conversation", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ messages: [], updated_at: null }),
        });
      } else {
        // PUT/DELETE - just acknowledge
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ saved: true }),
        });
      }
    });
  });

  test("shows section title in context sidebar", async ({ page }) => {
    // Mock the socratic opening probe
    await page.route("**/api/socratic", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          reply: "Welcome! What do you think software pilotry means?",
          tool_type: "socratic_probe",
          topic: "introduction",
        }),
      });
    });

    await page.goto(SESSION_URL);

    // Section title should be visible in the context panel
    await expect(page.getByText("What is Software Pilotry?")).toBeVisible();
  });

  test("input bar is present", async ({ page }) => {
    await page.route("**/api/socratic", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          reply: "Welcome! Let's explore this topic together.",
          tool_type: "socratic_probe",
          topic: "introduction",
        }),
      });
    });

    await page.goto(SESSION_URL);

    // Input textarea should be present
    const input = page.locator('textarea[placeholder="Type your response..."]');
    await expect(input).toBeVisible();
  });

  test("tutor opening message appears", async ({ page }) => {
    await page.route("**/api/socratic", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          reply: "Welcome! What do you think software pilotry means?",
          tool_type: "socratic_probe",
          topic: "introduction",
        }),
      });
    });

    await page.goto(SESSION_URL);

    // Tutor's opening message should appear
    await expect(
      page.getByText("Welcome! What do you think software pilotry means?"),
    ).toBeVisible();
  });

  test("shows error message when socratic API fails", async ({ page }) => {
    await page.route("**/api/socratic", async (route) => {
      await route.fulfill({
        status: 502,
        contentType: "application/json",
        body: JSON.stringify({ error: "Tutor unavailable" }),
      });
    });

    await page.goto(SESSION_URL);

    // Error fallback message should appear
    await expect(
      page.getByText("Something went wrong connecting to the tutor"),
    ).toBeVisible();
  });
});
