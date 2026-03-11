import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { SelfAssessment } from "./SelfAssessment";

afterEach(cleanup);

describe("SelfAssessment", () => {
  it("renders all three dimension labels", () => {
    render(<SelfAssessment onSubmit={vi.fn()} />);
    expect(screen.getAllByText("Code Comprehension").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Output Predictions").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Your Modification").length).toBeGreaterThanOrEqual(1);
  });

  it("renders native range sliders", () => {
    render(<SelfAssessment onSubmit={vi.fn()} />);
    const sliders = screen.getAllByRole("slider");
    expect(sliders).toHaveLength(3);
  });

  it("renders default scores of 5/10", () => {
    render(<SelfAssessment onSubmit={vi.fn()} />);
    const scoreLabels = screen.getAllByText("5/10");
    expect(scoreLabels).toHaveLength(3);
  });

  it("disables submit button initially", () => {
    render(<SelfAssessment onSubmit={vi.fn()} />);
    const button = screen.getByRole("button", { name: /Submit with Self-Assessment/ });
    expect(button).toHaveProperty("disabled", true);
  });

  it("calls onSubmit with predictions and weakest dimension", () => {
    const onSubmit = vi.fn();
    render(<SelfAssessment onSubmit={onSubmit} />);
    const select = screen.getByRole("combobox");
    fireEvent.change(select, { target: { value: "prediction_accuracy" } });
    const button = screen.getByRole("button", { name: /Submit with Self-Assessment/ });
    fireEvent.click(button);

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const [predictions, weakest] = onSubmit.mock.calls[0];
    expect(predictions).toHaveProperty("code_comprehension", 5);
    expect(predictions).toHaveProperty("prediction_accuracy", 5);
    expect(predictions).toHaveProperty("modification_quality", 5);
    expect(weakest).toBe("prediction_accuracy");
  });

  it("updates score display when slider changes", () => {
    render(<SelfAssessment onSubmit={vi.fn()} />);
    const sliders = screen.getAllByRole("slider");
    fireEvent.change(sliders[0], { target: { value: "8" } });
    expect(screen.getByText("8/10")).toBeTruthy();
  });
});
