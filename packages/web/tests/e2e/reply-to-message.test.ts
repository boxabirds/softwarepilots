import { test, expect } from "@playwright/test";

/**
 * E2E tests for the reply-to-message feature in Socratic sessions.
 * Tests the full flow: hover to reveal Reply, click to quote, type response,
 * submit, and verify the quoted text renders in the sent message.
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

const TUTOR_OPENING = "What do you already know about software pilotry?";
const TUTOR_FOLLOWUP = "Good thinking! Can you elaborate on that?";

test.describe("Reply to tutor message", () => {
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
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ saved: true }),
        });
      }
    });

    // Mock progress endpoint
    await page.route("**/api/curriculum/level-1/progress", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    });
  });

  test("hover reveals Reply, click quotes, submit shows quoted text in sent message", async ({ page }) => {
    let socraticCallCount = 0;

    await page.route("**/api/socratic", async (route) => {
      socraticCallCount++;
      if (socraticCallCount === 1) {
        // Opening probe
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            reply: TUTOR_OPENING,
            tool_type: "socratic_probe",
            topic: "introduction",
          }),
        });
      } else {
        // Follow-up after user reply
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            reply: TUTOR_FOLLOWUP,
            tool_type: "socratic_probe",
          }),
        });
      }
    });

    await page.goto(SESSION_URL);

    // Wait for the tutor opening message
    await expect(page.getByText(TUTOR_OPENING)).toBeVisible();

    // Find the tutor card with the opening message (not the intro card)
    const tutorCards = page.locator('[data-testid="tutor-card"]');
    // The second tutor card is the one with the actual tutor message (first is intro)
    const targetCard = tutorCards.nth(1);
    await expect(targetCard).toBeVisible();

    // Hover to reveal the Reply button
    await targetCard.hover();
    const replyButton = targetCard.locator('[data-testid="reply-button"]');
    await expect(replyButton).toBeVisible();

    // Click Reply
    await replyButton.click();

    // Verify quote preview appears above the input
    const quotePreview = page.locator('[data-testid="quote-preview"]');
    await expect(quotePreview).toBeVisible();
    await expect(quotePreview).toContainText(TUTOR_OPENING);

    // Type a response and submit with Shift+Enter
    const input = page.locator('textarea[placeholder="Type your response..."]');
    await expect(input).toBeFocused();
    await input.fill("I think it means guiding AI agents.");
    await input.press("Shift+Enter");

    // Quote preview should disappear after submit
    await expect(quotePreview).not.toBeVisible();

    // Wait for the sent message to appear with the quoted text
    const quoteBlock = page.locator('[data-testid="user-quote-block"]');
    await expect(quoteBlock).toBeVisible();
    await expect(quoteBlock).toContainText(TUTOR_OPENING);

    // The response text should also be visible
    await expect(page.getByText("I think it means guiding AI agents.")).toBeVisible();

    // Tutor follow-up should appear
    await expect(page.getByText(TUTOR_FOLLOWUP)).toBeVisible();
  });
});
