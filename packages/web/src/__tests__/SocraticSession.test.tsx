import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, within, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { SocraticSession } from "../pages/SocraticSession";

/* ---- jsdom stubs ---- */

// jsdom doesn't implement scrollTo
Element.prototype.scrollTo = vi.fn();

/* ---- Mock data ---- */

const MOCK_SECTION = {
  id: "1.1",
  title: "Understanding Software Pilots",
  module_id: "1",
  module_title: "Foundations",
  markdown: "# Test content",
  key_intuition: "Key insight here",
};

const MOCK_TUTOR_RESPONSE = {
  reply: "Welcome! Let's explore this topic together.",
  tool_type: "socratic_probe",
};

/* ---- Mock apiClient ---- */

vi.mock("../lib/api-client", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

/* ---- Mock useIsMobile ---- */

vi.mock("../hooks/useIsMobile", () => ({
  useIsMobile: () => false,
}));

import { apiClient } from "../lib/api-client";

const mockGet = vi.mocked(apiClient.get);
const mockPost = vi.mocked(apiClient.post);
const mockPut = vi.mocked(apiClient.put);
const mockDelete = vi.mocked(apiClient.delete);

function renderSession(profile = "new-grad", sectionId = "1.1") {
  return render(
    <MemoryRouter initialEntries={[`/curriculum/${profile}/${sectionId}`]}>
      <Routes>
        <Route path="/curriculum/:profile/:sectionId" element={<SocraticSession />} />
      </Routes>
    </MemoryRouter>,
  );
}

function setupSuccessMocks() {
  mockGet.mockImplementation((path: string) => {
    if (path.endsWith("/conversation")) {
      return Promise.resolve({ messages: [], updated_at: null });
    }
    if (path.startsWith("/api/curriculum/")) {
      return Promise.resolve({ ...MOCK_SECTION });
    }
    return Promise.reject(new Error(`Unexpected GET: ${path}`));
  });

  mockPost.mockImplementation(() => {
    return Promise.resolve({ ...MOCK_TUTOR_RESPONSE });
  });

  mockPut.mockImplementation(() => {
    return Promise.resolve({ saved: true });
  });

  mockDelete.mockImplementation(() => {
    return Promise.resolve({ reset: true });
  });
}

describe("SocraticSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders without crashing", () => {
    setupSuccessMocks();
    renderSession();
    // If we get here without throwing, the component rendered
    expect(document.body).toBeTruthy();
  });

  it("shows loading state initially", () => {
    // Make section fetch hang so loading state persists
    mockGet.mockImplementation((path: string) => {
      if (path.endsWith("/conversation")) {
        return new Promise(() => {}); // never resolves
      }
      return new Promise(() => {}); // never resolves
    });

    renderSession();

    expect(screen.getByText("Loading section...")).toBeTruthy();
  });

  it("shows section title after metadata loads", async () => {
    setupSuccessMocks();

    renderSession();

    await waitFor(() => {
      expect(screen.getByText("Understanding Software Pilots")).toBeTruthy();
    });
  });

  it("shows tutor opening message after loading", async () => {
    setupSuccessMocks();

    renderSession();

    await waitFor(() => {
      expect(
        screen.getByText("Welcome! Let's explore this topic together."),
      ).toBeTruthy();
    });
  });

  it("restores saved conversation instead of sending opening probe", async () => {
    const savedMessages = [
      { role: "tutor", content: "Previously saved tutor message." },
      { role: "user", content: "My earlier reply." },
    ];

    mockGet.mockImplementation((path: string) => {
      if (path.endsWith("/conversation")) {
        return Promise.resolve({ messages: savedMessages, updated_at: "2026-01-01T00:00:00Z" });
      }
      if (path.startsWith("/api/curriculum/")) {
        return Promise.resolve({ ...MOCK_SECTION });
      }
      return Promise.reject(new Error(`Unexpected GET: ${path}`));
    });

    renderSession();

    await waitFor(() => {
      expect(screen.getByText("Previously saved tutor message.")).toBeTruthy();
    });
    expect(screen.getByText("My earlier reply.")).toBeTruthy();

    // The opening probe should NOT have been called
    expect(mockPost).not.toHaveBeenCalled();
  });

  it("renders instruction messages with distinct data-testid and concept label", async () => {
    const savedMessages = [
      { role: "tutor", content: "Let me think about that..." },
      { role: "user", content: "I have no idea what recursion is." },
      {
        role: "tutor",
        content: "Recursion is when a function calls itself.",
        tool_type: "provide_instruction",
        concept: "Recursion",
      },
    ];

    mockGet.mockImplementation((path: string) => {
      if (path.endsWith("/conversation")) {
        return Promise.resolve({ messages: savedMessages, updated_at: "2026-01-01T00:00:00Z" });
      }
      if (path.startsWith("/api/curriculum/")) {
        return Promise.resolve({ ...MOCK_SECTION });
      }
      return Promise.reject(new Error(`Unexpected GET: ${path}`));
    });

    renderSession();

    await waitFor(() => {
      expect(screen.getByTestId("instruction-card")).toBeTruthy();
    });

    // Concept label should be visible
    const conceptLabel = screen.getByTestId("instruction-concept");
    expect(conceptLabel).toBeTruthy();
    expect(conceptLabel.textContent).toBe("Recursion");

    // The instruction content should be rendered
    expect(screen.getByText("Recursion is when a function calls itself.")).toBeTruthy();

    // The "Direct Instruction" label should be visible
    expect(screen.getByText("Direct Instruction")).toBeTruthy();
  });

  it("renders normal tutor messages without instruction styling", async () => {
    const savedMessages = [
      { role: "tutor", content: "What do you think about variables?" },
    ];

    mockGet.mockImplementation((path: string) => {
      if (path.endsWith("/conversation")) {
        return Promise.resolve({ messages: savedMessages, updated_at: "2026-01-01T00:00:00Z" });
      }
      if (path.startsWith("/api/curriculum/")) {
        return Promise.resolve({ ...MOCK_SECTION });
      }
      return Promise.reject(new Error(`Unexpected GET: ${path}`));
    });

    renderSession();

    await waitFor(() => {
      expect(screen.getByText("What do you think about variables?")).toBeTruthy();
    });

    // Should NOT have the instruction card
    expect(screen.queryByTestId("instruction-card")).toBeNull();
    expect(screen.queryByTestId("instruction-concept")).toBeNull();
  });
});

