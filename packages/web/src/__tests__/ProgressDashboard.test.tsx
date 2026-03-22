import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ProgressDashboard } from "../pages/ProgressDashboard";

/* ---- Mock data ---- */

const MOCK_SUMMARY = {
  overall_narrative: "You have completed 2 sections and are doing great!",
  sections: [
    {
      section_id: "1.1",
      title: "Intro to Testing",
      status: "completed",
      understanding_level: "solid",
      concepts: {
        "unit testing": { level: "solid", review_count: 3 },
        mocking: { level: "developing", review_count: 1 },
      },
    },
    {
      section_id: "1.2",
      title: "Integration Tests",
      status: "in_progress",
      understanding_level: "emerging",
      concepts: {},
    },
    {
      section_id: "2.1",
      title: "CI/CD Pipelines",
      status: "not_started",
      concepts: {},
    },
  ],
  stats: {
    completed: 1,
    in_progress: 1,
    paused: 0,
    not_started: 1,
    total: 3,
  },
  concepts_due_for_review: [
    { concept: "mocking", section_id: "1.1", days_overdue: 2 },
  ],
};

const EMPTY_SUMMARY = {
  overall_narrative: null,
  sections: [
    {
      section_id: "1.1",
      title: "Intro to Testing",
      status: "not_started",
      concepts: {},
    },
  ],
  stats: {
    completed: 0,
    in_progress: 0,
    paused: 0,
    not_started: 1,
    total: 1,
  },
  concepts_due_for_review: [],
};

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

function renderDashboard(profile = "level-1") {
  return render(
    <MemoryRouter initialEntries={[`/curriculum/${profile}/progress`]}>
      <Routes>
        <Route
          path="/curriculum/:profile/progress"
          element={<ProgressDashboard />}
        />
        <Route path="/curriculum/:profile/:sectionId" element={<div>Session</div>} />
        <Route path="/curriculum" element={<div>Curriculum</div>} />
      </Routes>
    </MemoryRouter>
  );
}

/* ---- Tests ---- */

describe("ProgressDashboard", () => {
  it("renders narrative card with narrative text", async () => {
    mockGet.mockResolvedValueOnce(MOCK_SUMMARY);
    renderDashboard();

    await waitFor(() => {
      expect(
        screen.getByText("You have completed 2 sections and are doing great!")
      ).toBeTruthy();
    });
  });

  it("renders placeholder when no progress", async () => {
    mockGet.mockResolvedValueOnce(EMPTY_SUMMARY);
    renderDashboard();

    await waitFor(() => {
      expect(
        screen.getByText(
          "Start your first section to see your progress narrative here."
        )
      ).toBeTruthy();
    });
  });

  it("renders stats bar with correct counts", async () => {
    mockGet.mockResolvedValueOnce(MOCK_SUMMARY);
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText("1 completed")).toBeTruthy();
      expect(screen.getByText("1 in progress")).toBeTruthy();
      expect(screen.getByText("1 not started")).toBeTruthy();
    });
  });

  it("renders module cards", async () => {
    mockGet.mockResolvedValueOnce(MOCK_SUMMARY);
    renderDashboard();

    await waitFor(() => {
      const moduleCards = screen.getAllByTestId("module-card");
      expect(moduleCards.length).toBeGreaterThan(0);
    });
  });

  it("expands module to show section cards on click", async () => {
    mockGet.mockResolvedValueOnce(MOCK_SUMMARY);
    const user = userEvent.setup();
    renderDashboard();

    await waitFor(() => {
      expect(screen.getAllByTestId("module-card").length).toBeGreaterThan(0);
    });

    // Click the first module header to expand
    const moduleHeader = screen
      .getAllByTestId("module-card")[0]
      .querySelector("[role='button']")!;
    await user.click(moduleHeader);

    await waitFor(() => {
      expect(screen.getAllByTestId("section-card").length).toBeGreaterThan(0);
    });
  });

  it("shows error state with retry button", async () => {
    mockGet.mockRejectedValueOnce(new Error("Network error"));
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeTruthy();
      expect(screen.getByText("Failed to load progress summary")).toBeTruthy();
      expect(screen.getByText("Retry")).toBeTruthy();
    });
  });

  it("shows concepts due for review badge", async () => {
    mockGet.mockResolvedValueOnce(MOCK_SUMMARY);
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText("1 concepts due for review")).toBeTruthy();
    });
  });
});
