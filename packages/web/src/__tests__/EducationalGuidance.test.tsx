import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EducationalGuidance } from "../components/EducationalGuidance";

const STORAGE_KEY = "sp-guidance-collapsed";

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("EducationalGuidance", () => {
  it("renders 3 guidance sections when expanded", () => {
    render(<EducationalGuidance />);

    expect(screen.getByText("How tutoring works")).toBeTruthy();
    expect(screen.getByText("How progress is tracked")).toBeTruthy();
    expect(screen.getByText("Why revisit lessons")).toBeTruthy();
  });

  it("collapses on click and hides content", async () => {
    render(<EducationalGuidance />);

    // Content is visible initially
    expect(screen.getByTestId("guidance-content")).toBeTruthy();

    const user = userEvent.setup();
    await user.click(screen.getByTestId("guidance-toggle"));

    // Content should be hidden
    expect(screen.queryByTestId("guidance-content")).toBeNull();
    expect(screen.getByText("Show")).toBeTruthy();
  });

  it("expands on click after being collapsed", async () => {
    render(<EducationalGuidance />);

    const user = userEvent.setup();

    // Collapse
    await user.click(screen.getByTestId("guidance-toggle"));
    expect(screen.queryByTestId("guidance-content")).toBeNull();

    // Expand
    await user.click(screen.getByTestId("guidance-toggle"));
    expect(screen.getByTestId("guidance-content")).toBeTruthy();
    expect(screen.getByText("Hide")).toBeTruthy();
  });

  it("remembers collapsed state via localStorage", async () => {
    const { unmount } = render(<EducationalGuidance />);

    const user = userEvent.setup();

    // Collapse
    await user.click(screen.getByTestId("guidance-toggle"));

    // Verify localStorage was set
    expect(localStorage.getItem(STORAGE_KEY)).toBe("true");

    unmount();

    // Re-render - should start collapsed
    render(<EducationalGuidance />);
    expect(screen.queryByTestId("guidance-content")).toBeNull();
  });

  it("starts expanded for new users regardless of localStorage", () => {
    localStorage.setItem(STORAGE_KEY, "true");

    render(<EducationalGuidance isNewUser />);

    // New user override: starts expanded
    expect(screen.getByTestId("guidance-content")).toBeTruthy();
  });
});
