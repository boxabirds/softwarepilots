import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
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
});
