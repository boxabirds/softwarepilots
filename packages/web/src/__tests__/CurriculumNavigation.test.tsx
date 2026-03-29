import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { Dashboard } from "../pages/Dashboard";
import { LessonDetail } from "../pages/LessonDetail";

/* ---- Mock apiClient ---- */

vi.mock("../lib/api-client", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import { apiClient } from "../lib/api-client";

const mockGet = vi.mocked(apiClient.get);
const mockPut = vi.mocked(apiClient.put);

/* ---- Mock useAuth ---- */

const mockLearner = vi.fn<() => { id: string; selected_profile: string | null }>(() => ({
  id: "test-learner",
  selected_profile: null,
}));

vi.mock("../lib/auth", () => ({
  useAuth: () => ({
    isAuthenticated: true,
    isLoading: false,
    learner: mockLearner(),
  }),
}));

/* ---- Mock data ---- */

const MOCK_PROFILES = [
  { profile: "level-0", title: "Level 0", starting_position: "Complete beginner", section_count: 8 },
  { profile: "level-1", title: "Level 1", starting_position: "New grad", section_count: 12 },
  { profile: "level-10", title: "Level 10", starting_position: "Veteran", section_count: 10 },
  { profile: "level-20", title: "Level 20", starting_position: "Senior leader", section_count: 6 },
];

const MOCK_SECTIONS = [
  { id: "1.1", module_id: "1", module_title: "Foundations", title: "Understanding Software Pilots", key_intuition: "Key insight" },
  { id: "1.2", module_id: "1", module_title: "Foundations", title: "The Pilot Mindset", key_intuition: "Another insight" },
];

const MOCK_SECTION_DETAIL = {
  id: "1.1",
  module_id: "1",
  module_title: "Foundations",
  title: "Understanding Software Pilots",
  key_intuition: "Key insight",
};

/* ---- Location spy helper ---- */

let currentLocation = "";

function LocationSpy() {
  const location = useLocation();
  currentLocation = location.pathname;
  return null;
}

/* ---- Tests ---- */

beforeEach(() => {
  vi.clearAllMocks();
  currentLocation = "";
});

afterEach(() => {
  cleanup();
});

describe("Curriculum Navigation Flow", () => {
  it("first visit with no track shows onboarding (track selector)", async () => {
    mockLearner.mockReturnValue({ id: "test-learner", selected_profile: null });
    mockGet.mockResolvedValue(MOCK_PROFILES);

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Routes>
          <Route path="/dashboard" element={<Dashboard />} />
        </Routes>
      </MemoryRouter>,
    );

    // Onboarding heading should appear
    await waitFor(() => {
      expect(screen.getByText("Choose your track")).toBeTruthy();
    });

    // Track options should render
    await waitFor(() => {
      expect(screen.getByTestId("track-option-level-1")).toBeTruthy();
    });
  });

  it("selecting a track calls PUT /api/auth/preferences", async () => {
    mockLearner.mockReturnValue({ id: "test-learner", selected_profile: null });
    mockGet.mockResolvedValue(MOCK_PROFILES);
    mockPut.mockResolvedValue({ ok: true });

    // Mock window.location.reload to prevent jsdom error
    const reloadMock = vi.fn();
    Object.defineProperty(window, "location", {
      value: { ...window.location, reload: reloadMock },
      writable: true,
    });

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Routes>
          <Route path="/dashboard" element={<Dashboard />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("track-option-level-1")).toBeTruthy();
    });

    const user = userEvent.setup();
    await user.click(screen.getByTestId("track-option-level-1"));

    await waitFor(() => {
      expect(mockPut).toHaveBeenCalledWith("/api/auth/preferences", {
        selected_profile: "level-1",
      });
    });
  });

  it("selecting a track navigates to the dashboard (no page reload)", async () => {
    mockLearner.mockReturnValue({ id: "test-learner", selected_profile: null });
    mockGet.mockImplementation((path: string) => {
      if (path === "/api/curriculum") return Promise.resolve(MOCK_PROFILES);
      if (path.startsWith("/api/curriculum/level-1")) return Promise.resolve(MOCK_SECTIONS);
      return Promise.resolve([]);
    });
    mockPut.mockResolvedValue({ ok: true });

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Routes>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/curriculum/:profile" element={<div data-testid="curriculum-page">Curriculum</div>} />
        </Routes>
        <LocationSpy />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("track-option-level-1")).toBeTruthy();
    });

    const user = userEvent.setup();
    await user.click(screen.getByTestId("track-option-level-1"));

    // Should navigate to curriculum page, not reload
    await waitFor(() => {
      expect(currentLocation).toBe("/curriculum/level-1");
    });
  });

  it("with selected track, module browser loads and clicking lesson navigates to detail", async () => {
    mockLearner.mockReturnValue({ id: "test-learner", selected_profile: "level-1" });

    mockGet.mockImplementation((path: string) => {
      if (path === "/api/curriculum/level-1") {
        return Promise.resolve(MOCK_SECTIONS);
      }
      if (path === "/api/curriculum/level-1/progress") {
        return Promise.resolve([]);
      }
      if (path === "/api/curriculum/level-1/1.1") {
        return Promise.resolve(MOCK_SECTION_DETAIL);
      }
      if (path.endsWith("/sessions")) {
        return Promise.resolve([]);
      }
      if (path === "/api/curriculum") {
        return Promise.resolve(MOCK_PROFILES);
      }
      return Promise.reject(new Error(`Unexpected GET: ${path}`));
    });

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Routes>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/curriculum/:profile/:sectionId/detail" element={<LessonDetail />} />
        </Routes>
        <LocationSpy />
      </MemoryRouter>,
    );

    // Module browser should load with sections
    await waitFor(() => {
      expect(screen.getByText("Understanding Software Pilots")).toBeTruthy();
    });

    // Click on the lesson row
    const user = userEvent.setup();
    await user.click(screen.getByTestId("section-row-1.1"));

    // Should navigate to the detail route
    await waitFor(() => {
      expect(currentLocation).toBe("/curriculum/level-1/1.1/detail");
    });
  });

  it("displays track description (starting_position) alongside track title", async () => {
    mockLearner.mockReturnValue({ id: "test-learner", selected_profile: "level-1" });

    mockGet.mockImplementation((path: string) => {
      if (path === "/api/curriculum/level-1") return Promise.resolve(MOCK_SECTIONS);
      if (path === "/api/curriculum/level-1/progress") return Promise.resolve([]);
      return Promise.resolve([]);
    });

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Routes>
          <Route path="/dashboard" element={<Dashboard />} />
        </Routes>
      </MemoryRouter>,
    );

    // Wait for content to load
    await waitFor(() => {
      expect(screen.getByText("Understanding Software Pilots")).toBeTruthy();
    });

    // Track description should be visible (starting_position from curriculum data)
    expect(screen.getByTestId("track-description")).toBeTruthy();
    expect(screen.getByTestId("track-description").textContent!.length).toBeGreaterThan(20);
  });
});
