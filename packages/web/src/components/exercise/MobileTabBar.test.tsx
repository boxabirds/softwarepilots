import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { MobileTabBar } from "./MobileTabBar";

afterEach(cleanup);

describe("MobileTabBar", () => {
  it("renders both tab buttons", () => {
    render(<MobileTabBar activeTab="exercise" onTabChange={() => {}} />);
    expect(screen.getByRole("button", { name: "Exercise" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Code" })).toBeDefined();
  });

  it("calls onTabChange with 'code' when clicking code tab", () => {
    const onTabChange = vi.fn();
    render(<MobileTabBar activeTab="exercise" onTabChange={onTabChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Code" }));
    expect(onTabChange).toHaveBeenCalledWith("code");
  });

  it("calls onTabChange with 'exercise' when clicking exercise tab", () => {
    const onTabChange = vi.fn();
    render(<MobileTabBar activeTab="code" onTabChange={onTabChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Exercise" }));
    expect(onTabChange).toHaveBeenCalledWith("exercise");
  });

  it("does not call onTabChange when code tab is disabled", () => {
    const onTabChange = vi.fn();
    render(<MobileTabBar activeTab="exercise" onTabChange={onTabChange} codeDisabled={true} />);
    fireEvent.click(screen.getByRole("button", { name: "Code" }));
    expect(onTabChange).not.toHaveBeenCalled();
  });

  it("applies active styling to the selected tab", () => {
    render(<MobileTabBar activeTab="exercise" onTabChange={() => {}} />);
    const exerciseBtn = screen.getByRole("button", { name: "Exercise" });
    expect(exerciseBtn.className).toContain("text-primary");
  });
});
