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

describe("ProgressBadge with claim progress", () => {
  it("renders percentage ring for 50%", () => {
    render(
      <ProgressBadge
        status="in_progress"
        claimProgress={{ demonstrated: 3, total: 6, percentage: 50 }}
      />
    );
    const ring = screen.getByTestId("progress-ring");
    expect(ring).toBeTruthy();
    expect(ring.getAttribute("aria-label")).toContain("50%");

    // Should have a progress arc
    const arc = screen.getByTestId("progress-arc");
    expect(arc).toBeTruthy();
    // Blue color for 31-69% range
    expect(arc.getAttribute("stroke")).toBe("#3b82f6");
  });

  it("renders green dot for 100% completed (no ring or percentage text)", () => {
    render(
      <ProgressBadge
        status="completed"
        claimProgress={{ demonstrated: 7, total: 7, percentage: 100 }}
      />
    );
    // At 100%, renders a simple green dot instead of a ring
    const circle = screen.getByTestId("progress-circle");
    expect(circle).toBeTruthy();
    expect(circle.getAttribute("aria-label")).toBe("Completed");

    // No ring, no percentage text
    expect(screen.queryByTestId("progress-ring")).toBeNull();
    expect(screen.queryByTestId("percentage-text")).toBeNull();
  });

  it("renders amber ring for needs_review", () => {
    render(
      <ProgressBadge
        status="needs_review"
        claimProgress={{ demonstrated: 2, total: 7, percentage: 29 }}
      />
    );
    const ring = screen.getByTestId("progress-ring");
    expect(ring).toBeTruthy();
    expect(ring.getAttribute("aria-label")).toContain("Needs review");

    const arc = screen.getByTestId("progress-arc");
    // Amber color for needs_review
    expect(arc.getAttribute("stroke")).toBe("#d97706");

    // Has refresh indicator
    const refresh = screen.getByTestId("refresh-indicator");
    expect(refresh).toBeTruthy();
  });

  it("renders gray ring for low percentage (0-30%)", () => {
    render(
      <ProgressBadge
        status="in_progress"
        claimProgress={{ demonstrated: 1, total: 7, percentage: 14 }}
      />
    );
    const arc = screen.getByTestId("progress-arc");
    expect(arc.getAttribute("stroke")).toBe("#9ca3af");
  });

  it("renders green ring for 70-99%", () => {
    render(
      <ProgressBadge
        status="in_progress"
        claimProgress={{ demonstrated: 5, total: 7, percentage: 71 }}
      />
    );
    const arc = screen.getByTestId("progress-arc");
    expect(arc.getAttribute("stroke")).toBe("#16a34a");
  });

  it("falls back to plain circle when no claimProgress provided", () => {
    render(<ProgressBadge status="in_progress" />);
    // Should have the old-style circle, not a ring
    const circle = screen.getByTestId("progress-circle");
    expect(circle).toBeTruthy();
    expect(screen.queryByTestId("progress-ring")).toBeNull();
  });
});
