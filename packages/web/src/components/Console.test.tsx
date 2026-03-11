import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Console } from "./Console";

describe("Console", () => {
  it("shows placeholder text when output is empty", () => {
    render(<Console output="" />);
    expect(screen.getByText("Output")).toBeTruthy();
  });

  it("displays output text", () => {
    render(<Console output="Total: 12.0 | Cheap? False" />);
    expect(screen.getByText(/Total: 12\.0/)).toBeTruthy();
  });
});
