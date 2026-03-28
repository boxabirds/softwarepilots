import { test, expect } from "@playwright/test";

/**
 * E2E tests for provide_instruction rendering and metadata persistence.
 * Verifies instruction messages render as normal TutorCards with teacher cap emoji,
 * and that conversation save includes tool_type and concept metadata.
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

const INSTRUCTION_REPLY = "Closures are functions that capture variables from their surrounding scope. This matters because it enables data privacy and encapsulation in JavaScript. For example, a counter function that returns an inner function incrementing a private count variable demonstrates closures in action.";

test.describe("provide_instruction rendering and metadata", () => {
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

    // Mock progress
    await page.route("**/api/curriculum/level-1/progress", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    });
  });

  test("instruction message renders as TutorCard with emoji, metadata in save", async ({ page }) => {
    let socraticCallCount = 0;
    const savedPayloads: unknown[] = [];

    // Mock conversation load (empty = fresh session)
    await page.route("**/api/curriculum/level-1/1.1/conversation", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ messages: [], updated_at: null }),
        });
      } else if (route.request().method() === "PUT") {
        const body = route.request().postDataJSON();
        savedPayloads.push(body);
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ saved: true }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ ok: true }),
        });
      }
    });

    await page.route("**/api/socratic", async (route) => {
      socraticCallCount++;
      if (socraticCallCount === 1) {
        // Opening probe
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            reply: "Welcome! What do you know about closures?",
            tool_type: "socratic_probe",
            topic: "closures",
          }),
        });
      } else {
        // Instruction response
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            reply: INSTRUCTION_REPLY,
            tool_type: "provide_instruction",
            concept: "closures",
          }),
        });
      }
    });

    await page.goto(SESSION_URL);

    // Wait for opening probe
    await expect(
      page.getByText("Welcome! What do you know about closures?"),
    ).toBeVisible();

    // Type a question and submit
    const input = page.locator('textarea[placeholder="Type your response..."]');
    await input.fill("I have no idea what closures are, can you explain?");
    await input.press("Shift+Enter");

    // Wait for instruction reply - should be in an instruction-card
    await expect(
      page.getByText(/Closures are functions/u),
    ).toBeVisible();

    // Should render as instruction-card (amber variant with lightbulb)
    await expect(page.locator('[data-testid="instruction-card"]')).toHaveCount(1);

    // No "Direct Instruction" text
    await expect(page.getByText("Direct Instruction")).toHaveCount(0);

    // Other tutor messages should be regular tutor-cards
    const tutorCards = page.locator('[data-testid="tutor-card"]');
    const cardCount = await tutorCards.count();
    // At least 2: intro welcome card, opening probe (instruction is now instruction-card)
    expect(cardCount).toBeGreaterThanOrEqual(2);

    // Verify metadata was saved
    expect(savedPayloads.length).toBeGreaterThan(0);
    const lastSave = savedPayloads[savedPayloads.length - 1] as {
      messages: Array<{ role: string; content: string; tool_type?: string; concept?: string }>;
    };
    const instructionMsg = lastSave.messages.find(
      (m) => m.tool_type === "provide_instruction",
    );
    expect(instructionMsg).toBeTruthy();
    expect(instructionMsg!.concept).toBe("closures");

    // User messages should not have tool_type
    const userMsgs = lastSave.messages.filter((m) => m.role === "user");
    for (const msg of userMsgs) {
      expect(msg.tool_type).toBeUndefined();
    }
  });
});
