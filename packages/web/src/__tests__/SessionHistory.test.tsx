import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { SessionHistory } from "../components/SessionHistory";
import type { SessionSummary } from "../components/SessionHistory";

afterEach(() => {
  cleanup();
});

const MOCK_SESSIONS: SessionSummary[] = [
  {
    id: "sess-1",
    created_at: new Date(Date.now() - 3_600_000).toISOString(), // 1 hour ago
    archived_at: null,
    summary: null,
    message_count: 5,
    status: "active",
  },
  {
    id: "sess-2",
    created_at: new Date(Date.now() - 86_400_000 * 2).toISOString(), // 2 days ago
    archived_at: new Date(Date.now() - 86_400_000).toISOString(),
    summary: "Covered variables and basic data types including strings, numbers, and booleans in the context of JavaScript programming.",
    message_count: 12,
    status: "archived",
  },
  {
    id: "sess-3",
    created_at: new Date(Date.now() - 86_400_000 * 5).toISOString(), // 5 days ago
    archived_at: new Date(Date.now() - 86_400_000 * 4).toISOString(),
    summary: null,
    message_count: 3,
    status: "archived",
  },
];

describe("SessionHistory", () => {
  it("renders session list with dates", () => {
    render(<SessionHistory sessions={MOCK_SESSIONS} />);

    expect(screen.getByTestId("session-history")).toBeTruthy();
    expect(screen.getByTestId("session-row-sess-1")).toBeTruthy();
    expect(screen.getByTestId("session-row-sess-2")).toBeTruthy();
    expect(screen.getByTestId("session-row-sess-3")).toBeTruthy();

    // Relative date text should be present (e.g. "1h ago", "2d ago")
    expect(screen.getByText("1h ago")).toBeTruthy();
    expect(screen.getByText("2d ago")).toBeTruthy();
    expect(screen.getByText("5d ago")).toBeTruthy();
  });

  it("highlights active session with Active badge", () => {
    render(<SessionHistory sessions={MOCK_SESSIONS} />);

    // Active session row should contain "Active" badge
    const activeRow = screen.getByTestId("session-row-sess-1");
    expect(activeRow.textContent).toContain("Active");

    // Archived sessions should not have "Active" badge
    const archivedRow = screen.getByTestId("session-row-sess-2");
    expect(archivedRow.textContent).not.toContain("Active");
  });

  it("shows summary snippets for sessions with summaries", () => {
    render(<SessionHistory sessions={MOCK_SESSIONS} />);

    // Session 2 has a summary longer than 80 chars, so it should be truncated
    const row2 = screen.getByTestId("session-row-sess-2");
    expect(row2.textContent).toContain("Covered variables and basic data types");
    expect(row2.textContent).toContain("...");
  });

  it("shows empty state when no sessions", () => {
    render(<SessionHistory sessions={[]} />);

    expect(screen.getByTestId("session-history-empty")).toBeTruthy();
    expect(screen.getByText("No sessions yet")).toBeTruthy();
  });

  it("shows message count for each session", () => {
    render(<SessionHistory sessions={MOCK_SESSIONS} />);

    const row1 = screen.getByTestId("session-row-sess-1");
    expect(row1.textContent).toContain("5 msgs");

    const row2 = screen.getByTestId("session-row-sess-2");
    expect(row2.textContent).toContain("12 msgs");
  });
});
