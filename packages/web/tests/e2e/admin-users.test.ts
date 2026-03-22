import { test, expect } from "@playwright/test";

/**
 * E2E tests for Admin Users tab (story 57.2).
 * Tests tab switching, three-column layout, user list, filtering, and URL state.
 */

const VALID_ADMIN_KEY = "test-admin-key-e2e";

const MOCK_LEARNER = {
  id: "test-learner",
  email: "admin@example.com",
  display_name: "Admin User",
  enrolled_at: "2026-01-01T00:00:00Z",
};

const MOCK_FEEDBACK = [
  {
    id: 1,
    profile: "level-1",
    section_id: "1.1",
    message_content: "msg",
    message_index: 0,
    feedback_text: "fb",
    created_at: "2026-03-20T12:00:00Z",
    learner_name: "Alice Smith",
  },
];

const MOCK_USERS = [
  {
    id: "user-001",
    display_name: "Alice Smith",
    email: "alice@example.com",
    enrolled_at: "2026-01-15T10:00:00Z",
    last_active_at: "2026-03-21T14:30:00Z",
    profiles: [
      {
        profile: "level-0",
        sections_started: 2,
        sections_completed: 3,
        total_sections: 8,
        claim_percentage: 45,
      },
    ],
  },
  {
    id: "user-002",
    display_name: "Bob Jones",
    email: "bob@example.com",
    enrolled_at: "2026-02-01T09:00:00Z",
    last_active_at: "2026-02-10T11:00:00Z",
    profiles: [],
  },
  {
    id: "user-003",
    display_name: "Carol Chen",
    email: "carol@example.com",
    enrolled_at: "2026-03-01T08:00:00Z",
    last_active_at: "2026-03-22T09:00:00Z",
    profiles: [
      {
        profile: "level-1",
        sections_started: 1,
        sections_completed: 0,
        total_sections: 10,
        claim_percentage: 10,
      },
      {
        profile: "level-10",
        sections_started: 0,
        sections_completed: 1,
        total_sections: 5,
        claim_percentage: 100,
      },
    ],
  },
];

async function setupMocks(page: import("@playwright/test").Page) {
  await Promise.all([
    page.route("**/api/auth/me", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_LEARNER),
      });
    }),

    page.route("**/api/admin/feedback**", async (route) => {
      const authHeader = route.request().headers()["authorization"] ?? "";
      const token = authHeader.replace("Bearer ", "");
      if (token !== VALID_ADMIN_KEY) {
        await route.fulfill({ status: 401, body: "Unauthorized" });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_FEEDBACK),
      });
    }),

    page.route("**/api/admin/users", async (route) => {
      const authHeader = route.request().headers()["authorization"] ?? "";
      const token = authHeader.replace("Bearer ", "");
      if (token !== VALID_ADMIN_KEY) {
        await route.fulfill({ status: 401, body: "Unauthorized" });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_USERS),
      });
    }),
  ]);
}

async function loginAsAdmin(page: import("@playwright/test").Page) {
  await page.goto("/admin");
  await page.getByPlaceholder("Admin key").fill(VALID_ADMIN_KEY);
  await page.getByRole("button", { name: "Enter" }).click();
  await expect(page.getByTestId("tab-feedback")).toBeVisible();
}

