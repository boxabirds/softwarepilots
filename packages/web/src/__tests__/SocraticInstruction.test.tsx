import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { SocraticSession } from "../pages/SocraticSession";

/* ---- jsdom stubs ---- */

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

/* ---- Mock apiClient ---- */

vi.mock("../lib/api-client", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("../hooks/useIsMobile", () => ({
  useIsMobile: () => false,
}));

import { apiClient } from "../lib/api-client";

const mockGet = vi.mocked(apiClient.get);
const mockPost = vi.mocked(apiClient.post);
const mockPut = vi.mocked(apiClient.put);

function renderSession() {
  return render(
    <MemoryRouter initialEntries={["/curriculum/level-1/1.1"]}>
      <Routes>
        <Route path="/curriculum/:profile/:sectionId" element={<SocraticSession />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("provide_instruction rendering (58.2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders provide_instruction message as instruction-card with lightbulb", async () => {
    const INSTRUCTION_TEXT = "Here is a thorough explanation of the concept.";

    mockGet.mockImplementation((path: string) => {
      if (path.endsWith("/conversation")) {
        return Promise.resolve({
          messages: [
            {
              role: "tutor",
              content: INSTRUCTION_TEXT,
              tool_type: "provide_instruction",
              concept: "closures",
            },
          ],
          updated_at: "2026-01-01T00:00:00Z",
        });
      }
      if (path.includes("/progress")) {
        return Promise.resolve([]);
      }
      return Promise.resolve({ ...MOCK_SECTION });
    });

    mockPost.mockResolvedValue({ reply: "Follow-up question", tool_type: "socratic_probe" });
    mockPut.mockResolvedValue({ saved: true });

    renderSession();

    // Wait for the instruction content to appear
    await waitFor(() => {
      expect(screen.getByText(INSTRUCTION_TEXT)).toBeTruthy();
    });

    // Should render as instruction-card (amber variant)
    expect(screen.getByTestId("instruction-card")).toBeTruthy();
    // No "Direct Instruction" header text
    expect(screen.queryByText("Direct Instruction")).toBeNull();
  });

  it("normal tutor message (socratic_probe) has no teacher cap emoji", async () => {
    const PROBE_TEXT = "What do you think about closures?";

    mockGet.mockImplementation((path: string) => {
      if (path.endsWith("/conversation")) {
        return Promise.resolve({
          messages: [
            {
              role: "tutor",
              content: PROBE_TEXT,
              tool_type: "socratic_probe",
            },
          ],
          updated_at: "2026-01-01T00:00:00Z",
        });
      }
      if (path.includes("/progress")) {
        return Promise.resolve([]);
      }
      return Promise.resolve({ ...MOCK_SECTION });
    });

    mockPost.mockResolvedValue({ reply: "Follow-up", tool_type: "socratic_probe" });
    mockPut.mockResolvedValue({ saved: true });

    renderSession();

    await waitFor(() => {
      expect(screen.getByText(PROBE_TEXT)).toBeTruthy();
    });

    // Should NOT have instruction-card styling
    expect(screen.queryByTestId("instruction-card")).toBeNull();
  });
});

describe("saveConversation metadata preservation (58.3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("PUT body includes tool_type and concept when present after user sends message", async () => {
    const user = userEvent.setup();

    mockGet.mockImplementation((path: string) => {
      if (path.endsWith("/conversation")) {
        return Promise.resolve({
          messages: [
            {
              role: "tutor",
              content: "Welcome!",
              tool_type: "socratic_probe",
            },
          ],
          updated_at: "2026-01-01T00:00:00Z",
        });
      }
      if (path.includes("/progress")) {
        return Promise.resolve([]);
      }
      return Promise.resolve({ ...MOCK_SECTION });
    });

    mockPost.mockResolvedValue({
      reply: "Good thinking! Here is an explanation.",
      tool_type: "provide_instruction",
      concept: "closures",
    });
    mockPut.mockResolvedValue({ saved: true });

    renderSession();

    // Wait for the initial tutor message to render
    await waitFor(() => {
      expect(screen.getByText("Welcome!")).toBeTruthy();
    });

    // Type and send a message
    const textarea = screen.getByRole("textbox");
    await user.type(textarea, "I don't understand closures");
    await user.keyboard("{Shift>}{Enter}{/Shift}");

    // Wait for the reply to appear
    await waitFor(() => {
      expect(screen.getByText(/Good thinking/)).toBeTruthy();
    });

    // Check that saveConversation (PUT) was called with metadata preserved
    const putCalls = mockPut.mock.calls;
    expect(putCalls.length).toBeGreaterThan(0);

    const lastPutBody = putCalls[putCalls.length - 1][1] as { messages: Array<Record<string, unknown>> };
    const messages = lastPutBody.messages;

    // Find the tutor reply with provide_instruction
    const instructionMsg = messages.find(
      (m) => m.tool_type === "provide_instruction"
    );
    expect(instructionMsg).toBeDefined();
    expect(instructionMsg!.concept).toBe("closures");
  });

  it("messages without tool_type are saved cleanly (no undefined fields)", async () => {
    const user = userEvent.setup();

    mockGet.mockImplementation((path: string) => {
      if (path.endsWith("/conversation")) {
        return Promise.resolve({
          messages: [
            { role: "tutor", content: "Welcome!" },
          ],
          updated_at: "2026-01-01T00:00:00Z",
        });
      }
      if (path.includes("/progress")) {
        return Promise.resolve([]);
      }
      return Promise.resolve({ ...MOCK_SECTION });
    });

    mockPost.mockResolvedValue({
      reply: "Tell me more.",
      tool_type: "socratic_probe",
    });
    mockPut.mockResolvedValue({ saved: true });

    renderSession();

    await waitFor(() => {
      expect(screen.getByText("Welcome!")).toBeTruthy();
    });

    const textarea = screen.getByRole("textbox");
    await user.type(textarea, "Hello tutor");
    await user.keyboard("{Shift>}{Enter}{/Shift}");

    await waitFor(() => {
      expect(screen.getByText("Tell me more.")).toBeTruthy();
    });

    const putCalls = mockPut.mock.calls;
    expect(putCalls.length).toBeGreaterThan(0);

    const lastPutBody = putCalls[putCalls.length - 1][1] as { messages: Array<Record<string, unknown>> };
    const messages = lastPutBody.messages;

    // User messages should not have tool_type or concept keys at all
    const userMsg = messages.find((m) => m.role === "user");
    expect(userMsg).toBeDefined();
    expect("tool_type" in userMsg!).toBe(false);
    expect("concept" in userMsg!).toBe(false);

    // The initial tutor message (no tool_type originally) should also not have undefined fields
    const initialTutor = messages.find(
      (m) => m.role === "tutor" && m.content === "Welcome!"
    );
    expect(initialTutor).toBeDefined();
    // If tool_type was undefined, it should not appear as a key
    if ("tool_type" in initialTutor!) {
      expect(initialTutor!.tool_type).not.toBeUndefined();
    }
  });
});
