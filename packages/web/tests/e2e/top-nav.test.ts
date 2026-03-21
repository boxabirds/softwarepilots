import { test, expect } from "@playwright/test";

/**
 * E2E tests for TopNav component with breadcrumb navigation.
 * Mocks the auth session and API responses to avoid needing a live backend.
 */

const MOCK_LEARNER = {
  id: "test-learner",
  email: "alice@example.com",
  display_name: "Alice Smith",
  enrolled_at: "2026-01-01T00:00:00Z",
};

const MOCK_PROFILES = [
  {
    profile: "level-1",
    title: "New Graduate",
    starting_position: "Fresh from bootcamp or CS degree",
    module_count: 3,
    section_count: 12,
  },
];

const MOCK_SECTIONS = [
  {
    id: "1.1",
    module_id: "1",
    module_title: "Module 1: Foundations",
    title: "What is Software Pilotry?",
    key_intuition: "Software is a living system",
  },
  {
    id: "1.2",
    module_id: "1",
    module_title: "Module 1: Foundations",
    title: "The Pilot Mindset",
    key_intuition: "Pilots observe before acting",
  },
];

const MOCK_PROGRESS = [
  { section_id: "1.1", status: "completed", updated_at: "2026-03-20T10:00:00Z" },
  { section_id: "1.2", status: "not_started", updated_at: "2026-03-20T09:00:00Z" },
];

test.describe("TopNav", () => {
  test.beforeEach(async ({ page }) => {
    // Mock auth
    await page.route("**/api/auth/me", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_LEARNER),
      });
    });

    // Mock curriculum profiles listing
    await page.route("**/api/curriculum", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/api/curriculum") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(MOCK_PROFILES),
        });
      } else {
        await route.continue();
      }
    });

    // Mock sections for level-1
    await page.route("**/api/curriculum/level-1", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/api/curriculum/level-1") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(MOCK_SECTIONS),
        });
      } else {
        await route.continue();
      }
    });

    // Mock progress
    await page.route("**/api/curriculum/level-1/progress", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/api/curriculum/level-1/progress") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(MOCK_PROGRESS),
        });
      } else {
        await route.continue();
      }
    });

    // Mock section metadata (for SocraticSession page)
    await page.route("**/api/curriculum/level-1/1.1", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/api/curriculum/level-1/1.1") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            id: "1.1",
            title: "What is Software Pilotry?",
            module_id: "1",
            module_title: "Module 1: Foundations",
            markdown: "# Test content",
            key_intuition: "Key insight here",
          }),
        });
      } else {
        await route.continue();
      }
    });

    // Mock conversation endpoint (empty)
    await page.route("**/api/curriculum/level-1/1.1/conversation", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ messages: [], updated_at: null }),
      });
    });

    // Mock socratic endpoint
    await page.route("**/api/socratic", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          reply: "Welcome! Let's explore this topic together.",
          tool_type: "socratic_probe",
        }),
      });
    });
  });

  test("nav bar is visible on dashboard", async ({ page }) => {
    await page.goto("/dashboard");
    const nav = page.getByTestId("top-nav");
    await expect(nav).toBeVisible();
    // Logo should be visible
    await expect(page.getByTestId("nav-logo")).toBeVisible();
    // Profile icon with initial 'A' (Alice)
    const profileIcon = page.getByTestId("nav-profile-icon");
    await expect(profileIcon).toBeVisible();
    await expect(profileIcon).toContainText("A");
  });

  test("breadcrumb shows Home on dashboard", async ({ page }) => {
    await page.goto("/dashboard");
    const breadcrumbs = page.getByTestId("breadcrumbs");
    await expect(breadcrumbs).toContainText("Home");
  });

  test("navigate to curriculum page, breadcrumb updates", async ({ page }) => {
    await page.goto("/curriculum");
    const breadcrumbs = page.getByTestId("breadcrumbs");
    await expect(breadcrumbs).toContainText("Home");
    await expect(breadcrumbs).toContainText("Curriculum");
  });

  test("navigate to a section, full breadcrumb path shown", async ({ page }) => {
    await page.goto("/curriculum/level-1/1.1");
    const breadcrumbs = page.getByTestId("breadcrumbs");
    await expect(breadcrumbs).toContainText("Home");
    await expect(breadcrumbs).toContainText("New Grad");
  });

  test("clicking Home breadcrumb navigates to dashboard", async ({ page }) => {
    await page.goto("/curriculum");
    // Click the Home breadcrumb link
    const homeLink = page.getByTestId("breadcrumb-link-0");
    await expect(homeLink).toContainText("Home");
    await homeLink.click();
    await page.waitForURL("**/dashboard");
    expect(page.url()).toContain("/dashboard");
  });

  test("logo links to dashboard", async ({ page }) => {
    await page.goto("/curriculum");
    const logo = page.getByTestId("nav-logo");
    await logo.click();
    await page.waitForURL("**/dashboard");
    expect(page.url()).toContain("/dashboard");
  });
});
