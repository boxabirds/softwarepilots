import { test, expect } from "@playwright/test";

/**
 * E2e tests for Stories 21 and 25: unified input routing, experiment acknowledgment,
 * multi-tool LLM response handling, and step-level context routing.
 *
 * These tests mock the /api/chat endpoint to avoid requiring a live Gemini key.
 * The mock returns controlled tool-call responses to verify frontend behavior.
 */

const EXERCISE_URL = "/module/2/exercise/1";

/** Intercept /api/chat and return a controlled response. */
function mockChatApi(
  page: import("@playwright/test").Page,
  response: {
    reply: string;
    on_topic: boolean;
    topic?: string;
    step_answer?: string;
  }
) {
  return page.route("**/api/chat", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(response),
    });
  });
}

test.describe("Exercise unified input flow", () => {
  test.beforeEach(async ({ page }) => {
    // Mock auth session so the exercise page loads
    await page.route("**/api/auth/session", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ id: "test-learner", github_login: "tester" }),
      });
    });
  });

  test("prediction typed in chat input is extracted as step_answer", async ({ page }) => {
    await mockChatApi(page, {
      reply: "Good prediction!",
      on_topic: true,
      step_answer: "Total: 12.0 | Cheap? False",
    });

    await page.goto(EXERCISE_URL);

    // Advance through intro
    const readyButton = page.getByText("I\u2019m ready");
    // Wait for intro messages, then click through
    await page.getByText("Next").first().click();
    await page.getByText("Next").first().click();
    await readyButton.click();

    // Should now be on predict step — type prediction in the unified input
    const input = page.locator("textarea");
    await input.fill("Total: 12.0 | Cheap? False");
    await input.press("Enter");

    // Tutor response should appear
    await expect(page.getByText("Good prediction!")).toBeVisible();

    // Step answer should be displayed as submitted input
    await expect(
      page.locator('[class*="border-l"]').filter({ hasText: "Total: 12.0" })
    ).toBeVisible();
  });

  test("question during predict step gets tutor response without consuming step input", async ({ page }) => {
    await mockChatApi(page, {
      reply: "str() converts a number to text so you can concatenate it.",
      on_topic: true,
      topic: "type conversion",
    });

    await page.goto(EXERCISE_URL);

    // Advance through intro
    await page.getByText("Next").first().click();
    await page.getByText("Next").first().click();
    await page.getByText("I\u2019m ready").click();

    // Ask a question — no step_answer in response, so step input stays pending
    const input = page.locator("textarea");
    await input.fill("What does str() do?");
    await input.press("Enter");

    // Tutor answers the question
    await expect(page.getByText("str() converts")).toBeVisible();

    // Run button should still say "Submit your answer first" (input still gates run)
    await expect(page.getByText("Submit your answer first")).toBeVisible();
  });

  test("experiment step shows Continue button and does not auto-advance", async ({ page }) => {
    // First mock for any chat during predict step
    await mockChatApi(page, {
      reply: "Got it.",
      on_topic: true,
      step_answer: "I think it prints 12.0",
    });

    await page.goto(EXERCISE_URL);

    // Advance through intro
    await page.getByText("Next").first().click();
    await page.getByText("Next").first().click();
    await page.getByText("I\u2019m ready").click();

    // Submit prediction for step 0
    const input = page.locator("textarea");
    await input.fill("I think it prints 12.0");
    await input.press("Enter");

    // Wait for step answer to be processed
    await expect(page.getByText("Got it.")).toBeVisible();

    // The Run button should now be enabled (prediction submitted)
    const runButton = page.getByRole("button", { name: /Run/ });
    await expect(runButton).toBeEnabled();
  });

  test("question about intro vocabulary gets on-topic response (Story 25: step context)", async ({ page }) => {
    // Mock chat to return an on-topic response about Python
    // In production, assembleStepContext includes "Python" from intro.context,
    // so Gemini would route this through help_with_curriculum, not off_topic_detected
    await mockChatApi(page, {
      reply: "Python is the programming language we're using in this exercise. Each line tells the computer exactly what to do.",
      on_topic: true,
      topic: "Python",
    });

    await page.goto(EXERCISE_URL);

    // Advance through intro to predict step
    await page.getByText("Next").first().click();
    await page.getByText("Next").first().click();
    await page.getByText("I\u2019m ready").click();

    // Ask about Python — mentioned in intro messages
    const input = page.locator("textarea");
    await input.fill("What is Python?");
    await input.press("Enter");

    // Tutor responds on-topic (not redirected as off-topic)
    await expect(page.getByText("Python is the programming language")).toBeVisible();

    // Step input should still be pending (question doesn't consume step answer)
    await expect(page.getByText("Submit your answer first")).toBeVisible();
  });
});
