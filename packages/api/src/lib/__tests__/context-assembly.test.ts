import { describe, it, expect, mock, beforeEach, afterEach } from "bun:test";
import {
  buildCurriculumContext,
  compressConversation,
  buildConversationContext,
} from "../context-assembly";

/* ---- buildCurriculumContext ---- */

describe("buildCurriculumContext", () => {
  it("includes full markdown for the current section", () => {
    const result = buildCurriculumContext("level-1", "1.1");
    expect(result).toContain("== Curriculum Content ==");
    expect(result).toContain('--- Current Section: 1.1');
    // Should include the actual markdown content (not just title)
    expect(result.length).toBeGreaterThan(200);
  });

  it("includes other sections as summaries", () => {
    const result = buildCurriculumContext("level-1", "1.1");
    // Should have other sections referenced by their IDs
    expect(result).toContain("Other Sections");
  });

  it("returns empty string for unknown profile", () => {
    const result = buildCurriculumContext("nonexistent-profile", "1.1");
    expect(result).toBe("");
  });

  it("returns empty string for unknown section in valid profile", () => {
    const result = buildCurriculumContext("level-1", "99.99");
    expect(result).toBe("");
  });

  it("respects token budget by truncating non-current sections", () => {
    // This test verifies the truncation behavior exists.
    // With real curriculum data, the budget may or may not trigger.
    const result = buildCurriculumContext("level-1", "1.1");
    // Should always produce output for a valid section
    expect(result).toContain("== Curriculum Content ==");
    // Either "summary" or "titles only" should appear for other sections
    const hasSummary = result.includes("Other Sections (summary)");
    const hasTitlesOnly = result.includes("Other Sections (titles only");
    expect(hasSummary || hasTitlesOnly).toBe(true);
  });
});

/* ---- compressConversation ---- */

describe("compressConversation", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("produces summary from mocked Gemini response", async () => {
    const mockSummary = "The learner explored concurrency concepts and showed solid understanding of thread safety.";

    (globalThis as any).fetch = mock(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [{ text: mockSummary }],
                },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
    ) as unknown as typeof fetch;

    const result = await compressConversation(
      "fake-api-key",
      "gemini-2.0-flash",
      [
        { role: "tutor", content: "What do you know about concurrency?" },
        { role: "user", content: "It means running things at the same time." },
      ],
      "Introduction to Concurrency"
    );

    expect(result).toBe(mockSummary);
  });

  it("returns null on API failure", async () => {
    (globalThis as any).fetch = mock(() =>
      Promise.resolve(new Response("Internal Server Error", { status: 500 }))
    ) as unknown as typeof fetch;

    const result = await compressConversation(
      "fake-api-key",
      "gemini-2.0-flash",
      [{ role: "user", content: "Hello" }],
      "Test Section"
    );

    expect(result).toBeNull();
  });

  it("returns null on network error", async () => {
    (globalThis as any).fetch = mock(() =>
      Promise.reject(new Error("Network error"))
    ) as unknown as typeof fetch;

    const result = await compressConversation(
      "fake-api-key",
      "gemini-2.0-flash",
      [{ role: "user", content: "Hello" }],
      "Test Section"
    );

    expect(result).toBeNull();
  });

  it("returns null for empty messages", async () => {
    const result = await compressConversation(
      "fake-api-key",
      "gemini-2.0-flash",
      [],
      "Test Section"
    );

    expect(result).toBeNull();
  });

  it("returns null when Gemini returns empty text", async () => {
    (globalThis as any).fetch = mock(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            candidates: [{ content: { parts: [{ text: "" }] } }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
    ) as unknown as typeof fetch;

    const result = await compressConversation(
      "fake-api-key",
      "gemini-2.0-flash",
      [{ role: "user", content: "Hello" }],
      "Test Section"
    );

    expect(result).toBeNull();
  });
});

/* ---- buildConversationContext ---- */

describe("buildConversationContext", () => {
  // Create a mock D1Database
  function createMockDb(rows: Array<{ section_id: string; summary: string; archived_at: string | null }>) {
    return {
      prepare: () => ({
        bind: () => ({
          all: async () => ({ results: rows }),
        }),
      }),
    } as unknown as D1Database;
  }

  it("returns empty string when no summaries exist", async () => {
    const db = createMockDb([]);
    const result = await buildConversationContext(db, "learner1", "level-1", "1.1");
    expect(result).toBe("");
  });

  it("assembles summaries from prior sessions", async () => {
    const db = createMockDb([
      { section_id: "1.1", summary: "Discussed basic concepts.", archived_at: "2025-01-01" },
      { section_id: "1.2", summary: "Explored advanced topics.", archived_at: null },
    ]);

    const result = await buildConversationContext(db, "learner1", "level-1", "1.1");
    expect(result).toContain("== Prior Sessions ==");
    expect(result).toContain("Discussed basic concepts.");
    expect(result).toContain("Explored advanced topics.");
  });

  it("groups current section archived sessions separately", async () => {
    const db = createMockDb([
      { section_id: "1.1", summary: "First attempt at section.", archived_at: "2025-01-01" },
      { section_id: "1.2", summary: "Other section work.", archived_at: "2025-01-02" },
    ]);

    const result = await buildConversationContext(db, "learner1", "level-1", "1.1");
    expect(result).toContain("Previous sessions on current section");
    expect(result).toContain("Sessions on other sections");
  });

  it("handles unknown profile gracefully by falling back to section IDs", async () => {
    const db = createMockDb([
      { section_id: "1.1", summary: "Some discussion.", archived_at: "2025-01-01" },
    ]);

    // Uses an invalid profile, but buildConversationContext catches the error
    // and falls back to using section IDs as titles
    const result = await buildConversationContext(db, "learner1", "nonexistent", "1.1");
    expect(result).toContain("== Prior Sessions ==");
    expect(result).toContain("1.1");
  });
});
