import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ConceptBadge } from "../components/ConceptBadge";

afterEach(cleanup);

describe("ConceptBadge", () => {
  it("renders concept name", () => {
    render(<ConceptBadge concept="thread safety" level="solid" />);
    expect(screen.getByText("thread safety")).toBeTruthy();
  });

  it("renders yellow for emerging level", () => {
    render(<ConceptBadge concept="basics" level="emerging" />);
    const badge = screen.getByTestId("concept-badge");
    expect(badge.className).toContain("bg-yellow-100");
    expect(badge.className).toContain("text-yellow-800");
    expect(badge.dataset.level).toBe("emerging");
  });

  it("renders blue for developing level", () => {
    render(<ConceptBadge concept="patterns" level="developing" />);
    const badge = screen.getByTestId("concept-badge");
    expect(badge.className).toContain("bg-blue-100");
    expect(badge.className).toContain("text-blue-800");
    expect(badge.dataset.level).toBe("developing");
  });

  it("renders green for solid level", () => {
    render(<ConceptBadge concept="testing" level="solid" />);
    const badge = screen.getByTestId("concept-badge");
    expect(badge.className).toContain("bg-green-100");
    expect(badge.className).toContain("text-green-800");
    expect(badge.dataset.level).toBe("solid");
  });

  it("renders purple for strong level", () => {
    render(<ConceptBadge concept="architecture" level="strong" />);
    const badge = screen.getByTestId("concept-badge");
    expect(badge.className).toContain("bg-purple-100");
    expect(badge.className).toContain("text-purple-800");
    expect(badge.dataset.level).toBe("strong");
  });

  it("renders gray for unknown level", () => {
    render(<ConceptBadge concept="unknown" level="whatever" />);
    const badge = screen.getByTestId("concept-badge");
    expect(badge.className).toContain("bg-gray-100");
  });
});
