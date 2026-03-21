import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
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

  it("shows full 'Software Pilots' text on desktop", () => {
    mockIsMobile = false;
    renderTopNavAtRoute("/dashboard");
    expect(screen.getByText("Software Pilots")).toBeTruthy();
  });

  it("hides 'Software Pilots' text on mobile (icon only)", () => {
    mockIsMobile = true;
    renderTopNavAtRoute("/dashboard");
    expect(screen.queryByText("Software Pilots")).toBeNull();
    // SP icon still present
    expect(screen.getByText("SP")).toBeTruthy();
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
  it("shows 'Home' on /dashboard", () => {
    renderTopNavAtRoute("/dashboard");
    expect(screen.getByText("Home")).toBeTruthy();
  });

  it("shows 'Home > Curriculum' on /curriculum", () => {
    renderTopNavAtRoute("/curriculum");
    const breadcrumbs = screen.getByTestId("breadcrumbs");
    expect(breadcrumbs.textContent).toContain("Home");
    expect(breadcrumbs.textContent).toContain("Curriculum");
  });

  it("Home is a link on /curriculum, Curriculum is not", () => {
    renderTopNavAtRoute("/curriculum");
    const homeLink = screen.getByTestId("breadcrumb-link-0");
    expect(homeLink.getAttribute("href")).toBe("/dashboard");
    // Current segment is not a link
    const current = screen.getByTestId("breadcrumb-current-1");
    expect(current.tagName).toBe("SPAN");
    expect(current.textContent).toBe("Curriculum");
  });

  it("shows full path on session page", () => {
    renderTopNavAtRoute(
      "/curriculum/new-grad/1.1",
      "/curriculum/:profile/:sectionId",
    );
    const breadcrumbs = screen.getByTestId("breadcrumbs");
    expect(breadcrumbs.textContent).toContain("Home");
    expect(breadcrumbs.textContent).toContain("New Grad");
  });

  it("shows progress page breadcrumb", () => {
    renderTopNavAtRoute(
      "/curriculum/senior-leader/progress",
      "/curriculum/:profile/progress",
    );
    const breadcrumbs = screen.getByTestId("breadcrumbs");
    expect(breadcrumbs.textContent).toContain("Home");
    expect(breadcrumbs.textContent).toContain("Senior Leader");
    expect(breadcrumbs.textContent).toContain("Progress");
  });

  it("current segment (last) is not a link", () => {
    renderTopNavAtRoute("/dashboard");
    const current = screen.getByTestId("breadcrumb-current-0");
    expect(current.tagName).toBe("SPAN");
  });

  it("mobile shows only current segment with back chevron", () => {
    mockIsMobile = true;
    renderTopNavAtRoute("/curriculum");
    const current = screen.getByTestId("breadcrumb-current-mobile");
    expect(current.textContent).toBe("Curriculum");
    // Back chevron should be present
    expect(screen.getByLabelText("Back")).toBeTruthy();
  });

  it("mobile dashboard has no back chevron", () => {
    mockIsMobile = true;
    renderTopNavAtRoute("/dashboard");
    expect(screen.queryByLabelText("Back")).toBeNull();
  });
});
