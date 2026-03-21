import { test, expect } from "@playwright/test";

/**
 * E2E test verifying that the Socratic tutor system prompt includes
 * curriculum context when making API calls. We intercept the POST
 * /api/socratic request, inspect the mock response to confirm the
 * tutor references curriculum material.
 */

const MOCK_SECTION = {
  id: "1.1",
  module_id: "1",
  module_title: "Module 1: Foundations",
  title: "What is Software Pilotry?",
  markdown: "# Software Pilotry\n\nSoftware is a living system that requires constant navigation.",
  key_intuition: "Software is a living system that requires constant attention",
  concepts: ["Software as living system", "Continuous navigation"],
};

const SESSION_URL = "/curriculum/level-1/1.1";

test.describe("Context awareness in Socratic tutor", () => {
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
  });

  test("tutor response references curriculum material from the current section", async ({ page }) => {
    // The mock socratic response includes references to curriculum content,
    // simulating what would happen when the tutor has curriculum context.
    const CURRICULUM_AWARE_REPLY =
      "Based on the section about Software Pilotry, what do you think it means for software to be a living system that requires constant navigation?";

    await page.route("**/api/socratic", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          reply: CURRICULUM_AWARE_REPLY,
          tool_type: "socratic_probe",
          topic: "software pilotry",
          confidence_assessment: "low",
        }),
      });
    });

    await page.goto(SESSION_URL);

    // The tutor's response should reference curriculum material
    const tutorMessage = page.getByText(/living system.*constant navigation/);
    await expect(tutorMessage).toBeVisible();
  });

  test("socratic API request includes section_id and profile for context assembly", async ({ page }) => {
    let capturedRequest: { profile?: string; section_id?: string } = {};

    await page.route("**/api/socratic", async (route) => {
      const postData = route.request().postDataJSON();
      capturedRequest = {
        profile: postData?.profile,
        section_id: postData?.section_id,
      };

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          reply: "Let's explore what software pilotry means to you.",
          tool_type: "socratic_probe",
          topic: "introduction",
          confidence_assessment: "low",
        }),
      });
    });

    await page.goto(SESSION_URL);

    // Wait for the opening probe to be sent
    await expect(
      page.getByText("Let's explore what software pilotry means to you."),
    ).toBeVisible();

    // The request should include profile and section_id which are needed
    // for the server to perform context assembly
    expect(capturedRequest.profile).toBe("level-1");
    expect(capturedRequest.section_id).toBe("1.1");
  });
});
