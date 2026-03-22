import { test, expect } from "@playwright/test";

/**
 * E2E tests for CurriculumTree component in Admin page (story 57.3).
 * Tests tree rendering, collapsing, section selection, and URL state.
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
        profile: "level-1",
        sections_started: 2,
        sections_completed: 1,
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
];

const MOCK_PROGRESS_ALICE = {
  learner: {
    id: "user-001",
    display_name: "Alice Smith",
    enrolled_at: "2026-01-15T10:00:00Z",
  },
  profiles: [
    {
      profile: "level-1",
      title: "Level 1 - New Graduate",
      sections: [
        {
          section_id: "1.1",
          status: "completed",
          updated_at: "2026-03-20T12:00:00Z",
          claim_progress: {
            demonstrated: 5,
            total: 5,
            percentage: 100,
            missing: [],
          },
        },
        {
          section_id: "1.2",
          status: "in_progress",
          updated_at: "2026-03-21T14:00:00Z",
          claim_progress: {
            demonstrated: 2,
            total: 4,
            percentage: 50,
            missing: ["claim-3", "claim-4"],
          },
        },
      ],
    },
  ],
};

const MOCK_PROGRESS_BOB = {
  learner: {
    id: "user-002",
    display_name: "Bob Jones",
    enrolled_at: "2026-02-01T09:00:00Z",
  },
  profiles: [],
};

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

    page.route("**/api/admin/users/user-001/progress", async (route) => {
      const authHeader = route.request().headers()["authorization"] ?? "";
      const token = authHeader.replace("Bearer ", "");
      if (token !== VALID_ADMIN_KEY) {
        await route.fulfill({ status: 401, body: "Unauthorized" });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_PROGRESS_ALICE),
      });
    }),

    page.route("**/api/admin/users/user-002/progress", async (route) => {
      const authHeader = route.request().headers()["authorization"] ?? "";
      const token = authHeader.replace("Bearer ", "");
      if (token !== VALID_ADMIN_KEY) {
        await route.fulfill({ status: 401, body: "Unauthorized" });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_PROGRESS_BOB),
      });
    }),

    page.route("**/api/admin/users", async (route) => {
      /* Only match the exact /users endpoint, not /users/xxx/progress */
      const url = route.request().url();
      if (url.includes("/users/")) return route.fallback();

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

async function goToUsersTab(page: import("@playwright/test").Page) {
  await page.getByTestId("tab-users").click();
  await expect(page.getByTestId("users-layout")).toBeVisible();
}

test.describe("Admin CurriculumTree", () => {
  test("shows empty state when no user is selected", async ({ page }) => {
    await setupMocks(page);
    await loginAsAdmin(page);
    await goToUsersTab(page);

    await expect(page.getByTestId("curriculum-tree-empty")).toBeVisible();
    await expect(
      page.getByText("Select a user to view their progress")
    ).toBeVisible();
  });

  test("shows curriculum tree when a user with activity is selected", async ({
    page,
  }) => {
    await setupMocks(page);
    await loginAsAdmin(page);
    await goToUsersTab(page);

    await page.getByTestId("user-row-user-001").click();

    await expect(page.getByTestId("curriculum-tree")).toBeVisible();
    await expect(page.getByText("Level 1 - New Graduate")).toBeVisible();
  });

  test("shows no-activity state when user has no started curricula", async ({
    page,
  }) => {
    await setupMocks(page);
    await loginAsAdmin(page);
    await goToUsersTab(page);

    await page.getByTestId("user-row-user-002").click();

    await expect(
      page.getByTestId("curriculum-tree-no-activity")
    ).toBeVisible();
    await expect(
      page.getByText("This learner has not started any curricula")
    ).toBeVisible();
  });

  test("clicking a section updates URL with profile and section params", async ({
    page,
  }) => {
    await setupMocks(page);
    await loginAsAdmin(page);
    await goToUsersTab(page);

    await page.getByTestId("user-row-user-001").click();
    await expect(page.getByTestId("curriculum-tree")).toBeVisible();

    await page.getByTestId("section-row-1.1").click();

    await expect(page).toHaveURL(/profile=level-1/);
    await expect(page).toHaveURL(/section=1\.1/);
  });

  test("collapsing a profile hides its modules", async ({ page }) => {
    await setupMocks(page);
    await loginAsAdmin(page);
    await goToUsersTab(page);

    await page.getByTestId("user-row-user-001").click();
    await expect(page.getByTestId("curriculum-tree")).toBeVisible();
    await expect(page.getByTestId("section-row-1.1")).toBeVisible();

    /* Collapse the profile */
    await page.getByTestId("profile-header").click();

    /* Sections should be hidden */
    await expect(page.getByTestId("section-row-1.1")).not.toBeVisible();
  });

  test("URL state restores on page load with profile and section params", async ({
    page,
  }) => {
    await setupMocks(page);
    await page.goto("/admin");
    await page.evaluate((key) => {
      localStorage.setItem("softwarepilots_admin_key", key);
    }, VALID_ADMIN_KEY);

    await page.goto(
      "/admin?tab=users&user=user-001&profile=level-1&section=1.1"
    );

    await expect(page.getByTestId("curriculum-tree")).toBeVisible();

    /* The selected section should be highlighted */
    const sectionRow = page.getByTestId("section-row-1.1");
    await expect(sectionRow).toBeVisible();
  });
});
