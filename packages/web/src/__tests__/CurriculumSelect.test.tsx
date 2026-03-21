import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { CurriculumSelect } from "../pages/CurriculumSelect";

/* ---- Mock data ---- */

const MOCK_PROGRESS = [
  {
    section_id: "ng-1-1",
    status: "completed" as const,
    understanding_level: "solid",
    updated_at: "2026-03-20T10:00:00Z",
  },
  {
    section_id: "ng-1-2",
    status: "in_progress" as const,
    updated_at: "2026-03-20T11:00:00Z",
  },
  {
    section_id: "ng-2-1",
    status: "not_started" as const,
    updated_at: "2026-03-20T09:00:00Z",
  },
];

const MOCK_PROFILES = [
  {
    profile: "new-grad" as const,
    title: "New CS Graduate",
    starting_position:
      "Fresh from university with theoretical knowledge but limited production experience",
    module_count: 3,
    section_count: 9,
  },
  {
    profile: "veteran" as const,
    title: "Veteran Engineer",
    starting_position:
      "10+ years shipping code, deep expertise in specific stacks",
    module_count: 3,
    section_count: 10,
  },
  {
    profile: "senior-leader" as const,
    title: "Senior Tech Leader",
    starting_position:
      "VP/CTO level, responsible for org-wide technology decisions",
    module_count: 3,
    section_count: 11,
  },
];

const MOCK_SECTIONS = [
  {
    id: "ng-1-1",
    module_id: "ng-1",
    module_title: "Module A",
    title: "Section Alpha",
    key_intuition: "Key insight A",
  },
  {
    id: "ng-1-2",
    module_id: "ng-1",
    module_title: "Module A",
    title: "Section Beta",
    key_intuition: "Key insight B",
  },
  {
    id: "ng-2-1",
    module_id: "ng-2",
    module_title: "Module B",
    title: "Section Gamma",
    key_intuition: "Key insight C",
  },
];

/* ---- Mock apiClient ---- */

