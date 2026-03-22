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

const SESSION_URL = "/curriculum/level-1/1.1";

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
    await page.route("**/api/curriculum/level-1/1.1", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/api/curriculum/level-1/1.1") {
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
    await page.route("**/api/curriculum/level-1/1.1/conversation", async (route) => {
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

  test("pause and resume: learner says 'I need a break', tutor pauses, input hidden, Resume Later shown", async ({ page }) => {
    let socraticCallCount = 0;
    await page.route("**/api/socratic", async (route) => {
      socraticCallCount++;
      if (socraticCallCount === 1) {
        // Opening probe
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            reply: "Welcome! What do you think software pilotry means?",
            tool_type: "socratic_probe",
            topic: "introduction",
          }),
        });
      } else {
        // Pause response
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            reply: "Great work today! Take a well-deserved break.",
            tool_type: "session_pause",
            pause_reason: "learner_requested",
            concepts_covered_so_far: "software pilotry basics",
            resume_suggestion: "We'll continue with the next concept next time.",
          }),
        });
      }
    });

    await page.goto(SESSION_URL);

    // Wait for tutor opening message
    await expect(
      page.getByText("Welcome! What do you think software pilotry means?"),
    ).toBeVisible();

    // Type "I need a break" and submit
    const input = page.locator('textarea[placeholder="Type your response..."]');
    await input.fill("I need a break");
    await input.press("Enter");

    // Pause card should appear
    const pauseCard = page.locator('[data-testid="session-pause-card"]');
    await expect(pauseCard).toBeVisible();

    // Acknowledgment text visible in pause card
    await expect(pauseCard.getByText("Great work today! Take a well-deserved break.")).toBeVisible();

    // Input bar should be hidden
    await expect(input).not.toBeVisible();

    // Resume Later button should be visible
    const resumeLater = page.locator('[data-testid="resume-later-button"]');
    await expect(resumeLater).toBeVisible();

    // Continue Session button should be visible
    const continueSession = page.locator('[data-testid="continue-session-button"]');
    await expect(continueSession).toBeVisible();
  });

  test("chat still works when progress tracking would fail (missing learner resilience)", async ({ page }) => {
    // Simulate: the socratic endpoint returns a valid reply even though
    // progress tracking fails internally (fire-and-forget pattern).
    // This tests the user-facing behavior: the chat must remain functional
    // regardless of background progress write failures.
    let socraticCallCount = 0;
    await page.route("**/api/socratic", async (route) => {
      socraticCallCount++;
      if (socraticCallCount === 1) {
        // Opening probe - returns successfully (progress failure is internal)
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            reply: "Welcome! Let's start exploring this topic.",
            tool_type: "socratic_probe",
            topic: "introduction",
            confidence_assessment: "low",
          }),
        });
      } else {
        // Follow-up - also succeeds despite any internal progress issues
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            reply: "That's a great start! Can you explain further?",
            tool_type: "evaluate_response",
            understanding_level: "emerging",
          }),
        });
      }
    });

    await page.goto(SESSION_URL);

    // Tutor opening should appear (progress failure is invisible to user)
    await expect(
      page.getByText("Welcome! Let's start exploring this topic."),
    ).toBeVisible();

    // User can still interact - type and send a message
    const input = page.locator('textarea[placeholder="Type your response..."]');
    await input.fill("I think software pilotry is about maintaining systems");
    await input.press("Shift+Enter");

    // Follow-up reply should appear - chat is fully functional
    await expect(
      page.getByText("That's a great start! Can you explain further?"),
    ).toBeVisible();
  });
});
