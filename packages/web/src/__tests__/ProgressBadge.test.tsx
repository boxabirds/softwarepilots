import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ProgressBadge } from "../components/ProgressBadge";

afterEach(cleanup);

describe("ProgressBadge", () => {
  it("renders empty circle for not_started", () => {
    render(<ProgressBadge status="not_started" />);
    const circle = screen.getByTestId("progress-circle");
    expect(circle.getAttribute("aria-label")).toBe( "Not started");
    expect(circle.className).toContain("bg-transparent");
  });

  it("renders half circle for in_progress", () => {
    render(<ProgressBadge status="in_progress" />);
    const circle = screen.getByTestId("progress-circle");
    expect(circle.getAttribute("aria-label")).toBe( "In progress");
    expect(circle.className).toContain("bg-gradient-to-t");
    expect(circle.className).toContain("from-blue-500");
  });

  it("renders filled circle for completed", () => {
    render(<ProgressBadge status="completed" />);
    const circle = screen.getByTestId("progress-circle");
    expect(circle.getAttribute("aria-label")).toBe( "Completed");
    expect(circle.className).toContain("bg-green-600");
  });

  it("shows understanding level text when provided", () => {
    render(<ProgressBadge status="in_progress" understandingLevel="emerging" />);
    expect(screen.getByText("emerging")).toBeTruthy();
  });

  it("does not show understanding level text when not provided", () => {
    const { container } = render(<ProgressBadge status="not_started" />);
    const textElements = container.querySelectorAll(".text-xs");
    expect(textElements).toHaveLength(0);
  });
});
