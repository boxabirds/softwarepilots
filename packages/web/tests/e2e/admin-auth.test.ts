import { test, expect } from "@playwright/test";

/**
 * E2E tests for admin page authentication gate.
 * Mocks API responses to test the login/logout/401 flows.
 */

const VALID_ADMIN_KEY = "test-admin-key-e2e";

const MOCK_LEARNER = {
  id: "test-learner",
  email: "alice@example.com",
  display_name: "Alice Smith",
  enrolled_at: "2026-01-01T00:00:00Z",
};

const MOCK_FEEDBACK = [
  {
    id: 1,
    profile: "level-1",
    section_id: "1.1",
    message_content: "This is a tutor message",
    message_index: 0,
    feedback_text: "Great explanation",
    created_at: "2026-03-20T12:00:00Z",
    learner_name: "Alice Smith",
  },
];

function setupMocks(page: import("@playwright/test").Page) {
  return Promise.all([
    // Mock learner session (required by AuthGuard)
    page.route("**/api/auth/me", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_LEARNER),
      });
    }),

    // Mock admin feedback endpoint - validates Bearer token
    page.route("**/api/admin/feedback**", async (route) => {
      const authHeader = route.request().headers()["authorization"] ?? "";
      const token = authHeader.replace("Bearer ", "");

      if (token !== VALID_ADMIN_KEY) {
        await route.fulfill({ status: 401, body: "Unauthorized" });
        return;
      }

      if (route.request().method() === "DELETE") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ deleted: true }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_FEEDBACK),
      });
    }),
  ]);
}

test.describe("Admin authentication gate", () => {
  test("shows login form when no admin key is stored", async ({ page }) => {
    await setupMocks(page);
    await page.goto("/admin");

    await expect(page.getByText("Admin Access")).toBeVisible();
    await expect(page.getByPlaceholder("Admin key")).toBeVisible();
    // Feedback table should NOT be visible
    await expect(page.getByTestId("feedback-table")).not.toBeVisible();
  });

  test("shows error on invalid admin key", async ({ page }) => {
    await setupMocks(page);
    await page.goto("/admin");

    await page.getByPlaceholder("Admin key").fill("wrong-key");
    await page.getByRole("button", { name: "Enter" }).click();

    await expect(page.getByText("Invalid admin key")).toBeVisible();
    // Still on login form
    await expect(page.getByPlaceholder("Admin key")).toBeVisible();
  });

  test("grants access with valid admin key and shows feedback", async ({ page }) => {
    await setupMocks(page);
    await page.goto("/admin");

    await page.getByPlaceholder("Admin key").fill(VALID_ADMIN_KEY);
    await page.getByRole("button", { name: "Enter" }).click();

    // Should see the feedback table
    await expect(page.getByTestId("feedback-table")).toBeVisible();
    await expect(page.getByText("Great explanation")).toBeVisible();
    // Login form should be gone
    await expect(page.getByPlaceholder("Admin key")).not.toBeVisible();
  });

  test("logout clears key and returns to login form", async ({ page }) => {
    await setupMocks(page);
    await page.goto("/admin");

    // Login
    await page.getByPlaceholder("Admin key").fill(VALID_ADMIN_KEY);
    await page.getByRole("button", { name: "Enter" }).click();
    await expect(page.getByTestId("feedback-table")).toBeVisible();

    // Logout
    await page.getByTestId("admin-logout").click();

    // Should see login form again
    await expect(page.getByText("Admin Access")).toBeVisible();
    await expect(page.getByPlaceholder("Admin key")).toBeVisible();
  });

  test("auto-clears stale key and shows login form", async ({ page }) => {
    await setupMocks(page);

    // Pre-set a stale key in localStorage before navigating
    await page.goto("/admin");
    await page.evaluate((key) => {
      localStorage.setItem("softwarepilots_admin_key", key);
    }, "stale-invalid-key");

    // Reload - the stale key should be tested against the API and rejected
    await page.reload();

    // Should be back on login form after 401
    await expect(page.getByText("Admin Access")).toBeVisible();
    await expect(page.getByPlaceholder("Admin key")).toBeVisible();
  });

  test("remembers valid key across page navigations", async ({ page }) => {
    await setupMocks(page);
    await page.goto("/admin");

    // Login
    await page.getByPlaceholder("Admin key").fill(VALID_ADMIN_KEY);
    await page.getByRole("button", { name: "Enter" }).click();
    await expect(page.getByTestId("feedback-table")).toBeVisible();

    // Navigate away and back
    await page.goto("/dashboard");
    await page.goto("/admin");

    // Should load directly without login prompt
    await expect(page.getByTestId("feedback-table")).toBeVisible();
    await expect(page.getByPlaceholder("Admin key")).not.toBeVisible();
  });
});
