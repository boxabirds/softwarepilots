import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

/* ---- Constants ---- */

const ADMIN_KEY = "test-admin-key";
const ADMIN_STORAGE_KEY = "softwarepilots_admin_key";

/* ---- Import after mocks ---- */

import { Admin } from "../pages/Admin";

/* ---- Helpers ---- */

function createFetchMock(feedbackData: unknown[] = []) {
  return vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
    const authHeader = init?.headers
      ? (init.headers as Record<string, string>)["Authorization"] ?? ""
      : "";

    if (!authHeader.includes(ADMIN_KEY)) {
      return new Response("Unauthorized", { status: 401 });
    }

    if (url.includes("/api/admin/feedback")) {
      return new Response(JSON.stringify(feedbackData), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response("Not found", { status: 404 });
  });
}

function renderAdmin() {
  localStorage.setItem(ADMIN_STORAGE_KEY, ADMIN_KEY);
  return render(
    <MemoryRouter initialEntries={["/admin"]}>
      <Admin />
    </MemoryRouter>
  );
}

const MOCK_FEEDBACK = [
  {
    id: 1,
    profile: "level-1",
    section_id: "1.1",
    message_content: "This is a test message about concurrency patterns in distributed systems that is quite long",
    message_index: 0,
    feedback_text: "This feedback explains why the explanation was helpful for understanding the concept",
    created_at: new Date().toISOString(),
    learner_name: "Alice",
  },
  {
    id: 2,
    profile: "level-10",
    section_id: "2.3",
    message_content: "Short msg",
    message_index: 5,
    feedback_text: "Brief feedback",
    created_at: new Date(Date.now() - 86400000).toISOString(),
    learner_name: "Bob",
  },
];

/* ---- Tests ---- */

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("Admin page", () => {
  it("renders Feedback tab", async () => {
    const fetchMock = createFetchMock();
    vi.stubGlobal("fetch", fetchMock);

    renderAdmin();
    await waitFor(() => {
      expect(screen.getByTestId("tab-feedback")).toBeTruthy();
    });
    expect(screen.getByTestId("tab-feedback").textContent).toBe("Feedback");
  });

  it("renders feedback entries in a table", async () => {
    const fetchMock = createFetchMock(MOCK_FEEDBACK);
    vi.stubGlobal("fetch", fetchMock);

    renderAdmin();

    await waitFor(() => {
      expect(screen.getByTestId("feedback-table")).toBeTruthy();
    });

    expect(screen.getByTestId("feedback-row-1")).toBeTruthy();
    expect(screen.getByTestId("feedback-row-2")).toBeTruthy();
    expect(screen.getByText("Alice")).toBeTruthy();
    expect(screen.getByText("Bob")).toBeTruthy();
  });

  it("shows empty state when no entries", async () => {
    const fetchMock = createFetchMock([]);
    vi.stubGlobal("fetch", fetchMock);

    renderAdmin();

    await waitFor(() => {
      expect(screen.getByTestId("empty-state")).toBeTruthy();
    });

    expect(screen.getByText("No feedback has been submitted yet")).toBeTruthy();
  });

  it("delete button triggers confirmation", async () => {
    const fetchMock = createFetchMock(MOCK_FEEDBACK);
    vi.stubGlobal("fetch", fetchMock);

    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);

    renderAdmin();

    await waitFor(() => {
      expect(screen.getByTestId("delete-btn-1")).toBeTruthy();
    });

    const user = userEvent.setup();
    await user.click(screen.getByTestId("delete-btn-1"));

    expect(confirmSpy).toHaveBeenCalledWith("Delete this feedback entry?");
    // Since confirm returned false, delete should NOT have been called
    // (no additional fetch calls beyond the initial feedback load)

    confirmSpy.mockRestore();
  });
});
