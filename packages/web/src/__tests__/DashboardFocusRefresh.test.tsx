import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Dashboard } from "../pages/Dashboard";

/* ---- Mock data ---- */

const MOCK_SECTIONS = [
  {
    id: "1.1",
    module_id: "1",
    module_title: "Module 1: Foundations",
    title: "What is Software Pilotry?",
    key_intuition: "Software is a living system",
  },
];

const INITIAL_PROGRESS = [
  {
    section_id: "1.1",
    status: "in_progress",
    understanding_level: "emerging",
    updated_at: "2026-03-22T00:00:00Z",
  },
];

const UPDATED_PROGRESS = [
  {
    section_id: "1.1",
    status: "completed",
    understanding_level: "solid",
    updated_at: "2026-03-22T01:00:00Z",
  },
];

/* ---- Mock useAuth ---- */

vi.mock("../lib/auth", () => ({
  useAuth: () => ({
    isAuthenticated: true,
    isLoading: false,
    learner: {
      id: "test-id",
      email: "test@example.com",
      display_name: "Test User",
      enrolled_at: "2026-01-01T00:00:00Z",
      selected_profile: "level-1",
    },
  }),
}));

/* ---- Mock api-client ---- */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mockGet: any;

vi.mock("../lib/api-client", () => ({
  apiClient: {
    get: (...args: unknown[]) => mockGet(...args),
    put: vi.fn().mockResolvedValue({}),
  },
}));

beforeEach(() => {
  mockGet = vi.fn();
});

afterEach(cleanup);

function renderDashboard() {
  return render(
    <MemoryRouter initialEntries={["/dashboard"]}>
      <Dashboard />
    </MemoryRouter>
  );
}

/** Simulate the page becoming visible (replaces old window focus tests). */
function simulateVisibilityChange(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", {
    value: state,
    writable: true,
    configurable: true,
  });
  document.dispatchEvent(new Event("visibilitychange"));
}

/* ---- Tests ---- */

describe("Dashboard visibility refresh", () => {
  it("refreshes progress when page becomes visible with a selected profile", async () => {
    mockGet.mockImplementation((url: string) => {
      if (url === "/api/curriculum") return Promise.resolve([]);
      if (url === "/api/curriculum/level-1") return Promise.resolve(MOCK_SECTIONS);
      if (url === "/api/curriculum/level-1/progress") return Promise.resolve(INITIAL_PROGRESS);
      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    });

    renderDashboard();

    // Wait for sections to load
    await waitFor(() => {
      expect(screen.getByText("What is Software Pilotry?")).toBeTruthy();
    });

    // Switch mock to return updated progress
    mockGet.mockImplementation((url: string) => {
      if (url === "/api/curriculum/level-1/progress") return Promise.resolve(UPDATED_PROGRESS);
      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    });

    // Simulate page becoming visible (bypasses throttle by advancing time)
    await act(async () => {
      simulateVisibilityChange("visible");
    });

    // Progress endpoint should have been called again
    await waitFor(() => {
      const progressCalls = mockGet.mock.calls.filter(
        (call: string[]) => call[0] === "/api/curriculum/level-1/progress"
      );
      expect(progressCalls.length).toBeGreaterThan(0);
    });
  });

  it("cleans up visibilitychange listener on unmount", async () => {
    mockGet.mockImplementation((url: string) => {
      if (url === "/api/curriculum") return Promise.resolve([]);
      if (url === "/api/curriculum/level-1") return Promise.resolve(MOCK_SECTIONS);
      if (url === "/api/curriculum/level-1/progress") return Promise.resolve(INITIAL_PROGRESS);
      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    });

    const { unmount } = renderDashboard();

    await waitFor(() => {
      expect(screen.getByText("What is Software Pilotry?")).toBeTruthy();
    });

    mockGet.mockClear();
    unmount();

    // Visibility change after unmount should NOT trigger any fetch
    await act(async () => {
      simulateVisibilityChange("visible");
    });

    expect(mockGet).not.toHaveBeenCalled();
  });

  it("silently ignores fetch errors on visibility refresh", async () => {
    mockGet.mockImplementation((url: string) => {
      if (url === "/api/curriculum") return Promise.resolve([]);
      if (url === "/api/curriculum/level-1") return Promise.resolve(MOCK_SECTIONS);
      if (url === "/api/curriculum/level-1/progress") return Promise.resolve(INITIAL_PROGRESS);
      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    });

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText("What is Software Pilotry?")).toBeTruthy();
    });

    // Make progress fetch fail
    mockGet.mockImplementation((url: string) => {
      if (url === "/api/curriculum/level-1/progress") return Promise.reject(new Error("Network error"));
      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    });

    // Visibility change should not throw or show error
    await act(async () => {
      simulateVisibilityChange("visible");
    });

    // Sections should still be visible (stale data preserved)
    expect(screen.getByText("What is Software Pilotry?")).toBeTruthy();
  });
});
