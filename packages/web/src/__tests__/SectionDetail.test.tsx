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
];

const MOCK_CONVERSATIONS = {
  conversations: [
    {
      id: "conv-active",
      messages: [
        { role: "user", content: "What is a variable?", timestamp: "2026-03-22T14:30:00Z" },
        { role: "assistant", content: "A variable is a named storage location.", timestamp: "2026-03-22T14:30:22Z" },
      ],
      summary: null,
      archived_at: null,
      created_at: "2026-03-22T14:00:00Z",
    },
    {
      id: "conv-archived-summary",
      messages: [
        { role: "user", content: "Tell me about loops", timestamp: "2026-03-21T10:00:00Z" },
        { role: "assistant", content: "Loops repeat code blocks.", timestamp: "2026-03-21T10:01:00Z" },
      ],
      summary: "Covered basics of loop constructs including for and while loops.",
      archived_at: "2026-03-21T11:00:00Z",
      created_at: "2026-03-21T09:00:00Z",
    },
    {
      id: "conv-archived-no-summary",
      messages: [],
      summary: null,
      archived_at: "2026-03-20T15:00:00Z",
      created_at: "2026-03-20T14:00:00Z",
    },
  ],
};

const MOCK_CONVERSATIONS_EMPTY = { conversations: [] };

const MOCK_USER_PROGRESS = {
  learner: {
    id: "user-001",
    display_name: "Alice Smith",
    enrolled_at: "2026-01-15T10:00:00Z",
  },
  profiles: [
    {
      profile: "level-0",
      title: "Level 0",
      sections: [
        {
          section_id: "1.1",
          status: "in_progress",
          updated_at: "2026-03-22T14:30:00Z",
          understanding_level: "developing",
          concepts_json: null,
          claims_json: null,
          claim_progress: {
            demonstrated: 0,
            total: 0,
            percentage: 0,
            missing: [],
          },
        },
      ],
    },
  ],
};

/* ---- Fetch mock ---- */