vi.mock("../lib/api-client", () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

import { apiClient } from "../lib/api-client";

const mockGet = vi.mocked(apiClient.get);

function renderPage() {
  return render(
    <MemoryRouter>
      <CurriculumSelect />
    </MemoryRouter>,
  );
}

/**
 * Configure mockGet to return profiles for /api/curriculum
 * and sections for /api/curriculum/:profile.
 */
function setupSuccessMocks({ withProgress = true } = {}) {
  mockGet.mockImplementation((path: string) => {
    if (path === "/api/curriculum") {
      return Promise.resolve([...MOCK_PROFILES]);
    }
    if (path.endsWith("/progress")) {
      if (withProgress) {
        return Promise.resolve([...MOCK_PROGRESS]);
      }
      return Promise.reject(new Error("Progress unavailable"));
    }
    if (path.startsWith("/api/curriculum/")) {
      return Promise.resolve([...MOCK_SECTIONS]);
    }
    return Promise.reject(new Error(`Unexpected path: ${path}`));
  });
}

describe("CurriculumSelect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders three track cards with correct titles", async () => {
    setupSuccessMocks();

    renderPage();

    // Wait for profiles to load - use getAllBy to tolerate React 19 double-effect
    await waitFor(() => {
      expect(screen.getAllByText("New CS Graduate").length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText("Veteran Engineer").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Senior Tech Leader").length).toBeGreaterThan(0);

    // Verify we have exactly 3 track cards (role="button")
    const trackCards = screen.getAllByRole("button");
    expect(trackCards.length).toBe(3);
  });

  it("clicking a card reveals module/section tree", async () => {
    setupSuccessMocks();
    const user = userEvent.setup();

    renderPage();

    await waitFor(() => {
      expect(screen.getAllByRole("button").length).toBe(3);
    });

    // Click the first track card (New CS Graduate)
    const cards = screen.getAllByRole("button");
    await user.click(cards[0]);

    await waitFor(() => {
      expect(screen.getByText("Section Alpha")).toBeTruthy();
    });
    expect(screen.getByText("Section Beta")).toBeTruthy();
    expect(screen.getByText("Module B")).toBeTruthy();
    expect(screen.getByText("Section Gamma")).toBeTruthy();
  });

  it("section links have correct href format", async () => {
    setupSuccessMocks();
    const user = userEvent.setup();

    renderPage();

    await waitFor(() => {
      expect(screen.getAllByRole("button").length).toBe(3);
    });

    const cards = screen.getAllByRole("button");
    await user.click(cards[0]);

    await waitFor(() => {
      expect(screen.getByText("Section Alpha")).toBeTruthy();
    });

    const link = screen.getByText("Section Alpha").closest("a");
    expect(link).not.toBeNull();
    expect(link!.getAttribute("href")).toBe("/curriculum/new-grad/ng-1-1");

    const link2 = screen.getByText("Section Gamma").closest("a");
    expect(link2).not.toBeNull();
    expect(link2!.getAttribute("href")).toBe("/curriculum/new-grad/ng-2-1");
  });

  it("shows error state with retry when fetch fails", async () => {
    mockGet.mockImplementation(() =>
      Promise.reject(new Error("Network error")),
    );

    renderPage();

    await waitFor(() => {
      expect(
        screen.getByText("Failed to load curriculum tracks"),
      ).toBeTruthy();
    });
    expect(screen.getByRole("alert")).toBeTruthy();

    // Find the Retry button within the alert
    const alert = screen.getByRole("alert");
    const retryButton = within(alert).getByRole("button", { name: "Retry" });
    expect(retryButton).toBeTruthy();

    // Click retry and succeed - switch to success mocks
    setupSuccessMocks();
    const user = userEvent.setup();
    await user.click(retryButton);

    await waitFor(() => {
      expect(screen.getAllByText("New CS Graduate").length).toBeGreaterThan(0);
    });
  });

  it("shows progress badges when progress data is fetched", async () => {
    setupSuccessMocks({ withProgress: true });
    const user = userEvent.setup();

    renderPage();

    await waitFor(() => {
      expect(screen.getAllByRole("button").length).toBe(3);
    });

    const cards = screen.getAllByRole("button");
    await user.click(cards[0]);

    await waitFor(() => {
      expect(screen.getByText("Section Alpha")).toBeTruthy();
    });

    // Wait for progress badges to appear
    await waitFor(() => {
      const circles = screen.getAllByTestId("progress-circle");
      expect(circles.length).toBe(3);
    });

    // Check that the completed badge has correct aria-label
    const circles = screen.getAllByTestId("progress-circle");
    const labels = circles.map((c) => c.getAttribute("aria-label"));
    expect(labels).toContain("Completed");
    expect(labels).toContain("In progress");
    expect(labels).toContain("Not started");
  });

  it("shows N of M completed in module headers", async () => {
    setupSuccessMocks({ withProgress: true });
    const user = userEvent.setup();

    renderPage();

    await waitFor(() => {
      expect(screen.getAllByRole("button").length).toBe(3);
    });

    const cards = screen.getAllByRole("button");
    await user.click(cards[0]);

    // Module A has 2 sections, 1 completed
    await waitFor(() => {
      expect(screen.getByText("1 of 2 completed")).toBeTruthy();
    });

    // Module B has 1 section, 0 completed
    expect(screen.getByText("0 of 1 completed")).toBeTruthy();
  });

  it("renders sections without badges when progress fetch fails", async () => {
    setupSuccessMocks({ withProgress: false });
    const user = userEvent.setup();

    renderPage();

    await waitFor(() => {
      expect(screen.getAllByRole("button").length).toBe(3);
    });

    const cards = screen.getAllByRole("button");
    await user.click(cards[0]);

    await waitFor(() => {
      expect(screen.getByText("Section Alpha")).toBeTruthy();
    });

    // Sections are visible but no progress badges
    expect(screen.getByText("Section Beta")).toBeTruthy();
    expect(screen.getByText("Section Gamma")).toBeTruthy();
    expect(screen.queryAllByTestId("progress-circle").length).toBe(0);

    // No "N of M completed" text
    expect(screen.queryByText(/of \d+ completed/)).toBeNull();
  });
});
