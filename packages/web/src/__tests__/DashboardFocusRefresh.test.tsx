import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { Dashboard } from "../pages/Dashboard";

/* ---- Mock data ---- */

const MOCK_PROFILES = [
  {
    profile: "level-1",
    title: "New Graduate",
    starting_position: "Fresh from bootcamp or CS degree",
    module_count: 1,
    section_count: 2,
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

/* ---- Mock api-client ---- */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mockGet: any;

vi.mock("../lib/api-client", () => ({
  apiClient: {
    get: (...args: unknown[]) => mockGet(...args),
  },
}));

beforeEach(() => {
  mockGet = vi.fn();
});

afterEach(cleanup);

function renderDashboard() {
  return render(
    <MemoryRouter initialEntries={["/curriculum"]}>
      <Dashboard />
    </MemoryRouter>
  );
}

/* ---- Tests ---- */

describe("Dashboard focus refresh", () => {
  it("refreshes progress when window gains focus with an expanded profile", async () => {
    // Initial load: profiles
    mockGet.mockImplementation((url: string) => {
      if (url === "/api/curriculum") return Promise.resolve(MOCK_PROFILES);
      if (url === "/api/curriculum/level-1") return Promise.resolve(MOCK_SECTIONS);
      if (url === "/api/curriculum/level-1/progress") return Promise.resolve(INITIAL_PROGRESS);
      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    });

    const user = userEvent.setup();
    renderDashboard();

    // Wait for profiles to load
    await waitFor(() => {
      expect(screen.getByText("New Graduate")).toBeTruthy();
    });

    // Click to expand
    await user.click(screen.getByText("New Graduate"));

    // Wait for sections to appear
    await waitFor(() => {
      expect(screen.getByText("What is Software Pilotry?")).toBeTruthy();
    });

    // Now switch the mock to return updated progress
    mockGet.mockImplementation((url: string) => {
      if (url === "/api/curriculum/level-1/progress") return Promise.resolve(UPDATED_PROGRESS);
      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    });

    // Fire a window focus event
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
    });

    // The progress endpoint should have been called again
    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith("/api/curriculum/level-1/progress");
    });
  });

  it("does NOT fetch progress on focus when no profile is expanded", async () => {
    mockGet.mockImplementation((url: string) => {
      if (url === "/api/curriculum") return Promise.resolve(MOCK_PROFILES);
      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    });

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText("New Graduate")).toBeTruthy();
    });

    // Clear mock call history
    mockGet.mockClear();

    // Fire focus with no profile expanded
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
    });

    // Should not have fetched anything
    expect(mockGet).not.toHaveBeenCalled();
  });

  it("cleans up focus event listener on unmount", async () => {
    mockGet.mockImplementation((url: string) => {
      if (url === "/api/curriculum") return Promise.resolve(MOCK_PROFILES);
      if (url === "/api/curriculum/level-1") return Promise.resolve(MOCK_SECTIONS);
      if (url === "/api/curriculum/level-1/progress") return Promise.resolve(INITIAL_PROGRESS);
      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    });

    const user = userEvent.setup();
    const { unmount } = renderDashboard();

    // Wait for profiles and expand
    await waitFor(() => {
      expect(screen.getByText("New Graduate")).toBeTruthy();
    });
    await user.click(screen.getByText("New Graduate"));
    await waitFor(() => {
      expect(screen.getByText("What is Software Pilotry?")).toBeTruthy();
    });

    // Clear call history, then unmount
    mockGet.mockClear();
    unmount();

    // Fire focus after unmount - should NOT trigger any fetch
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
    });

    expect(mockGet).not.toHaveBeenCalled();
  });

  it("silently ignores fetch errors on focus refresh", async () => {
    mockGet.mockImplementation((url: string) => {
      if (url === "/api/curriculum") return Promise.resolve(MOCK_PROFILES);
      if (url === "/api/curriculum/level-1") return Promise.resolve(MOCK_SECTIONS);
      if (url === "/api/curriculum/level-1/progress") return Promise.resolve(INITIAL_PROGRESS);
      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    });

    const user = userEvent.setup();
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText("New Graduate")).toBeTruthy();
    });

    await user.click(screen.getByText("New Graduate"));

    await waitFor(() => {
      expect(screen.getByText("What is Software Pilotry?")).toBeTruthy();
    });

    // Make progress fetch fail
    mockGet.mockImplementation((url: string) => {
      if (url === "/api/curriculum/level-1/progress") return Promise.reject(new Error("Network error"));
      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    });

    // Focus should not throw or show error
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
    });

    // Sections should still be visible (stale data preserved)
    expect(screen.getByText("What is Software Pilotry?")).toBeTruthy();
  });
});
