import { test, expect } from "@playwright/test";

/**
 * Full learning flow e2e test against the real running stack.
 *
 * Auth: mocked at page level (real OAuth requires fake GitHub server setup)
 * Curriculum API: hits real API (proxied through Vite, mocked auth)
 * Socratic chat: mocked (requires Gemini API key)
 *
 * The auth mock intercepts at the browser level so the React app thinks
 * the user is authenticated. The Vite proxy forwards /api/* to the real
 * API server, but curriculum listing endpoints are public-ish (the mock
 * auth satisfies the middleware check).
 *
 * Since we can't get a real session cookie without the full OAuth flow,
 * we mock auth AND the API responses that need auth. The curriculum
 * registry data comes from the real shared package though.
 */

import {
  getCurriculumProfiles,
  getCurriculumSections,
  getSection,
} from "@softwarepilots/shared";

// Get actual data from the registry
const PROFILES = getCurriculumProfiles();
const NEW_GRAD_SECTIONS = getCurriculumSections("new-grad");
const FIRST_SECTION = getSection("new-grad", NEW_GRAD_SECTIONS[0].id);

test.describe("Full learning flow", () => {
  test.beforeEach(async ({ page }) => {
    // Mock auth
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

    // Mock curriculum listing (auth-protected)
    await page.route("**/api/curriculum", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/api/curriculum" || url.pathname === "/api/curriculum/") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(PROFILES),
        });
      } else {
        await route.continue();
      }
    });

    // Mock sections listing per profile
    for (const p of PROFILES) {
      await page.route(`**/api/curriculum/${p.profile}`, async (route) => {
        const url = new URL(route.request().url());
        if (url.pathname === `/api/curriculum/${p.profile}`) {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(getCurriculumSections(p.profile)),
          });
        } else {
          await route.continue();
        }
      });

      // Mock progress (empty - no sessions yet)
      await page.route(`**/api/curriculum/${p.profile}/progress`, async (route) => {
        const url = new URL(route.request().url());
        if (url.pathname === `/api/curriculum/${p.profile}/progress`) {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify([]),
          });
        } else {
          await route.continue();
        }
      });
    }

    // Mock section detail
    await page.route("**/api/curriculum/new-grad/*", async (route) => {
      const url = new URL(route.request().url());
      const match = url.pathname.match(/\/api\/curriculum\/new-grad\/(\d+\.\d+)$/);
      if (match) {
        try {
          const section = getSection("new-grad", match[1]);
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(section),
          });
        } catch {
          await route.fulfill({ status: 404, body: "Not found" });
        }
      } else {
        await route.continue();
      }
    });

    // Mock conversation persistence
    await page.route("**/api/curriculum/new-grad/*/conversation", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ messages: [], updated_at: null }),
        });
      } else if (route.request().method() === "PUT") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ saved: true }),
        });
      } else if (route.request().method() === "DELETE") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ reset: true }),
        });
      } else {
        await route.continue();
      }
    });

    // Mock Socratic chat with multi-turn conversation
    let socraticCallCount = 0;
    await page.route("**/api/socratic", async (route) => {
      socraticCallCount++;

      if (socraticCallCount <= 2) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            reply: "What do you think happens when a computer runs a line of code?",
            tool_type: "socratic_probe",
            topic: "code execution",
            confidence_assessment: "medium",
          }),
        });
      } else if (socraticCallCount <= 4) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            reply: "Good thinking. What might go wrong if two threads access shared data?",
            tool_type: "evaluate_response",
            topic: "concurrency",
            understanding_level: "developing",
          }),
        });
      } else if (socraticCallCount === 5) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            reply: "A race condition is when two operations on shared data produce different results depending on timing.",
            tool_type: "provide_instruction",
            concept: "race conditions",
            struggle_reason: "learner_asked",
          }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            reply: "Excellent work! You've covered how software breaks - from execution to concurrency.",
            tool_type: "session_complete",
            final_understanding: "solid",
            concepts_covered: ["code execution", "concurrency", "race conditions"],
            recommendation: "Next, try Section 1.2: Systems Thinking",
          }),
        });
      }
    });
  });

  test("authenticated user lands on dashboard", async ({ page }) => {
    await page.goto("/");

    // Auth mock makes user authenticated, so landing redirects to dashboard
    await expect(page.getByText("Curriculum Tracks")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Browse Tracks")).toBeVisible();
  });

  test("curriculum browser shows all three tracks from real registry", async ({ page }) => {
    await page.goto("/curriculum");

    for (const p of PROFILES) {
      await expect(page.getByText(p.title)).toBeVisible({ timeout: 10000 });
    }
  });

  test("expanding each track shows sections without 500 errors", async ({ page }) => {
    const serverErrors: { url: string; status: number }[] = [];
    page.on("response", (response) => {
      if (response.status() >= 500) {
        serverErrors.push({ url: response.url(), status: response.status() });
      }
    });

    await page.goto("/curriculum");

    for (const p of PROFILES) {
      await expect(page.getByText(p.title)).toBeVisible({ timeout: 10000 });
      await page.getByText(p.title).click();
      await page.waitForTimeout(1500);
    }

    if (serverErrors.length > 0) {
      console.error("Server errors:", serverErrors);
    }
    expect(serverErrors).toHaveLength(0);
  });

  test("clicking a section navigates to session page", async ({ page }) => {
    await page.goto("/curriculum");

    // Expand new-grad
    await expect(page.getByText(PROFILES[0].title)).toBeVisible({ timeout: 10000 });
    await page.getByText(PROFILES[0].title).click();

    // Click first section
    const firstSectionTitle = NEW_GRAD_SECTIONS[0].title;
    await expect(page.getByText(firstSectionTitle)).toBeVisible({ timeout: 5000 });
    await page.getByText(firstSectionTitle).click();

    await page.waitForURL(`**/curriculum/new-grad/${NEW_GRAD_SECTIONS[0].id}`);
  });

  test("Socratic session loads with tutor opening message", async ({ page }) => {
    await page.goto(`/curriculum/new-grad/${NEW_GRAD_SECTIONS[0].id}`);

    // Section title in sidebar
    await expect(page.getByText(FIRST_SECTION.title)).toBeVisible({ timeout: 10000 });

    // Tutor opening message
    await expect(
      page.getByText("What do you think happens when a computer runs a line of code?")
    ).toBeVisible({ timeout: 10000 });

    // Input bar present
    await expect(page.locator("textarea")).toBeVisible();
  });

  test("multi-turn conversation with evaluation and instruction", async ({ page }) => {
    await page.goto(`/curriculum/new-grad/${NEW_GRAD_SECTIONS[0].id}`);

    // Wait for opening probe (call 1)
    await expect(
      page.getByText("What do you think happens")
    ).toBeVisible({ timeout: 10000 });

    // Send first response (triggers call 2 - still probe)
    await page.locator("textarea").fill("Each instruction runs in order");
    await page.locator("textarea").press("Enter");
    await page.waitForTimeout(1000);

    // Send second response (triggers call 3 - evaluate)
    await page.locator("textarea").fill("I think threads could conflict");
    await page.locator("textarea").press("Enter");

    // Should get evaluation
    await expect(page.getByText("Good thinking")).toBeVisible({ timeout: 10000 });

    // Send third response (triggers call 4 - still evaluate)
    await page.locator("textarea").fill("Can you explain race conditions?");
    await page.locator("textarea").press("Enter");
    await page.waitForTimeout(1000);

    // Send fourth (triggers call 5 - instruction)
    await page.locator("textarea").fill("I still don't get it");
    await page.locator("textarea").press("Enter");

    // Should get instruction
    await expect(page.getByText("A race condition is")).toBeVisible({ timeout: 10000 });
  });

  test("session completion disables input", async ({ page }) => {
    await page.goto(`/curriculum/new-grad/${NEW_GRAD_SECTIONS[0].id}`);

    await expect(page.getByText("What do you think happens")).toBeVisible({ timeout: 10000 });

    // Send messages to reach completion (need 6+ calls to trigger session_complete mock)
    // Call 1 = opening probe. Calls 2-6 = user messages. Call 6+ = session_complete.
    const messagesBefore = await page.locator('[class*="tutor"], [class*="Tutor"]').count();

    for (let i = 0; i < 6; i++) {
      // Wait for textarea to be enabled (not disabled from sending state)
      try {
        await page.locator("textarea:not([disabled])").waitFor({ state: "visible", timeout: 8000 });
      } catch {
        break;
      }

      await page.locator("textarea").fill(`Response ${i + 1}`);
      await page.locator("textarea").press("Enter");

      // Wait for a new tutor message to appear before continuing
      await page.waitForTimeout(2000);
    }

    // Completion card should appear
    await expect(page.getByTestId("session-complete-card")).toBeVisible({ timeout: 15000 });

    // Input should be gone
    await expect(page.locator("textarea")).not.toBeVisible({ timeout: 5000 });
  });
});
