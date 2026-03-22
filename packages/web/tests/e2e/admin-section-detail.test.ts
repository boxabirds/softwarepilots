import { test, expect } from "@playwright/test";

/**
 * E2E tests for Admin SectionDetail component (story 57.4).
 * Tests section detail rendering, conversation history, claim/concept display,
 * tabs, empty states, and session banners.
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
        sections_completed: 1,
        total_sections: 8,
        claim_percentage: 45,
      },
    ],
  },
];

const MOCK_USER_PROGRESS = {
  learner: {
    id: "user-001",
    display_name: "Alice Smith",
    enrolled_at: "2026-01-15T10:00:00Z",
  },
  profiles: [
    {
      profile: "level-0",
      title: "Level 0",
      sections: [
        {
          section_id: "1.1",
          status: "in_progress",
          updated_at: "2026-03-22T14:30:00Z",
          understanding_level: "developing",
          concepts_json: null,
          claims_json: null,
          claim_progress: {
            demonstrated: 0,
            total: 0,
            percentage: 0,
            missing: [],
          },
        },
      ],
    },
  ],
};

const MOCK_CONVERSATIONS = {
  conversations: [
    {
      id: "conv-active",
      messages: [
        { role: "user", content: "What is a variable?", timestamp: "2026-03-22T14:30:00Z" },
        { role: "assistant", content: "A variable is a named storage location.", timestamp: "2026-03-22T14:30:22Z" },
      ],
      summary: null,
      archived_at: null,
      created_at: "2026-03-22T14:00:00Z",
    },
    {
      id: "conv-archived",
      messages: [
        { role: "user", content: "Tell me about loops", timestamp: "2026-03-21T10:00:00Z" },
        { role: "assistant", content: "Loops repeat code blocks.", timestamp: "2026-03-21T10:01:00Z" },
      ],
      summary: "Covered basics of loop constructs.",
      archived_at: "2026-03-21T11:00:00Z",
      created_at: "2026-03-21T09:00:00Z",
    },
  ],
};

const MOCK_SECTION_EVENTS = {
  status: "in_progress",
  understanding_json: JSON.stringify([
    { understanding_level: "developing", confidence_assessment: "medium", timestamp: "2026-03-22T14:00:00Z" },
    { understanding_level: "solid", confidence_assessment: "high", timestamp: "2026-03-22T14:25:00Z" },
  ]),
  claims_json: JSON.stringify({
    "claim-1": { level: "developing", timestamp: "2026-03-22T14:10:00Z" },
    "claim-2": { level: "solid", timestamp: "2026-03-22T14:20:00Z" },
  }),
  concepts_json: JSON.stringify({
    "variables": { level: "developing", review_count: 2, next_review: "2026-03-25T00:00:00Z" },
  }),
  started_at: "2026-03-22T13:55:00Z",
  completed_at: null,
  paused_at: null,
  updated_at: "2026-03-22T14:30:00Z",
};

const MOCK_SECTION_EVENTS_COMPLETED = {
  status: "completed",
  understanding_json: JSON.stringify([
    { understanding_level: "developing", timestamp: "2026-03-22T14:00:00Z" },
    { final_understanding: "solid", concepts_covered: ["loops", "arrays"], timestamp: "2026-03-22T14:30:00Z" },
  ]),
  claims_json: JSON.stringify({
    "claim-1": { level: "solid", timestamp: "2026-03-22T14:15:00Z" },
  }),
  concepts_json: "{}",
  started_at: "2026-03-22T13:55:00Z",
  completed_at: "2026-03-22T14:30:00Z",
  paused_at: null,
  updated_at: "2026-03-22T14:30:00Z",
};

const MOCK_SECTION_EVENTS_EMPTY = {
  status: "not_started",
  understanding_json: "[]",
  claims_json: "{}",
  concepts_json: "{}",
  started_at: null,
  completed_at: null,
  paused_at: null,
  updated_at: null,
};

async function setupMocks(page: import("@playwright/test").Page, sectionEvents = MOCK_SECTION_EVENTS) {
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

    page.route("**/api/admin/users/*/progress", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_USER_PROGRESS),
      });
    }),

    page.route("**/api/admin/users/*/section-events/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(sectionEvents),
      });
    }),

    page.route("**/api/admin/users/*/conversations/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_CONVERSATIONS),
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

async function loginAndNavigateToSection(page: import("@playwright/test").Page) {
  await page.goto("/admin");
  await page.evaluate((key) => {
    localStorage.setItem("softwarepilots_admin_key", key);
  }, VALID_ADMIN_KEY);
  // Navigate directly with URL params for section selected
  await page.goto("/admin?tab=users&user=user-001&profile=level-0&section=1.1");
}

test.describe("Admin SectionDetail", () => {
  test("renders section detail when section is selected via URL", async ({ page }) => {
    await setupMocks(page);
    await loginAndNavigateToSection(page);

    await expect(page.getByTestId("section-detail")).toBeVisible();
    // Section ID appears in the detail header (use heading role to disambiguate)
    await expect(page.getByRole("heading", { name: "1.1" })).toBeVisible();
    await expect(page.getByTestId("section-detail").getByText("level-0")).toBeVisible();
  });

  test("shows Conversation and Events tabs", async ({ page }) => {
    await setupMocks(page);
    await loginAndNavigateToSection(page);

    await expect(page.getByTestId("section-tab-conversation")).toBeVisible();
    await expect(page.getByTestId("section-tab-events")).toBeVisible();
  });

  test("displays conversation messages with sender labels", async ({ page }) => {
    await setupMocks(page);
    await loginAndNavigateToSection(page);

    await expect(page.getByText("What is a variable?")).toBeVisible();
    await expect(page.getByText("A variable is a named storage location.")).toBeVisible();

    // Check sender labels
    const learnerLabels = page.getByText("Learner");
    await expect(learnerLabels.first()).toBeVisible();
    const tutorLabels = page.getByText("Tutor");
    await expect(tutorLabels.first()).toBeVisible();
  });

  test("shows ISO timestamps on messages", async ({ page }) => {
    await setupMocks(page);
    await loginAndNavigateToSection(page);

    await expect(page.getByText("2026-03-22 14:30:00")).toBeVisible();
    await expect(page.getByText("2026-03-22 14:30:22")).toBeVisible();
  });

  test("active session shows Current session header", async ({ page }) => {
    await setupMocks(page);
    await loginAndNavigateToSection(page);

    const activeConv = page.getByTestId("conversation-conv-active");
    await expect(activeConv).toBeVisible();
    await expect(activeConv.getByText("Current session")).toBeVisible();
  });

  test("archived session with summary shows collapsible summary banner", async ({ page }) => {
    await setupMocks(page);
    await loginAndNavigateToSection(page);

    const archivedConv = page.getByTestId("conversation-conv-archived");
    await expect(archivedConv).toBeVisible();
    await expect(archivedConv.getByText("Session Summary")).toBeVisible();
    await expect(archivedConv.getByText("Covered basics of loop constructs.")).toBeVisible();
    await expect(archivedConv.getByText("Archived session")).toBeVisible();
  });

  test("Events tab shows event log with timeline", async ({ page }) => {
    await setupMocks(page);
    await loginAndNavigateToSection(page);

    await page.getByTestId("section-tab-events").click();
    await expect(page.getByTestId("event-log")).toBeVisible();

    // Should show status badge
    await expect(page.getByText("in_progress")).toBeVisible();

    // Should show understanding events
    await expect(page.getByText(/Understanding assessed: developing/)).toBeVisible();
    await expect(page.getByText(/Understanding assessed: solid/)).toBeVisible();

    // Should show claim events
    await expect(page.getByText(/Claim demonstrated: claim-1 at developing/)).toBeVisible();
    await expect(page.getByText(/Claim demonstrated: claim-2 at solid/)).toBeVisible();

    // Should show concept events
    await expect(page.getByText(/Concept assessed: variables at developing/)).toBeVisible();

    // Should show started event
    await expect(page.getByText(/Section started/)).toBeVisible();
  });

  test("Events tab shows completed session with final understanding", async ({ page }) => {
    await setupMocks(page, MOCK_SECTION_EVENTS_COMPLETED);
    await loginAndNavigateToSection(page);

    await page.getByTestId("section-tab-events").click();
    await expect(page.getByTestId("event-log")).toBeVisible();

    // Should show completed status
    await expect(page.getByText("completed").first()).toBeVisible();

    // Should show session completed event
    await expect(page.getByText(/Session completed: solid understanding/)).toBeVisible();
    await expect(page.getByText(/covered: loops, arrays/)).toBeVisible();
  });

  test("Events tab shows empty state for not_started section", async ({ page }) => {
    await setupMocks(page, MOCK_SECTION_EVENTS_EMPTY);
    await loginAndNavigateToSection(page);

    await page.getByTestId("section-tab-events").click();
    await expect(page.getByTestId("no-events")).toBeVisible();
    await expect(page.getByText("No events recorded for this section")).toBeVisible();
  });

  test("Events are sorted newest first", async ({ page }) => {
    await setupMocks(page);
    await loginAndNavigateToSection(page);

    await page.getByTestId("section-tab-events").click();
    await expect(page.getByTestId("event-log")).toBeVisible();

    // Get all event timestamps and verify descending order
    const timestamps = await page.locator("[data-testid^='event-'] .font-mono").allTextContents();
    expect(timestamps.length).toBeGreaterThan(0);
    for (let i = 1; i < timestamps.length; i++) {
      const prev = new Date(timestamps[i - 1].replace(" ", "T") + "Z").getTime();
      const curr = new Date(timestamps[i].replace(" ", "T") + "Z").getTime();
      expect(prev).toBeGreaterThanOrEqual(curr);
    }
  });

  test("Tutor messages show context metadata note", async ({ page }) => {
    await setupMocks(page);
    await loginAndNavigateToSection(page);

    // Find the tutor context collapsible and expand it
    const tutorContextBtn = page.getByText("Tutor context").first();
    await expect(tutorContextBtn).toBeVisible();
    await tutorContextBtn.click();

    // Should show the unavailability note
    await expect(page.getByText(/Per-message tutor metadata is not available/)).toBeVisible();
    await expect(page.getByText(/See the Events tab/)).toBeVisible();
  });

  test("shows 'Select a section' when no section in URL", async ({ page }) => {
    await setupMocks(page);
    await page.goto("/admin");
    await page.evaluate((key) => {
      localStorage.setItem("softwarepilots_admin_key", key);
    }, VALID_ADMIN_KEY);
    await page.goto("/admin?tab=users&user=user-001");

    await expect(page.getByTestId("column-right")).toBeVisible();
    await expect(page.getByText("Select a section to view details")).toBeVisible();
  });
});
