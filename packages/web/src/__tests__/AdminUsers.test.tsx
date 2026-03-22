import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { Admin } from "../pages/Admin";

/* ---- Constants ---- */

const ADMIN_KEY = "test-admin-key";
const ADMIN_STORAGE_KEY = "softwarepilots_admin_key";

const MOCK_FEEDBACK = [
  {
    id: 1,
    profile: "level-1",
    section_id: "1.1",
    message_content: "msg",
    message_index: 0,
    feedback_text: "fb",
    created_at: "2026-03-20T12:00:00Z",
    learner_name: "Alice",
  },
];

const MOCK_USERS = [
  {
    id: "user-001",
    display_name: "Alice Smith",
    email: "alice@example.com",
    enrolled_at: "2026-01-15T10:00:00Z",
    last_active_at: "2026-03-21T14:30:00Z",
    profiles: [
      {
        profile: "level-0",
        sections_started: 2,
        sections_completed: 1,
        total_sections: 8,
        claim_percentage: 45,
      },
    ],
  },
  {
    id: "user-002",
    display_name: "Bob Jones",
    email: "bob@example.com",
    enrolled_at: "2026-02-01T09:00:00Z",
    last_active_at: "2026-02-10T11:00:00Z",
    profiles: [],
  },
  {
    id: "user-003",
    display_name: "Carol Chen",
    email: "carol@example.com",
    enrolled_at: "2026-03-01T08:00:00Z",
    last_active_at: "2026-03-22T09:00:00Z",
    profiles: [
      {
        profile: "level-1",
        sections_started: 1,
        sections_completed: 0,
        total_sections: 10,
        claim_percentage: 10,
      },
    ],
  },
];

/* ---- Fetch mock ---- */

function createFetchMock() {
  return vi.fn(async (input: string | URL | Request) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

    if (url.includes("/api/admin/feedback")) {
      return new Response(JSON.stringify(MOCK_FEEDBACK), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (url.includes("/api/admin/users") && !url.includes("/conversations/") && !url.includes("/progress")) {
      return new Response(JSON.stringify(MOCK_USERS), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (url.match(/\/api\/admin\/users\/[^/]+\/progress/)) {
      return new Response(JSON.stringify({ learner: {}, profiles: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response("Not found", { status: 404 });
  });
}

/* ---- Helpers ---- */

function renderAdmin() {
  localStorage.setItem(ADMIN_STORAGE_KEY, ADMIN_KEY);
  return render(
    <MemoryRouter initialEntries={["/admin?tab=users"]}>
      <Admin />
    </MemoryRouter>
  );
}

/* ---- Tests ---- */

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("UserList renders names and search filtering", () => {
  it("renders all user display names", async () => {
    const fetchMock = createFetchMock();
    vi.stubGlobal("fetch", fetchMock);

    renderAdmin();

    await waitFor(() => {
      expect(screen.getByTestId("user-list")).toBeTruthy();
    });

    expect(screen.getByText("Alice Smith")).toBeTruthy();
    expect(screen.getByText("Bob Jones")).toBeTruthy();
    expect(screen.getByText("Carol Chen")).toBeTruthy();
  });

  it("renders user rows with correct test IDs", async () => {
    const fetchMock = createFetchMock();
    vi.stubGlobal("fetch", fetchMock);

    renderAdmin();

    await waitFor(() => {
      expect(screen.getByTestId("user-row-user-001")).toBeTruthy();
    });

    expect(screen.getByTestId("user-row-user-002")).toBeTruthy();
    expect(screen.getByTestId("user-row-user-003")).toBeTruthy();
  });

  it("filters users by search text matching display name", async () => {
    const fetchMock = createFetchMock();
    vi.stubGlobal("fetch", fetchMock);

    renderAdmin();

    await waitFor(() => {
      expect(screen.getByTestId("user-list")).toBeTruthy();
    });

    const user = userEvent.setup();
    const searchInput = screen.getByTestId("filter-search");
    await user.type(searchInput, "Carol");

    // Only Carol should remain visible
    expect(screen.getByTestId("user-row-user-003")).toBeTruthy();
    expect(screen.queryByTestId("user-row-user-001")).toBeNull();
    expect(screen.queryByTestId("user-row-user-002")).toBeNull();
  });

  it("search is case-insensitive", async () => {
    const fetchMock = createFetchMock();
    vi.stubGlobal("fetch", fetchMock);

    renderAdmin();

    await waitFor(() => {
      expect(screen.getByTestId("user-list")).toBeTruthy();
    });

    const user = userEvent.setup();
    const searchInput = screen.getByTestId("filter-search");
    await user.type(searchInput, "bob");

    expect(screen.getByTestId("user-row-user-002")).toBeTruthy();
    expect(screen.queryByTestId("user-row-user-001")).toBeNull();
    expect(screen.queryByTestId("user-row-user-003")).toBeNull();
  });

  it("shows empty state when search matches no users", async () => {
    const fetchMock = createFetchMock();
    vi.stubGlobal("fetch", fetchMock);

    renderAdmin();

    await waitFor(() => {
      expect(screen.getByTestId("user-list")).toBeTruthy();
    });

    const user = userEvent.setup();
    const searchInput = screen.getByTestId("filter-search");
    await user.type(searchInput, "zzz-no-match");

    expect(screen.queryByTestId("user-row-user-001")).toBeNull();
    expect(screen.queryByTestId("user-row-user-002")).toBeNull();
    expect(screen.queryByTestId("user-row-user-003")).toBeNull();
  });
});
