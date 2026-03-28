import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TrackSelector } from "../components/TrackSelector";

/* ---- Mock apiClient ---- */

vi.mock("../lib/api-client", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import { apiClient } from "../lib/api-client";

const mockGet = vi.mocked(apiClient.get);

const MOCK_PROFILES = [
  { profile: "level-0", title: "Level 0", starting_position: "Complete beginner", section_count: 8 },
  { profile: "level-1", title: "Level 1", starting_position: "New grad", section_count: 12 },
  { profile: "level-10", title: "Level 10", starting_position: "Veteran", section_count: 10 },
  { profile: "level-20", title: "Level 20", starting_position: "Senior leader", section_count: 6 },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockGet.mockResolvedValue(MOCK_PROFILES);
});

afterEach(() => {
  cleanup();
});

describe("TrackSelector", () => {
  it("renders 4 track options", async () => {
    render(<TrackSelector selectedProfile={null} onSelect={() => {}} />);

    await waitFor(() => {
      expect(screen.getByTestId("track-option-level-0")).toBeTruthy();
    });

    expect(screen.getByTestId("track-option-level-1")).toBeTruthy();
    expect(screen.getByTestId("track-option-level-10")).toBeTruthy();
    expect(screen.getByTestId("track-option-level-20")).toBeTruthy();
  });

  it("calls onSelect with selected profile when clicked", async () => {
    const onSelect = vi.fn();
    render(<TrackSelector selectedProfile={null} onSelect={onSelect} />);

    await waitFor(() => {
      expect(screen.getByTestId("track-option-level-1")).toBeTruthy();
    });

    const user = userEvent.setup();
    await user.click(screen.getByTestId("track-option-level-1"));

    expect(onSelect).toHaveBeenCalledOnce();
    expect(onSelect).toHaveBeenCalledWith("level-1");
  });

  it("highlights current selection with brand background", async () => {
    render(<TrackSelector selectedProfile="level-10" onSelect={() => {}} />);

    await waitFor(() => {
      expect(screen.getByTestId("track-option-level-10")).toBeTruthy();
    });

    const selectedButton = screen.getByTestId("track-option-level-10");
    const unselectedButton = screen.getByTestId("track-option-level-0");

    // Selected button has pilot-blue background
    expect(selectedButton.style.background).toContain("var(--pilot-blue)");
    // Unselected button has subtle background
    expect(unselectedButton.style.background).toContain("var(--bg-subtle)");
  });
});