/* ---- Pause card UI ---- */

const MOCK_PAUSE_RESPONSE = {
  reply: "Great work today! Take a well-deserved break.",
  tool_type: "session_pause",
  pause_reason: "learner_requested",
  concepts_covered_so_far: "variables, scope",
  resume_suggestion: "We'll pick up with closures next time.",
};

describe("SocraticSession pause card", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  function setupPauseMocks() {
    let postCallCount = 0;
    mockGet.mockImplementation((path: string) => {
      if (path.endsWith("/conversation")) {
        return Promise.resolve({ messages: [], updated_at: null });
      }
      if (path.startsWith("/api/curriculum/")) {
        return Promise.resolve({ ...MOCK_SECTION });
      }
      return Promise.reject(new Error(`Unexpected GET: ${path}`));
    });

    mockPost.mockImplementation(() => {
      postCallCount++;
      if (postCallCount === 1) {
        // Opening probe
        return Promise.resolve({ ...MOCK_TUTOR_RESPONSE });
      }
      // Second call: pause response
      return Promise.resolve({ ...MOCK_PAUSE_RESPONSE });
    });

    mockPut.mockImplementation(() => Promise.resolve({ saved: true }));
    mockDelete.mockImplementation(() => Promise.resolve({ reset: true }));
  }

  it("renders pause card with acknowledgment text when session is paused", async () => {
    setupPauseMocks();
    renderSession();

    // Wait for tutor opening message
    await waitFor(() => {
      expect(screen.getByText("Welcome! Let's explore this topic together.")).toBeTruthy();
    });

    // Type a message and submit
    const input = screen.getByPlaceholderText("Type your response...");
    const user = userEvent.setup();
    await user.type(input, "I need a break{Enter}");

    // Wait for pause card to appear
    await waitFor(() => {
      expect(screen.getByTestId("session-pause-card")).toBeTruthy();
    });

    const pauseCard = screen.getByTestId("session-pause-card");
    expect(within(pauseCard).getByText("Great work today! Take a well-deserved break.")).toBeTruthy();
    expect(within(pauseCard).getByText("Session Paused")).toBeTruthy();
  });

  it("hides input bar when session is paused", async () => {
    setupPauseMocks();
    renderSession();

    await waitFor(() => {
      expect(screen.getByText("Welcome! Let's explore this topic together.")).toBeTruthy();
    });

    // Verify input is visible before pause
    expect(screen.getByPlaceholderText("Type your response...")).toBeTruthy();

    const user = userEvent.setup();
    const input = screen.getByPlaceholderText("Type your response...");
    await user.type(input, "I need a break{Enter}");

    await waitFor(() => {
      expect(screen.getByTestId("session-pause-card")).toBeTruthy();
    });

    // Input bar should be hidden
    expect(screen.queryByPlaceholderText("Type your response...")).toBeNull();
  });

  it("shows Resume Later and Continue Session buttons", async () => {
    setupPauseMocks();
    renderSession();

    await waitFor(() => {
      expect(screen.getByText("Welcome! Let's explore this topic together.")).toBeTruthy();
    });

    const user = userEvent.setup();
    const input = screen.getByPlaceholderText("Type your response...");
    await user.type(input, "I need a break{Enter}");

    await waitFor(() => {
      expect(screen.getByTestId("session-pause-card")).toBeTruthy();
    });

    expect(screen.getByTestId("resume-later-button")).toBeTruthy();
    expect(screen.getByText("Resume Later")).toBeTruthy();
    expect(screen.getByTestId("continue-session-button")).toBeTruthy();
    expect(screen.getByText("Continue Session")).toBeTruthy();
  });

  it("shows resume suggestion text in pause card", async () => {
    setupPauseMocks();
    renderSession();

    await waitFor(() => {
      expect(screen.getByText("Welcome! Let's explore this topic together.")).toBeTruthy();
    });

    const user = userEvent.setup();
    const input = screen.getByPlaceholderText("Type your response...");
    await user.type(input, "I need a break{Enter}");

    await waitFor(() => {
      expect(screen.getByTestId("session-pause-card")).toBeTruthy();
    });

    expect(screen.getByText("We'll pick up with closures next time.")).toBeTruthy();
  });
});
