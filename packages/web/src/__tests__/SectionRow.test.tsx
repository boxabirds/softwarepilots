import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { SectionRow } from "../pages/Dashboard";

/* ---- Mock api-client ---- */

vi.mock("../lib/api-client", () => ({
  apiClient: {
    get: vi.fn().mockResolvedValue([]),
    post: vi.fn().mockResolvedValue({ archived: true }),
  },
}));

/* ---- Mock useNavigate ---- */

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

beforeEach(() => {
  mockNavigate.mockClear();
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
  it("renders section title", () => {
    renderRow("not_started");
    expect(screen.getByText("Introduction to Software")).toBeTruthy();
  });

  it("navigates to detail page on click", async () => {
    const user = userEvent.setup();
    renderRow("not_started");
    await user.click(screen.getByTestId("section-row-1.1"));
    expect(mockNavigate).toHaveBeenCalledWith("/curriculum/level-1/1.1/detail");
  });

  it("shows claim progress when claim_progress exists", () => {
    renderRow("in_progress", { demonstrated: 3, total: 6, percentage: 50 });
    expect(screen.getByTestId("claim-text").textContent).toBe("3/6");
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

  it("shows 'Review' text for needs_review status", () => {
    renderRow("needs_review");
    expect(screen.getByText("Review")).toBeTruthy();
  });

  it("renders a right chevron", () => {
    renderRow("not_started");
    const row = screen.getByTestId("section-row-1.1");
    const svg = row.querySelector("svg");
    expect(svg).toBeTruthy();
  });

  it("has role=button and is keyboard accessible", () => {
    renderRow("not_started");
    const row = screen.getByTestId("section-row-1.1");
    expect(row.getAttribute("role")).toBe("button");
    expect(row.getAttribute("tabindex")).toBe("0");
  });
});
