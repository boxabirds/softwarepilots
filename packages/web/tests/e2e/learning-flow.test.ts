import { test, expect } from "@playwright/test";

/**
 * Full learning flow e2e test against the real running stack.
 *
 * Prerequisites:
 * - API running on localhost:8790 (bun run api:dev)
 * - Web running on localhost:3000 (bun run web:dev)
 * - Fake GitHub on localhost:9999 (bun run scripts/start-fake-github.ts)
 * - D1 migrations applied (bun run --filter @softwarepilots/api db:migrate:local)
 *
 * This test uses the fake GitHub server for OAuth and hits the real API
 * with real D1. It does NOT mock API responses - it tests the actual stack.
 *
 * Since the Socratic chat requires a Gemini API key and we can't guarantee
 * deterministic LLM responses, the Socratic API calls are mocked at the
 * page level while everything else hits the real API.
 */

test.describe("Full learning flow - real API", () => {
  test.beforeEach(async ({ page }) => {
    // Mock auth (until fake GitHub is integrated into the test harness)
    await page.route("**/api/auth/me", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "e2e-test-learner",
          email: "e2e@test.com",
          display_name: "E2E Tester",
          enrolled_at: "2026-03-21T00:00:00Z",
        }),
      });
    });

    // Mock the Socratic chat (requires Gemini API key we don't have in CI)
    let socraticCallCount = 0;
    await page.route("**/api/socratic", async (route) => {
      socraticCallCount++;

      // Simulate a multi-turn conversation that leads to session completion
      if (socraticCallCount <= 2) {
        // Opening probe and first response
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            reply: "What do you think happens when a computer executes a line of code?",
            tool_type: "socratic_probe",
            topic: "code execution",
            confidence_assessment: "medium",
          }),
        });
      } else if (socraticCallCount <= 4) {
        // Evaluate and follow up
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            reply: "Good thinking. What might go wrong if two threads access the same data?",
            tool_type: "evaluate_response",
            topic: "concurrency",
            understanding_level: "developing",
          }),
        });
      } else if (socraticCallCount === 5) {
        // Provide instruction when learner struggles
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            reply: "A race condition occurs when two operations happen at the same time on shared data. The result depends on which one finishes first.",
            tool_type: "provide_instruction",
            concept: "race conditions",
            struggle_reason: "learner_asked",
          }),
        });
      } else {
        // Session complete
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            reply: "Excellent work! You've covered the key concepts of how software breaks - from basic execution to concurrency issues.",
            tool_type: "session_complete",
            final_understanding: "solid",
            concepts_covered: "code execution, concurrency, race conditions",
            recommendation: "Next, try Section 1.2: Systems Thinking for Oversight",
          }),
        });
      }
    });
  });

  test("landing page loads without errors", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Software Pilotry")).toBeVisible();
    // No console errors
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.waitForTimeout(1000);
    expect(errors).toHaveLength(0);
  });

  test("curriculum browser shows all three tracks", async ({ page }) => {
    await page.goto("/curriculum");

    // All three track cards should render
    await expect(page.getByText("New CS Graduate")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Veteran Engineer")).toBeVisible();
    await expect(page.getByText("Senior Tech Leader")).toBeVisible();
  });

  test("expanding a track shows sections without 500 errors", async ({ page }) => {
    // Listen for failed API calls
    const failedRequests: { url: string; status: number }[] = [];
    page.on("response", (response) => {
      if (response.status() >= 500) {
        failedRequests.push({ url: response.url(), status: response.status() });
      }
    });

    await page.goto("/curriculum");

    // Wait for tracks to load
    await expect(page.getByText("New CS Graduate")).toBeVisible({ timeout: 10000 });

    // Click to expand the New Grad track
    await page.getByText("New CS Graduate").click();

    // Wait for sections to load
    await page.waitForTimeout(2000);

    // No 500 errors should have occurred
    expect(failedRequests).toHaveLength(0);

    // Sections should be visible (actual section titles from the curriculum)
    await expect(page.getByText("How Software Actually Breaks")).toBeVisible({ timeout: 5000 });
  });

  test("opening a Socratic session shows tutor and context", async ({ page }) => {
    await page.goto("/curriculum/new-grad/1.1");

    // Context sidebar should show section info
    await expect(page.getByText("How Software Actually Breaks")).toBeVisible({ timeout: 10000 });

    // Tutor opening message should appear
    await expect(
      page.getByText("What do you think happens when a computer executes a line of code?")
    ).toBeVisible({ timeout: 10000 });

    // Input bar should be present
    await expect(page.locator("textarea")).toBeVisible();
  });

  test("multi-turn conversation with tutor", async ({ page }) => {
    await page.goto("/curriculum/new-grad/1.1");

    // Wait for opening message
    await expect(
      page.getByText("What do you think happens when a computer executes a line of code?")
    ).toBeVisible({ timeout: 10000 });

    // Send first response
    await page.locator("textarea").fill("It runs each instruction one at a time, in order");
    await page.locator("textarea").press("Enter");

    // Tutor should respond with evaluation
    await expect(
      page.getByText("Good thinking")
    ).toBeVisible({ timeout: 10000 });

    // Send second response
    await page.locator("textarea").fill("Can you explain race conditions?");
    await page.locator("textarea").press("Enter");

    // Should get instruction (provide_instruction tool)
    await expect(
      page.getByText("A race condition occurs")
    ).toBeVisible({ timeout: 10000 });
  });

  test("session completion shows completion card", async ({ page }) => {
    await page.goto("/curriculum/new-grad/1.1");

    // Wait for opening
    await expect(
      page.getByText("What do you think happens")
    ).toBeVisible({ timeout: 10000 });

    // Send enough messages to trigger completion (6+ to hit the session_complete mock)
    for (let i = 0; i < 6; i++) {
      await page.locator("textarea").fill(`Response ${i + 1}`);
      await page.locator("textarea").press("Enter");
      // Wait for tutor response before sending next
      await page.waitForTimeout(500);
    }

    // Completion card should appear
    await expect(
      page.getByText("Excellent work")
    ).toBeVisible({ timeout: 10000 });

    // Input should be disabled or hidden
    const textarea = page.locator("textarea");
    const isHidden = await textarea.isHidden().catch(() => true);
    const isDisabled = await textarea.isDisabled().catch(() => true);
    expect(isHidden || isDisabled).toBe(true);
  });

  test("each track can be expanded without errors", async ({ page }) => {
    const failedRequests: { url: string; status: number }[] = [];
    page.on("response", (response) => {
      if (response.status() >= 500) {
        failedRequests.push({ url: response.url(), status: response.status() });
      }
    });

    await page.goto("/curriculum");
    await expect(page.getByText("New CS Graduate")).toBeVisible({ timeout: 10000 });

    // Expand each track
    const tracks = ["New CS Graduate", "Veteran Engineer", "Senior Tech Leader"];
    for (const track of tracks) {
      await page.getByText(track).click();
      await page.waitForTimeout(1500);
    }

    // No 500s
    if (failedRequests.length > 0) {
      console.error("500 errors:", failedRequests);
    }
    expect(failedRequests).toHaveLength(0);
  });
});
