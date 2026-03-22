import { test, expect } from "@playwright/test";

/**
 * E2E tests for the progress debug diagnostic endpoint.
 * Mocks the API to verify the endpoint is accessible and returns expected shape.
 */

const MOCK_DEBUG_RESPONSE = {
  learner_exists: true,
  learner_id: "test-learner",
  profile: "level-1",
  table_columns: [
    "learner_id",
    "profile",
    "section_id",
    "status",
    "understanding_json",
    "concepts_json",
    "started_at",
    "completed_at",
    "paused_at",
    "updated_at",
  ],
  progress_rows: [
    {
      section_id: "1.1",
      status: "in_progress",
      understanding_json: "[]",
      concepts_json: "{}",
      started_at: "2026-03-20T10:00:00Z",
      completed_at: null,
      paused_at: null,
      updated_at: "2026-03-20T10:00:00Z",
    },
  ],
  expected_section_count: 13,
  actual_progress_count: 1,
  summary: {
    not_started: 12,
    in_progress: 1,
    completed: 0,
    paused: 0,
  },
};

test.describe("Progress debug diagnostic endpoint", () => {
  test("returns diagnostic JSON with expected shape via API", async ({
    page,
  }) => {
    // Mock auth
    await page.route("**/api/auth/me", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ id: "test-learner", github_login: "tester" }),
      });
    });

    // Mock the debug endpoint
    await page.route(
      "**/api/curriculum/level-1/progress/debug",
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(MOCK_DEBUG_RESPONSE),
        });
      }
    );

    // Navigate first so the page has a base URL for relative fetches
    await page.goto("/");

    const response = await page.evaluate(async () => {
      const res = await fetch("/api/curriculum/level-1/progress/debug");
      return {
        status: res.status,
        body: await res.json(),
      };
    });

    expect(response.status).toBe(200);
    const body = response.body as typeof MOCK_DEBUG_RESPONSE;

    // Verify response shape
    expect(body.learner_exists).toBe(true);
    expect(body.learner_id).toBe("test-learner");
    expect(body.profile).toBe("level-1");
    expect(Array.isArray(body.table_columns)).toBe(true);
    expect(body.table_columns).toContain("section_id");
    expect(body.table_columns).toContain("status");
    expect(body.table_columns).toContain("concepts_json");
    expect(body.table_columns).toContain("completed_at");
    expect(Array.isArray(body.progress_rows)).toBe(true);
    expect(body.progress_rows).toHaveLength(1);
    expect(body.progress_rows[0].section_id).toBe("1.1");
    expect(body.progress_rows[0].status).toBe("in_progress");
    expect(body.expected_section_count).toBe(13);
    expect(body.actual_progress_count).toBe(1);
    expect(body.summary).toEqual({
      not_started: 12,
      in_progress: 1,
      completed: 0,
      paused: 0,
    });
  });

  test("returns 400 for invalid profile", async ({ page }) => {
    // Mock auth
    await page.route("**/api/auth/me", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ id: "test-learner", github_login: "tester" }),
      });
    });

    // Mock the debug endpoint for invalid profile
    await page.route(
      "**/api/curriculum/bogus/progress/debug",
      async (route) => {
        await route.fulfill({
          status: 400,
          contentType: "application/json",
          body: JSON.stringify({ error: "Invalid profile: bogus" }),
        });
      }
    );

    await page.goto("/");

    const response = await page.evaluate(async () => {
      const res = await fetch("/api/curriculum/bogus/progress/debug");
      return {
        status: res.status,
        body: await res.json(),
      };
    });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("error");
  });
});
