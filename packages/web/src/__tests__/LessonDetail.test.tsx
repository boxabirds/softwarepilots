import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { LessonDetail } from "../pages/LessonDetail";

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

/* ---- Mock data ---- */

const MOCK_SECTION = {
  id: "1.1",
  module_id: "1",
  module_title: "Foundations",
  title: "Understanding Software Pilots",
  key_intuition: "Software pilots bridge human judgment and AI capability.",
};

const MOCK_PROGRESS_NOT_STARTED: never[] = [];

const MOCK_PROGRESS_IN_PROGRESS = [
  {
    section_id: "1.1",
    status: "in_progress",
    claim_progress: { demonstrated: 2, total: 5, percentage: 40 },
    updated_at: "2026-03-20T10:00:00Z",
  },
];

const MOCK_SESSIONS_EMPTY: never[] = [];

const MOCK_SESSIONS_WITH_ACTIVE = [
  {
    id: "sess-1",
    created_at: "2026-03-20T10:00:00Z",
    archived_at: null,
    summary: null,
    message_count: 5,
    status: "active",
  },
];

const MOCK_SESSIONS_ARCHIVED_ONLY = [
  {
    id: "sess-old",
    created_at: "2026-03-18T10:00:00Z",
    archived_at: "2026-03-18T12:00:00Z",
    summary: "Discussed variables.",
    message_count: 8,
    status: "archived",
  },
];

/* ---- Helpers ---- */

function renderLessonDetail(profile = "level-1", sectionId = "1.1") {
  return render(
    <MemoryRouter initialEntries={[`/curriculum/${profile}/${sectionId}/detail`]}>
      <Routes>
        <Route path="/curriculum/:profile/:sectionId/detail" element={<LessonDetail />} />
      </Routes>
    </MemoryRouter>,
  );
}

function setupMocks(opts: {
  progress?: unknown[];
  sessions?: unknown[];
} = {}) {
  const progress = opts.progress ?? MOCK_PROGRESS_NOT_STARTED;
  const sessions = opts.sessions ?? MOCK_SESSIONS_EMPTY;

  mockGet.mockImplementation((path: string) => {
    if (path.endsWith("/sessions")) {
      return Promise.resolve(sessions);
    }
    if (path.endsWith("/progress")) {
      return Promise.resolve(progress);
    }
    if (path.startsWith("/api/curriculum/")) {
      return Promise.resolve({ ...MOCK_SECTION });
    }
    return Promise.reject(new Error(`Unexpected GET: ${path}`));
  });
}

/* ---- Tests ---- */

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe("LessonDetail", () => {
  it("renders lesson title and key insight", async () => {
    setupMocks();
    renderLessonDetail();

    await waitFor(() => {
      expect(screen.getByTestId("lesson-detail")).toBeTruthy();
    });

    expect(screen.getByText("Understanding Software Pilots")).toBeTruthy();
    expect(screen.getByText("Software pilots bridge human judgment and AI capability.")).toBeTruthy();
  });

  it("shows session history section", async () => {
    setupMocks({ sessions: MOCK_SESSIONS_WITH_ACTIVE });
    renderLessonDetail();

    await waitFor(() => {
      expect(screen.getByTestId("lesson-detail")).toBeTruthy();
    });

    expect(screen.getByText("Sessions")).toBeTruthy();
    // SessionHistory component renders with active session
    expect(screen.getByText("Active")).toBeTruthy();
  });

  it("shows 'Begin lesson' when no sessions exist", async () => {
    setupMocks({ sessions: MOCK_SESSIONS_EMPTY });
    renderLessonDetail();

    await waitFor(() => {
      expect(screen.getByTestId("lesson-detail")).toBeTruthy();
    });

    expect(screen.getByTestId("begin-lesson")).toBeTruthy();
    expect(screen.getByText("Begin lesson")).toBeTruthy();
    // Should not show "Continue session" when there are no sessions
    expect(screen.queryByTestId("continue-session")).toBeNull();
  });

  it("shows 'Continue session' when active session exists", async () => {
    setupMocks({ sessions: MOCK_SESSIONS_WITH_ACTIVE });
    renderLessonDetail();

    await waitFor(() => {
      expect(screen.getByTestId("lesson-detail")).toBeTruthy();
    });

    expect(screen.getByTestId("continue-session")).toBeTruthy();
    expect(screen.getByText("Continue session")).toBeTruthy();
  });

  it("AI disclaimer is present", async () => {
    setupMocks();
    renderLessonDetail();

    await waitFor(() => {
      expect(screen.getByTestId("lesson-detail")).toBeTruthy();
    });

    expect(screen.getByTestId("ai-disclaimer")).toBeTruthy();
  });

  it("shows empty state in session history when no sessions", async () => {
    setupMocks({ sessions: MOCK_SESSIONS_EMPTY });
    renderLessonDetail();

    await waitFor(() => {
      expect(screen.getByTestId("lesson-detail")).toBeTruthy();
    });

    expect(screen.getByTestId("session-history-empty")).toBeTruthy();
    expect(screen.getByText("No sessions yet")).toBeTruthy();
  });
});
