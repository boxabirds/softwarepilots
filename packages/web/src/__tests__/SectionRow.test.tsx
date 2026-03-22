import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { SectionRow } from "../pages/Dashboard";

/* ---- Mock api-client ---- */

let mockPost: ReturnType<typeof vi.fn>;

vi.mock("../lib/api-client", () => ({
  apiClient: {
    get: vi.fn().mockResolvedValue([]),
    post: (...args: unknown[]) => mockPost(...args),
  },
}));

beforeEach(() => {
  mockPost = vi.fn().mockResolvedValue({ archived: true });
});

afterEach(cleanup);

/* ---- Helpers ---- */

const BASE_SECTION = {
  id: "1.1",
  module_id: "1",
  module_title: "Fundamentals",
  title: "Introduction to Software",
  key_intuition: "test",
};

function renderRow(
  status: "not_started" | "in_progress" | "completed" | "needs_review",
  claimProgress?: { demonstrated: number; total: number; percentage: number },
) {
  const progress =
    status === "not_started"
      ? undefined
      : {
          section_id: "1.1",
          status,
          updated_at: "2026-01-01T00:00:00Z",
          ...(claimProgress ? { claim_progress: claimProgress } : {}),
        };

  return render(
    <MemoryRouter>
      <SectionRow
        section={BASE_SECTION}
        progress={progress as Parameters<typeof SectionRow>[0]["progress"]}
        profile={"level-1" as Parameters<typeof SectionRow>[0]["profile"]}
      />
    </MemoryRouter>,
  );
}

/* ---- Tests ---- */

describe("SectionRow", () => {
  it("renders 'Start' button for not_started", () => {
    renderRow("not_started");
    expect(screen.getByRole("link", { name: "Start" })).toBeTruthy();
  });

  it("does not show 'Start Over' for not_started", () => {
    renderRow("not_started");
    expect(screen.queryByTestId("start-over")).toBeNull();
  });

  it("renders 'Continue' + 'Start Over' for in_progress", () => {
    renderRow("in_progress");
    expect(screen.getByRole("link", { name: "Continue" })).toBeTruthy();
    expect(screen.getByTestId("start-over")).toBeTruthy();
  });

  it("renders 'Review' + 'Start Over' for completed", () => {
    renderRow("completed");
    expect(screen.getByRole("link", { name: "Review" })).toBeTruthy();
    expect(screen.getByTestId("start-over")).toBeTruthy();
  });

  it("renders 'Review' + 'Start Over' for needs_review", () => {
    renderRow("needs_review");
    expect(screen.getByRole("link", { name: "Review" })).toBeTruthy();
    expect(screen.getByTestId("start-over")).toBeTruthy();
  });

  it("shows progress percentage when claim_progress exists", () => {
    renderRow("in_progress", { demonstrated: 3, total: 6, percentage: 50 });
    expect(screen.getByTestId("claim-text").textContent).toBe("3/6 claims");
  });

  it("shows 'In progress' text when no claim_progress data", () => {
    renderRow("in_progress");
    expect(screen.getByTestId("in-progress-text").textContent).toBe(
      "In progress",
    );
  });

  it("shows 'Complete' text for completed status", () => {
    renderRow("completed");
    expect(screen.getByText("Complete")).toBeTruthy();
  });

  it("shows 'Review needed' text for needs_review status", () => {
    renderRow("needs_review");
    expect(screen.getByText("Review needed")).toBeTruthy();
  });

  it("shows 'Not started' text for not_started status", () => {
    renderRow("not_started");
    expect(screen.getByText("Not started")).toBeTruthy();
  });

  it("Start Over shows confirmation dialog and calls archive endpoint", async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

    renderRow("in_progress");
    await user.click(screen.getByTestId("start-over"));

    expect(confirmSpy).toHaveBeenCalledWith(
      "This will archive your current session and start fresh. Continue?",
    );
    expect(mockPost).toHaveBeenCalledWith(
      "/api/curriculum/level-1/1.1/archive",
      {},
    );

    confirmSpy.mockRestore();
  });

  it("Start Over does nothing when confirmation is cancelled", async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);

    renderRow("in_progress");
    await user.click(screen.getByTestId("start-over"));

    expect(confirmSpy).toHaveBeenCalled();
    expect(mockPost).not.toHaveBeenCalled();

    confirmSpy.mockRestore();
  });
});
