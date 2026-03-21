import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { TopNav } from "../components/TopNav";

/* ---- Mock useAuth ---- */

const mockLearner = {
  id: "test-id",
  email: "alice@example.com",
  display_name: "Alice Smith",
  enrolled_at: "2026-01-01T00:00:00Z",
};

let mockAuthState = {
  isAuthenticated: true,
  isLoading: false,
  learner: mockLearner,
};

vi.mock("../lib/auth", () => ({
  useAuth: () => mockAuthState,
}));

/* ---- Mock useIsMobile ---- */

let mockIsMobile = false;

vi.mock("../hooks/useIsMobile", () => ({
  useIsMobile: () => mockIsMobile,
}));

/* ---- Mock apiClient (for breadcrumb progress fetch) ---- */

vi.mock("../lib/api-client", () => ({
  apiClient: {
    get: vi.fn().mockRejectedValue(new Error("not mocked")),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import { apiClient } from "../lib/api-client";

const mockGet = vi.mocked(apiClient.get);

/* ---- Helpers ---- */

function renderTopNavAtRoute(route: string, routePath?: string) {
  const path = routePath ?? route;
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path={path} element={<TopNav />} />
      </Routes>
    </MemoryRouter>,
  );
}

/* ---- Tests ---- */

beforeEach(() => {
  mockAuthState = {
    isAuthenticated: true,
    isLoading: false,
    learner: mockLearner,
  };
  mockIsMobile = false;
  mockGet.mockRejectedValue(new Error("not mocked"));
});

afterEach(cleanup);

describe("TopNav", () => {
  it("renders logo and profile icon", () => {
    renderTopNavAtRoute("/dashboard");
    expect(screen.getByTestId("nav-logo")).toBeTruthy();
    expect(screen.getByTestId("nav-profile-icon")).toBeTruthy();
  });

  it("logo links to /dashboard", () => {
    renderTopNavAtRoute("/dashboard");
    const logo = screen.getByTestId("nav-logo");
    expect(logo.getAttribute("href")).toBe("/dashboard");
  });

  it("logo renders as an img tag", () => {
    renderTopNavAtRoute("/dashboard");
    const logo = screen.getByTestId("nav-logo");
    const img = logo.querySelector("img");
    expect(img).toBeTruthy();
    expect(img!.getAttribute("alt")).toBe("Software Pilots");
  });

  it("profile icon shows first initial of learner name", () => {
    renderTopNavAtRoute("/dashboard");
    const icon = screen.getByTestId("nav-profile-icon");
    expect(icon.textContent).toBe("A");
  });

  it("profile icon shows '?' when no learner", () => {
    mockAuthState = {
      isAuthenticated: false,
      isLoading: false,
      learner: null,
    };
    renderTopNavAtRoute("/dashboard");
    const icon = screen.getByTestId("nav-profile-icon");
    expect(icon.textContent).toBe("?");
  });
});

describe("Breadcrumbs", () => {
  it("shows no breadcrumbs on /dashboard (logo handles home)", () => {
    renderTopNavAtRoute("/dashboard");
    const breadcrumbs = screen.getByTestId("breadcrumbs");
    // No breadcrumb segments rendered
    expect(breadcrumbs.textContent).toBe("");
  });

  it("shows empty breadcrumbs on /curriculum (redirects to dashboard)", () => {
    renderTopNavAtRoute("/curriculum");
    const breadcrumbs = screen.getByTestId("breadcrumbs");
    expect(breadcrumbs.textContent?.trim()).toBe("");
  });

  it("shows profile and module title on session page", () => {
    renderTopNavAtRoute(
      "/curriculum/level-1/1.1",
      "/curriculum/:profile/:sectionId",
    );
    const breadcrumbs = screen.getByTestId("breadcrumbs");
    expect(breadcrumbs.textContent).toContain("Level 1");
    // Should not contain "Home"
    expect(breadcrumbs.textContent).not.toContain("Home");
  });

  it("shows progress page breadcrumb without Home", () => {
    renderTopNavAtRoute(
      "/curriculum/level-20/progress",
      "/curriculum/:profile/progress",
    );
    const breadcrumbs = screen.getByTestId("breadcrumbs");
    expect(breadcrumbs.textContent).not.toContain("Home");
    expect(breadcrumbs.textContent).toContain("Level 20");
    expect(breadcrumbs.textContent).toContain("Progress");
  });

  it("profile is a link on progress page, Progress is current", () => {
    renderTopNavAtRoute(
      "/curriculum/level-20/progress",
      "/curriculum/:profile/progress",
    );
    const profileLink = screen.getByTestId("breadcrumb-link-0");
    expect(profileLink.getAttribute("href")).toBe("/curriculum");
    const current = screen.getByTestId("breadcrumb-current-1");
    expect(current.tagName).toBe("SPAN");
    expect(current.textContent).toBe("Progress");
  });

  it("mobile shows only current segment on session page", () => {
    mockIsMobile = true;
    renderTopNavAtRoute(
      "/curriculum/level-1/1.1",
      "/curriculum/:profile/:sectionId",
    );
    const current = screen.getByTestId("breadcrumb-current-mobile");
    expect(current.textContent).toBeTruthy();
  });

  it("mobile dashboard has no back chevron", () => {
    mockIsMobile = true;
    renderTopNavAtRoute("/dashboard");
    expect(screen.queryByLabelText("Back")).toBeNull();
  });

  it("breadcrumbs render N/M format on session page when coverage data available", async () => {
    // Mock progress API to return concepts data so coverage hook resolves
    mockGet.mockImplementation((url: string) => {
      if (url.includes("/progress")) {
        return Promise.resolve([
          {
            section_id: "1.1",
            status: "in_progress",
            concepts_json: JSON.stringify({
              concept_a: { level: "solid", next_review: "2099-01-01T00:00:00Z" },
              concept_b: { level: "developing", next_review: "2099-01-01T00:00:00Z" },
            }),
          },
        ]);
      }
      return Promise.reject(new Error("not mocked"));
    });

    renderTopNavAtRoute(
      "/curriculum/level-10/1.1",
      "/curriculum/:profile/:sectionId",
    );

    // Wait for the coverage data to load and re-render
    await waitFor(() => {
      const breadcrumbs = screen.getByTestId("breadcrumbs");
      // Should contain N/M format like "2/X" where X is total concepts
      expect(breadcrumbs.textContent).toMatch(/\d+\/\d+/);
    });
  });

  it("falls back to name only when coverage data unavailable", () => {
    // Default mockGet rejects, so coverage will be null
    renderTopNavAtRoute(
      "/curriculum/level-1/1.1",
      "/curriculum/:profile/:sectionId",
    );
    const breadcrumbs = screen.getByTestId("breadcrumbs");
    // Should show profile name without N/M format
    expect(breadcrumbs.textContent).toContain("Level 1");
    // Initially no N/M since coverage hasn't loaded (and won't due to rejection)
    expect(breadcrumbs.textContent).not.toMatch(/Level 1 \(\d+\/\d+\)/);
  });
});
