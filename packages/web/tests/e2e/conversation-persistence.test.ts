import { test, expect } from "@playwright/test";

/**
 * E2E tests for conversation persistence in the Socratic session.
 * Verifies that conversations survive page refresh and can be cleared.
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

const SAVED_CONVERSATION = [
  { role: "tutor", content: "Welcome! What does pilotry mean to you?" },
  { role: "user", content: "I think it means guiding software carefully." },
  { role: "tutor", content: "Interesting! Can you say more about what careful guidance looks like?" },
];

test.describe("Conversation persistence", () => {
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
  });

  test("conversation persists across page refresh", async ({ page }) => {
    // Mock conversation GET to return saved messages
    await page.route("**/api/curriculum/new-grad/1.1/conversation", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            messages: SAVED_CONVERSATION,
            updated_at: new Date().toISOString(),
          }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ saved: true }),
        });
      }
    });

    // First load
    await page.goto(SESSION_URL);

    // Saved conversation should be displayed
    await expect(
      page.getByText("Welcome! What does pilotry mean to you?"),
    ).toBeVisible();
    await expect(
      page.getByText("I think it means guiding software carefully."),
    ).toBeVisible();
    await expect(
      page.getByText("Interesting! Can you say more about what careful guidance looks like?"),
    ).toBeVisible();

    // Refresh the page
    await page.reload();

    // Conversation should still be visible after reload
    await expect(
      page.getByText("Welcome! What does pilotry mean to you?"),
    ).toBeVisible();
    await expect(
      page.getByText("I think it means guiding software carefully."),
    ).toBeVisible();
  });

  test("Start Over clears the conversation", async ({ page }) => {
    let conversationCleared = false;

    // Mock conversation GET - returns saved messages initially, empty after clear
    await page.route("**/api/curriculum/new-grad/1.1/conversation", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            messages: conversationCleared ? [] : SAVED_CONVERSATION,
            updated_at: conversationCleared ? null : new Date().toISOString(),
          }),
        });
      } else if (route.request().method() === "DELETE") {
        conversationCleared = true;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ reset: true }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ saved: true }),
        });
      }
    });

    // Mock socratic API for the opening probe after reset
    await page.route("**/api/socratic", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          reply: "Fresh start! What would you like to explore?",
          tool_type: "socratic_probe",
          topic: "introduction",
        }),
      });
    });

    await page.goto(SESSION_URL);

    // Verify saved conversation is loaded
    await expect(
      page.getByText("Welcome! What does pilotry mean to you?"),
    ).toBeVisible();

    // Handle the confirmation dialog
    page.on("dialog", (dialog) => dialog.accept());

    // Click Start Over
    await page.getByText("Start Over").click();

    // Old conversation should be gone; new opening probe should appear
    await expect(
      page.getByText("Fresh start! What would you like to explore?"),
    ).toBeVisible();
    await expect(
      page.getByText("I think it means guiding software carefully."),
    ).not.toBeVisible();
  });
});
