import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { CurriculumTree } from "../components/CurriculumTree";

/* ---- Mock shared package ---- */

vi.mock("@softwarepilots/shared", () => ({
  getCurriculumSections: (profile: string) => {
    if (profile === "level-1") {
      return [
        {
          id: "1.1",
          module_id: "1",
          module_title: "Fundamentals",
          title: "Introduction to Software",
          key_intuition: "test",
          concepts: [],
          learning_map: { section_id: "1.1", generated_at: "", model_used: "", prerequisites: [], core_claims: [], key_misconceptions: [], key_intuition_decomposition: [] },
        },
        {
          id: "1.2",
          module_id: "1",
          module_title: "Fundamentals",
          title: "Variables and Types",
          key_intuition: "test",
          concepts: [],
          learning_map: { section_id: "1.2", generated_at: "", model_used: "", prerequisites: [], core_claims: [], key_misconceptions: [], key_intuition_decomposition: [] },
        },
        {
          id: "2.1",
          module_id: "2",
          module_title: "Control Flow",
          title: "Conditionals",
          key_intuition: "test",
          concepts: [],
          learning_map: { section_id: "2.1", generated_at: "", model_used: "", prerequisites: [], core_claims: [], key_misconceptions: [], key_intuition_decomposition: [] },
        },
      ];
    }
    throw new Error("Unknown profile");
  },
}));

/* ---- Test data ---- */

const MOCK_PROGRESS_RESPONSE = {
  learner: {
    id: "user-001",
    display_name: "Alice Smith",
    enrolled_at: "2026-01-15T10:00:00Z",
  },
  profiles: [
    {
      profile: "level-1",
      title: "Level 1 - New Graduate",
      sections: [
        {
          section_id: "1.1",
          status: "completed",
          updated_at: "2026-03-20T12:00:00Z",
          claim_progress: {
            demonstrated: 3,
            total: 5,
            percentage: 60,
            missing: ["claim-4", "claim-5"],
          },
        },
        {
          section_id: "1.2",
          status: "in_progress",
          updated_at: "2026-03-21T14:00:00Z",
          claim_progress: {
            demonstrated: 1,
            total: 4,
            percentage: 25,
            missing: ["claim-2", "claim-3", "claim-4"],
          },
        },
        {
          section_id: "2.1",
          status: "in_progress",
          updated_at: "2026-03-22T09:00:00Z",
          claim_progress: {
            demonstrated: 2,
            total: 3,
            percentage: 67,
            missing: ["claim-3"],
          },
        },
      ],
    },
  ],
};

const MOCK_EMPTY_PROGRESS = {
  learner: {
    id: "user-002",
    display_name: "Bob Jones",
    enrolled_at: "2026-02-01T09:00:00Z",
  },
  profiles: [],
};

/* ---- Helpers ---- */

function createMockFetch(response: unknown) {
  return vi.fn().mockResolvedValue(response);
}

function renderTree(props: Partial<React.ComponentProps<typeof CurriculumTree>> = {}) {
  const defaultProps = {
    selectedUserId: null as string | null,
    selectedProfile: null as string | null,
    selectedSection: null as string | null,
    onSelectSection: vi.fn(),
    adminFetch: createMockFetch(MOCK_PROGRESS_RESPONSE),
  };
  return render(
    <MemoryRouter>
      <CurriculumTree {...defaultProps} {...props} />
    </MemoryRouter>
  );
}

/* ---- Tests ---- */

afterEach(cleanup);

