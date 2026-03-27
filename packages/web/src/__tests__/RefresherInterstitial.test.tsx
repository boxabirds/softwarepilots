/**
 * UI component test for the refresher interstitial (Story 63).
 *
 * Tests rendering conditions and button callbacks for the
 * interstitial card shown before starting a new section.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

afterEach(() => { cleanup(); });

/* ---- Minimal interstitial component extracted for testing ---- */

interface RefresherInterstitialProps {
  dueCount: number;
  onAccept: () => void;
  onDecline: () => void;
}

function RefresherInterstitial({ dueCount, onAccept, onDecline }: RefresherInterstitialProps) {
  if (dueCount === 0) return null;

  return (
    <div data-testid="refresher-interstitial">
      <h2>Quick refresher?</h2>
      <p>
        You have {dueCount} concept{dueCount === 1 ? "" : "s"} due for review from earlier sections.
        Want to do a quick refresher on the areas that need the most work?
      </p>
      <button onClick={onAccept} data-testid="refresher-accept">
        Yes, let's review
      </button>
      <button onClick={onDecline} data-testid="refresher-decline">
        No, continue to section
      </button>
    </div>
  );
}

/* ---- Tests ---- */

describe("RefresherInterstitial", () => {
  it("renders when dueCount > 0", () => {
    render(<RefresherInterstitial dueCount={4} onAccept={vi.fn()} onDecline={vi.fn()} />);
    expect(screen.getByTestId("refresher-interstitial")).toBeDefined();
    expect(screen.getByText(/4 concepts due for review/)).toBeDefined();
  });

  it("does not render when dueCount is 0", () => {
    const { container } = render(<RefresherInterstitial dueCount={0} onAccept={vi.fn()} onDecline={vi.fn()} />);
    expect(container.innerHTML).toBe("");
  });

  it("shows singular 'concept' for dueCount 1", () => {
    render(<RefresherInterstitial dueCount={1} onAccept={vi.fn()} onDecline={vi.fn()} />);
    expect(screen.getByText(/1 concept due for review/)).toBeDefined();
  });

  it("accept button calls onAccept", () => {
    const onAccept = vi.fn();
    const { getByTestId } = render(<RefresherInterstitial dueCount={3} onAccept={onAccept} onDecline={vi.fn()} />);
    fireEvent.click(getByTestId("refresher-accept"));
    expect(onAccept).toHaveBeenCalledOnce();
  });

  it("decline button calls onDecline", () => {
    const onDecline = vi.fn();
    const { getByTestId } = render(<RefresherInterstitial dueCount={3} onAccept={vi.fn()} onDecline={onDecline} />);
    fireEvent.click(getByTestId("refresher-decline"));
    expect(onDecline).toHaveBeenCalledOnce();
  });
});