test.describe("Admin Users tab", () => {
  test("Users tab is visible and switchable", async ({ page }) => {
    await setupMocks(page);
    await loginAsAdmin(page);

    // Both tabs should be present
    await expect(page.getByTestId("tab-feedback")).toBeVisible();
    await expect(page.getByTestId("tab-users")).toBeVisible();

    // Switch to Users tab
    await page.getByTestId("tab-users").click();
    await expect(page.getByTestId("users-layout")).toBeVisible();
  });

  test("three-column layout renders with placeholders", async ({ page }) => {
    await setupMocks(page);
    await loginAsAdmin(page);
    await page.getByTestId("tab-users").click();

    await expect(page.getByTestId("users-layout")).toBeVisible();
    await expect(page.getByTestId("column-left")).toBeVisible();
    await expect(page.getByTestId("column-middle")).toBeVisible();
    await expect(page.getByTestId("column-right")).toBeVisible();
  });

  test("user list renders all users", async ({ page }) => {
    await setupMocks(page);
    await loginAsAdmin(page);
    await page.getByTestId("tab-users").click();

    await expect(page.getByTestId("user-list")).toBeVisible();
    await expect(page.getByTestId("user-row-user-001")).toBeVisible();
    await expect(page.getByTestId("user-row-user-002")).toBeVisible();
    await expect(page.getByTestId("user-row-user-003")).toBeVisible();
  });

  test("user with no profiles shows 'No activity yet'", async ({ page }) => {
    await setupMocks(page);
    await loginAsAdmin(page);
    await page.getByTestId("tab-users").click();

    const bobRow = page.getByTestId("user-row-user-002");
    await expect(bobRow).toBeVisible();
    await expect(bobRow.getByText("No activity yet")).toBeVisible();
  });

  test("filter bar text search filters users", async ({ page }) => {
    await setupMocks(page);
    await loginAsAdmin(page);
    await page.getByTestId("tab-users").click();
    await expect(page.getByTestId("user-list")).toBeVisible();

    await page.getByTestId("filter-search").fill("Carol");

    // Only Carol should be visible
    await expect(page.getByTestId("user-row-user-003")).toBeVisible();
    await expect(page.getByTestId("user-row-user-001")).not.toBeVisible();
    await expect(page.getByTestId("user-row-user-002")).not.toBeVisible();
  });

  test("selecting a user collapses the user list to icon rail", async ({ page }) => {
    await setupMocks(page);
    await loginAsAdmin(page);
    await page.getByTestId("tab-users").click();
    await expect(page.getByTestId("user-list")).toBeVisible();

    // Click on Alice
    await page.getByTestId("user-row-user-001").click();

    // User list should collapse to icon rail
    await expect(page.getByTestId("user-list-collapsed")).toBeVisible();
    // Full user list should not be visible
    await expect(page.getByTestId("user-list")).not.toBeVisible();
  });

  test("URL state updates when switching to Users tab", async ({ page }) => {
    await setupMocks(page);
    await loginAsAdmin(page);

    await page.getByTestId("tab-users").click();
    await expect(page).toHaveURL(/tab=users/);
  });

  test("URL state updates when selecting a user", async ({ page }) => {
    await setupMocks(page);
    await loginAsAdmin(page);
    await page.getByTestId("tab-users").click();
    await expect(page.getByTestId("user-list")).toBeVisible();

    await page.getByTestId("user-row-user-001").click();
    await expect(page).toHaveURL(/user=user-001/);
  });

  test("URL state restores on page load with params", async ({ page }) => {
    await setupMocks(page);
    // Pre-set admin key
    await page.goto("/admin");
    await page.evaluate((key) => {
      localStorage.setItem("softwarepilots_admin_key", key);
    }, VALID_ADMIN_KEY);

    // Navigate directly to users tab with a selected user
    await page.goto("/admin?tab=users&user=user-001");

    // Should show the users layout with user selected (collapsed rail)
    await expect(page.getByTestId("users-layout")).toBeVisible();
    await expect(page.getByTestId("user-list-collapsed")).toBeVisible();
  });

  test("clicking selected user again deselects and expands user list", async ({ page }) => {
    await setupMocks(page);
    await loginAsAdmin(page);
    await page.getByTestId("tab-users").click();
    await expect(page.getByTestId("user-list")).toBeVisible();

    // Select Alice
    await page.getByTestId("user-row-user-001").click();
    await expect(page.getByTestId("user-list-collapsed")).toBeVisible();

    // Click Alice's icon in collapsed rail to deselect
    // The collapsed rail shows initial letters as buttons
    const aliceIcon = page.getByTestId("user-list-collapsed").getByText("A").first();
    await aliceIcon.click();

    // Should expand back to full user list
    await expect(page.getByTestId("user-list")).toBeVisible();
  });

  test("switching from Users to Feedback tab clears user selection from URL", async ({ page }) => {
    await setupMocks(page);
    await loginAsAdmin(page);
    await page.getByTestId("tab-users").click();
    await expect(page.getByTestId("user-list")).toBeVisible();

    // Select a user
    await page.getByTestId("user-row-user-001").click();
    await expect(page).toHaveURL(/user=user-001/);

    // Switch to feedback
    await page.getByTestId("tab-feedback").click();
    await expect(page).not.toHaveURL(/user=/);
    await expect(page).toHaveURL(/tab=feedback/);
  });

  test("middle column shows selected user name placeholder", async ({ page }) => {
    await setupMocks(page);
    await loginAsAdmin(page);
    await page.getByTestId("tab-users").click();
    await expect(page.getByTestId("user-list")).toBeVisible();

    await page.getByTestId("user-row-user-001").click();

    const middleCol = page.getByTestId("column-middle");
    await expect(middleCol.getByText("Alice Smith")).toBeVisible();
  });
});