function createFetchMock() {
  return vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const authHeader = init?.headers
      ? (init.headers as Record<string, string>)["Authorization"] ?? ""
      : "";

    if (!authHeader.includes(ADMIN_KEY)) {
      return new Response("Unauthorized", { status: 401 });
    }

    if (url.includes("/api/admin/feedback")) {
      return new Response(JSON.stringify(MOCK_FEEDBACK), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (url.match(/\/api\/admin\/users\/[^/]+\/section-events\//)) {
      return new Response(JSON.stringify({
        status: "not_started",
        understanding_json: "[]",
        claims_json: "[]",
        concepts_json: "[]",
        started_at: null,
        completed_at: null,
        paused_at: null,
        updated_at: null,
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (url.match(/\/api\/admin\/users\/[^/]+\/progress/)) {
      return new Response(JSON.stringify(MOCK_USER_PROGRESS), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (url.includes("/api/admin/users") && !url.includes("/conversations/") && !url.includes("/progress") && !url.includes("/section-events/")) {
      return new Response(JSON.stringify(MOCK_USERS), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (url.includes("/conversations/")) {
      return new Response(JSON.stringify(MOCK_CONVERSATIONS), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response("Not found", { status: 404 });
  });
}

/* ---- Helpers ---- */

function renderAdmin(params = "") {
  localStorage.setItem(ADMIN_STORAGE_KEY, ADMIN_KEY);
  return render(
    <MemoryRouter initialEntries={[`/admin?tab=users${params}`]}>
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

describe("SectionDetail", () => {
  it("shows 'Select a section' when no section is selected", async () => {
    const fetchMock = createFetchMock();
    vi.stubGlobal("fetch", fetchMock);

    renderAdmin("&user=user-001&profile=level-0");

    await waitFor(() => {
      expect(screen.getByTestId("column-right")).toBeTruthy();
    });

    expect(screen.getByText("Select a section to view details")).toBeTruthy();
  });

  it("renders SectionDetail with conversation/events tabs when section selected", async () => {
    const fetchMock = createFetchMock();
    vi.stubGlobal("fetch", fetchMock);

    renderAdmin("&user=user-001&profile=level-0&section=1.1");

    await waitFor(() => {
      expect(screen.getByTestId("section-detail")).toBeTruthy();
    });

    expect(screen.getByTestId("section-tab-conversation")).toBeTruthy();
    expect(screen.getByTestId("section-tab-events")).toBeTruthy();
  });

  it("shows conversation messages with learner/tutor labels", async () => {
    const fetchMock = createFetchMock();
    vi.stubGlobal("fetch", fetchMock);

    renderAdmin("&user=user-001&profile=level-0&section=1.1");

    await waitFor(() => {
      expect(screen.getByText("What is a variable?")).toBeTruthy();
    });

    expect(screen.getByText("A variable is a named storage location.")).toBeTruthy();
    // Should show sender labels
    const learnerLabels = screen.getAllByText("Learner");
    expect(learnerLabels.length).toBeGreaterThanOrEqual(1);
    const tutorLabels = screen.getAllByText("Tutor");
    expect(tutorLabels.length).toBeGreaterThanOrEqual(1);
  });

  it("shows ISO timestamps on messages", async () => {
    const fetchMock = createFetchMock();
    vi.stubGlobal("fetch", fetchMock);

    renderAdmin("&user=user-001&profile=level-0&section=1.1");

    await waitFor(() => {
      expect(screen.getByText("What is a variable?")).toBeTruthy();
    });

    // ISO timestamp format: 2026-03-22 14:30:00
    expect(screen.getByText("2026-03-22 14:30:00")).toBeTruthy();
    expect(screen.getByText("2026-03-22 14:30:22")).toBeTruthy();
  });

  it("shows 'Current session' for active conversations", async () => {
    const fetchMock = createFetchMock();
    vi.stubGlobal("fetch", fetchMock);

    renderAdmin("&user=user-001&profile=level-0&section=1.1");

    await waitFor(() => {
      expect(screen.getByTestId("conversation-conv-active")).toBeTruthy();
    });

    expect(screen.getByTestId("conversation-conv-active").textContent).toContain("Current session");
  });

  it("shows summary banner for archived sessions with summary", async () => {
    const fetchMock = createFetchMock();
    vi.stubGlobal("fetch", fetchMock);

    renderAdmin("&user=user-001&profile=level-0&section=1.1");

    await waitFor(() => {
      expect(screen.getByTestId("conversation-conv-archived-summary")).toBeTruthy();
    });

    expect(screen.getByText("Session Summary")).toBeTruthy();
    expect(
      screen.getByText("Covered basics of loop constructs including for and while loops.")
    ).toBeTruthy();
  });

  it("shows 'no summary available' for archived sessions without summary", async () => {
    const fetchMock = createFetchMock();
    vi.stubGlobal("fetch", fetchMock);

    renderAdmin("&user=user-001&profile=level-0&section=1.1");

    await waitFor(() => {
      expect(screen.getByTestId("conversation-conv-archived-no-summary")).toBeTruthy();
    });

    expect(
      screen.getByText("Session archived (no summary available)")
    ).toBeTruthy();
  });

  it("shows 'No conversations yet' when there are no conversations", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

      if (url.includes("/api/admin/feedback")) {
        return new Response(JSON.stringify(MOCK_FEEDBACK), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url.match(/\/api\/admin\/users\/[^/]+\/progress/)) {
        return new Response(JSON.stringify(MOCK_USER_PROGRESS), {
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
      if (url.includes("/conversations/")) {
        return new Response(JSON.stringify(MOCK_CONVERSATIONS_EMPTY), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response("Not found", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    renderAdmin("&user=user-001&profile=level-0&section=1.1");

    await waitFor(() => {
      expect(screen.getByTestId("no-conversations")).toBeTruthy();
    });

    expect(screen.getByText("No conversations yet")).toBeTruthy();
  });

  it("shows 'No claim data recorded' when no claims exist", async () => {
    const fetchMock = createFetchMock();
    vi.stubGlobal("fetch", fetchMock);

    renderAdmin("&user=user-001&profile=level-0&section=1.1");

    await waitFor(() => {
      expect(screen.getByTestId("section-detail")).toBeTruthy();
    });

    // With no progress data passed, should show no claim data
    expect(screen.getByTestId("no-claim-data")).toBeTruthy();
  });

  it("switches to Events tab and shows placeholder", async () => {
    const fetchMock = createFetchMock();
    vi.stubGlobal("fetch", fetchMock);

    renderAdmin("&user=user-001&profile=level-0&section=1.1");

    await waitFor(() => {
      expect(screen.getByTestId("section-detail")).toBeTruthy();
    });

    const user = userEvent.setup();
    await user.click(screen.getByTestId("section-tab-events"));

    expect(screen.getByText("No events recorded for this section")).toBeTruthy();
  });

  it("shows section ID and profile in the header", async () => {
    const fetchMock = createFetchMock();
    vi.stubGlobal("fetch", fetchMock);

    renderAdmin("&user=user-001&profile=level-0&section=1.1");

    await waitFor(() => {
      expect(screen.getByTestId("section-detail")).toBeTruthy();
    });

    expect(screen.getByText("1.1")).toBeTruthy();
    expect(screen.getByText("level-0")).toBeTruthy();
  });
});
