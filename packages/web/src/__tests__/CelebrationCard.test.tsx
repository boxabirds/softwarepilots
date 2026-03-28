import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CelebrationCard, computeNextTarget } from "../components/CelebrationCard";

/* ---- Mock @softwarepilots/shared ---- */

const MOCK_SECTIONS = [
  { id: "1.1", title: "First Lesson", module_id: "1", module_title: "Module One" },
  { id: "1.2", title: "Second Lesson", module_id: "1", module_title: "Module One" },
  { id: "2.1", title: "Third Lesson", module_id: "2", module_title: "Module Two" },
  { id: "2.2", title: "Fourth Lesson", module_id: "2", module_title: "Module Two" },
];

vi.mock("@softwarepilots/shared", () => ({
  getCurriculumSections: () => MOCK_SECTIONS,
}));

describe("CelebrationCard", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders green card with trophy icon", () => {
    render(<CelebrationCard profile="level-1" sectionId="1.1" />);

    const card = screen.getByTestId("celebration-card");
    expect(card).toBeTruthy();

    // Trophy emoji should be present
    const trophy = screen.getByRole("img", { name: "Trophy" });
    expect(trophy).toBeTruthy();
    expect(trophy.textContent).toContain("\u{1F3C6}");

    // Card should have green-ish styling
    expect(card.style.background).toContain("22, 163, 74");
  });

  it("shows 'next lesson' text when next section is in the same module", () => {
    render(<CelebrationCard profile="level-1" sectionId="1.1" onNext={() => {}} />);

    const nextBtn = screen.getByTestId("celebration-next-btn");
    expect(nextBtn.textContent).toContain("Next lesson");
  });

  it("shows 'next module' text at module boundary", () => {
    // 1.2 is last in module 1; next is 2.1 in module 2
    render(<CelebrationCard profile="level-1" sectionId="1.2" onNext={() => {}} />);

    const nextBtn = screen.getByTestId("celebration-next-btn");
    expect(nextBtn.textContent).toContain("Next module");
  });

  it("shows curriculum-complete text at last section with no Next button", () => {
    // 2.2 is the last section in our mock
    render(<CelebrationCard profile="level-1" sectionId="2.2" onNext={() => {}} />);

    expect(screen.getByText(/completed the entire curriculum/)).toBeTruthy();
    expect(screen.queryByTestId("celebration-next-btn")).toBeNull();
  });

  it("Next button calls onNext with correct section ID", async () => {
    const onNext = vi.fn();
    render(<CelebrationCard profile="level-1" sectionId="1.1" onNext={onNext} />);

    const user = userEvent.setup();
    await user.click(screen.getByTestId("celebration-next-btn"));

    expect(onNext).toHaveBeenCalledOnce();
    expect(onNext).toHaveBeenCalledWith("1.2");
  });

  it("does not show Next button when onNext is not provided", () => {
    render(<CelebrationCard profile="level-1" sectionId="1.1" />);

    expect(screen.queryByTestId("celebration-next-btn")).toBeNull();
  });
});

/* ---- computeNextTarget unit tests ---- */

describe("computeNextTarget", () => {
  it("returns NextTarget with 'Next lesson' for same-module next", () => {
    const result = computeNextTarget("level-1", "1.1");
    expect(result).toEqual({ sectionId: "1.2", label: "Next lesson" });
  });

  it("returns NextTarget with 'Next module' at module boundary", () => {
    const result = computeNextTarget("level-1", "1.2");
    expect(result).toEqual({ sectionId: "2.1", label: "Next module" });
  });

  it("returns 'curriculum-complete' for last section", () => {
    const result = computeNextTarget("level-1", "2.2");
    expect(result).toBe("curriculum-complete");
  });

  it("returns null for unknown section ID", () => {
    const result = computeNextTarget("level-1", "99.99");
    expect(result).toBeNull();
  });
});