describe("CurriculumTree", () => {
  describe("empty states", () => {
    it("shows 'Select a user' when no user is selected", () => {
      renderTree({ selectedUserId: null });
      expect(
        screen.getByText("Select a user to view their progress")
      ).toBeTruthy();
      expect(screen.getByTestId("curriculum-tree-empty")).toBeTruthy();
    });

    it("shows 'no activity' when user has no started curricula", async () => {
      const mockFetch = createMockFetch(MOCK_EMPTY_PROGRESS);
      renderTree({ selectedUserId: "user-002", adminFetch: mockFetch });

      await waitFor(() => {
        expect(screen.getByTestId("curriculum-tree-no-activity")).toBeTruthy();
      });
      expect(
        screen.getByText("This learner has not started any curricula")
      ).toBeTruthy();
    });

    it("shows loading spinner while fetching", () => {
      const neverResolves = vi.fn().mockReturnValue(new Promise(() => {}));
      renderTree({ selectedUserId: "user-001", adminFetch: neverResolves });
      expect(screen.getByTestId("curriculum-tree-loading")).toBeTruthy();
    });

    it("shows error message on fetch failure", async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error("Network error"));
      renderTree({ selectedUserId: "user-001", adminFetch: mockFetch });

      await waitFor(() => {
        expect(screen.getByTestId("curriculum-tree-error")).toBeTruthy();
      });
      expect(screen.getByText("Network error")).toBeTruthy();
    });
  });

  describe("tree rendering", () => {
    it("fetches progress when user is selected", async () => {
      const mockFetch = createMockFetch(MOCK_PROGRESS_RESPONSE);
      renderTree({ selectedUserId: "user-001", adminFetch: mockFetch });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          "/api/admin/users/user-001/progress"
        );
      });
    });

    it("renders profile header with title", async () => {
      renderTree({
        selectedUserId: "user-001",
        adminFetch: createMockFetch(MOCK_PROGRESS_RESPONSE),
      });

      await waitFor(() => {
        expect(screen.getByTestId("curriculum-tree")).toBeTruthy();
      });
      expect(screen.getByText("Level 1 - New Graduate")).toBeTruthy();
    });

    it("renders module headers with titles", async () => {
      renderTree({
        selectedUserId: "user-001",
        adminFetch: createMockFetch(MOCK_PROGRESS_RESPONSE),
      });

      await waitFor(() => {
        expect(screen.getByTestId("module-header-1")).toBeTruthy();
      });
      expect(screen.getByText("Fundamentals")).toBeTruthy();
      expect(screen.getByText("Control Flow")).toBeTruthy();
    });

    it("renders section rows with titles", async () => {
      renderTree({
        selectedUserId: "user-001",
        adminFetch: createMockFetch(MOCK_PROGRESS_RESPONSE),
      });

      await waitFor(() => {
        expect(screen.getByTestId("section-row-1.1")).toBeTruthy();
      });
      expect(screen.getByText("Introduction to Software")).toBeTruthy();
      expect(screen.getByText("Variables and Types")).toBeTruthy();
      expect(screen.getByText("Conditionals")).toBeTruthy();
    });

    it("shows module aggregate percentage", async () => {
      renderTree({
        selectedUserId: "user-001",
        adminFetch: createMockFetch(MOCK_PROGRESS_RESPONSE),
      });

      await waitFor(() => {
        expect(screen.getByTestId("module-percentage-1")).toBeTruthy();
      });
      /* Module 1: demonstrated = 3+1 = 4, total = 5+4 = 9 => 44% */
      expect(screen.getByTestId("module-percentage-1").textContent).toBe(
        "44%"
      );
      /* Module 2: demonstrated = 2, total = 3 => 67% */
      expect(screen.getByTestId("module-percentage-2").textContent).toBe(
        "67%"
      );
    });

    it("renders ProgressBadge for each section", async () => {
      renderTree({
        selectedUserId: "user-001",
        adminFetch: createMockFetch(MOCK_PROGRESS_RESPONSE),
      });

      await waitFor(() => {
        expect(screen.getByTestId("curriculum-tree")).toBeTruthy();
      });
      /* Each section should have a progress ring since they have claim_progress */
      const rings = screen.getAllByTestId("progress-ring");
      expect(rings.length).toBe(3);
    });
  });

  describe("interaction", () => {
    it("clicking a section calls onSelectSection with profile and section_id", async () => {
      const onSelectSection = vi.fn();
      renderTree({
        selectedUserId: "user-001",
        adminFetch: createMockFetch(MOCK_PROGRESS_RESPONSE),
        onSelectSection,
      });

      await waitFor(() => {
        expect(screen.getByTestId("section-row-1.1")).toBeTruthy();
      });

      const user = userEvent.setup();
      await user.click(screen.getByTestId("section-row-1.1"));

      expect(onSelectSection).toHaveBeenCalledWith("level-1", "1.1");
    });

    it("selected section is highlighted", async () => {
      renderTree({
        selectedUserId: "user-001",
        selectedProfile: "level-1",
        selectedSection: "1.1",
        adminFetch: createMockFetch(MOCK_PROGRESS_RESPONSE),
      });

      await waitFor(() => {
        expect(screen.getByTestId("section-row-1.1")).toBeTruthy();
      });

      const row = screen.getByTestId("section-row-1.1");
      expect(row.className).toContain("bg-primary/10");
    });

    it("collapsing a profile hides its modules", async () => {
      renderTree({
        selectedUserId: "user-001",
        adminFetch: createMockFetch(MOCK_PROGRESS_RESPONSE),
      });

      await waitFor(() => {
        expect(screen.getByTestId("profile-header")).toBeTruthy();
      });

      /* Modules should be visible initially */
      expect(screen.getByTestId("module-header-1")).toBeTruthy();

      const user = userEvent.setup();
      await user.click(screen.getByTestId("profile-header"));

      /* Modules should now be hidden */
      expect(screen.queryByTestId("module-header-1")).toBeNull();
    });

    it("collapsing a module hides its sections", async () => {
      renderTree({
        selectedUserId: "user-001",
        adminFetch: createMockFetch(MOCK_PROGRESS_RESPONSE),
      });

      await waitFor(() => {
        expect(screen.getByTestId("module-header-1")).toBeTruthy();
      });

      /* Sections should be visible initially */
      expect(screen.getByTestId("section-row-1.1")).toBeTruthy();

      const user = userEvent.setup();
      await user.click(screen.getByTestId("module-header-1"));

      /* Sections should now be hidden */
      expect(screen.queryByTestId("section-row-1.1")).toBeNull();
      /* But module 2 sections should still be visible */
      expect(screen.getByTestId("section-row-2.1")).toBeTruthy();
    });

    it("re-fetches when selectedUserId changes", async () => {
      const mockFetch = createMockFetch(MOCK_PROGRESS_RESPONSE);
      const { rerender } = render(
        <MemoryRouter>
          <CurriculumTree
            selectedUserId="user-001"
            selectedProfile={null}
            selectedSection={null}
            onSelectSection={vi.fn()}
            adminFetch={mockFetch}
          />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(1);
      });

      rerender(
        <MemoryRouter>
          <CurriculumTree
            selectedUserId="user-002"
            selectedProfile={null}
            selectedSection={null}
            onSelectSection={vi.fn()}
            adminFetch={mockFetch}
          />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(2);
      });
      expect(mockFetch).toHaveBeenLastCalledWith(
        "/api/admin/users/user-002/progress"
      );
    });
  });
});
