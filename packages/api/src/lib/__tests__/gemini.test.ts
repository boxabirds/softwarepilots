import { describe, it, expect, beforeEach, spyOn, mock } from "bun:test";
import {
  buildGeminiContents,
  parseGeminiToolResponse,
  callGeminiWithTools,
  getOrUploadFile,
  _clearFileCache,
} from "../gemini";
import type { GeminiFunctionCallResponse } from "../gemini";

/* ---- buildGeminiContents ---- */

describe("buildGeminiContents", () => {
  it("formats conversation history + new message", () => {
    const conversation: Array<{ role: "user" | "tutor"; content: string }> = [
      { role: "user", content: "What is a variable?" },
      { role: "tutor", content: "Think of it as a named container." },
    ];

    const result = buildGeminiContents(conversation, "But why?");

    expect(result).toEqual([
      { role: "user", parts: [{ text: "What is a variable?" }] },
      { role: "model", parts: [{ text: "Think of it as a named container." }] },
      { role: "user", parts: [{ text: "But why?" }] },
    ]);
  });

  it("handles empty conversation", () => {
    const result = buildGeminiContents([], "Hello");

    expect(result).toEqual([
      { role: "user", parts: [{ text: "Hello" }] },
    ]);
  });

  it("maps tutor role to model", () => {
    const result = buildGeminiContents(
      [{ role: "tutor", content: "Hi" }],
      "Hey",
    );

    expect(result[0].role).toBe("model");
  });
});

/* ---- parseGeminiToolResponse ---- */

describe("parseGeminiToolResponse", () => {
  it("handles a single help_with_curriculum function call", () => {
    const data: GeminiFunctionCallResponse = {
      candidates: [
        {
          content: {
            parts: [
              {
                functionCall: {
                  name: "help_with_curriculum",
                  args: {
                    response: "What do you think happens?",
                    topic: "variables",
                  },
                },
              },
            ],
          },
        },
      ],
    };

    const result = parseGeminiToolResponse(data);

    expect(result.reply).toBe("What do you think happens?");
    expect(result.on_topic).toBe(true);
    expect(result.topic).toBe("variables");
    expect(result.step_answer).toBeUndefined();
  });

  it("handles multiple function calls", () => {
    const data: GeminiFunctionCallResponse = {
      candidates: [
        {
          content: {
            parts: [
              {
                functionCall: {
                  name: "provided_step_answer",
                  args: {
                    answer: "42",
                    coaching: "Good thinking!",
                  },
                },
              },
              {
                functionCall: {
                  name: "help_with_curriculum",
                  args: {
                    response: "Now consider what happens next.",
                    topic: "integers",
                  },
                },
              },
            ],
          },
        },
      ],
    };

    const result = parseGeminiToolResponse(data);

    expect(result.step_answer).toBe("42");
    expect(result.reply).toContain("Good thinking!");
    expect(result.reply).toContain("Now consider what happens next.");
    expect(result.topic).toBe("integers");
  });

  it("falls back to text when no function calls present", () => {
    const data: GeminiFunctionCallResponse = {
      candidates: [
        {
          content: {
            parts: [{ text: "Plain text response" }],
          },
        },
      ],
    };

    const result = parseGeminiToolResponse(data);

    expect(result.reply).toBe("Plain text response");
    expect(result.on_topic).toBe(true);
  });

  it("throws on empty response", () => {
    const data: GeminiFunctionCallResponse = {
      candidates: [{ content: { parts: [] } }],
    };

    expect(() => parseGeminiToolResponse(data)).toThrow(
      "No parts in Gemini response",
    );
  });

  it("throws when candidates are missing", () => {
    expect(() => parseGeminiToolResponse({})).toThrow(
      "No parts in Gemini response",
    );
  });

  it("handles unknown tool names gracefully (returns raw args)", () => {
    const data: GeminiFunctionCallResponse = {
      candidates: [
        {
          content: {
            parts: [
              {
                functionCall: {
                  name: "some_unknown_tool",
                  args: { foo: "bar", baz: "qux" },
                },
              },
            ],
          },
        },
      ],
    };

    const result = parseGeminiToolResponse(data);

    // Should not throw, and should include raw args in reply
    expect(result.reply).toBe(JSON.stringify({ foo: "bar", baz: "qux" }));
    expect(result.on_topic).toBe(true);
  });
});

/* ---- getOrUploadFile ---- */

describe("getOrUploadFile", () => {
  beforeEach(() => {
    _clearFileCache();
    mock.restore();
  });

  it("returns cached URI on second call (no extra fetch)", async () => {
    const mockResponse = {
      ok: true,
      json: () =>
        Promise.resolve({
          file: {
            uri: "gs://bucket/file123",
            name: "file123",
            displayName: "test.md",
            mimeType: "text/markdown",
          },
        }),
    };

    const fetchSpy = spyOn(globalThis, "fetch")
      .mockResolvedValue(mockResponse as unknown as Response);

    const uri1 = await getOrUploadFile(
      "key",
      "cache-key-1",
      "# Hello",
      "test.md",
    );
    const uri2 = await getOrUploadFile(
      "key",
      "cache-key-1",
      "# Hello",
      "test.md",
    );

    expect(uri1).toBe("gs://bucket/file123");
    expect(uri2).toBe("gs://bucket/file123");
    // fetch should only have been called once (cache hit on second call)
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("calls fetch for different cache keys", async () => {
    const mockResponse = (uri: string) => ({
      ok: true,
      json: () =>
        Promise.resolve({
          file: {
            uri,
            name: "f",
            displayName: "d",
            mimeType: "text/markdown",
          },
        }),
    });

    const fetchSpy = spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        mockResponse("gs://bucket/a") as unknown as Response,
      )
      .mockResolvedValueOnce(
        mockResponse("gs://bucket/b") as unknown as Response,
      );

    const a = await getOrUploadFile("key", "k1", "a", "a.md");
    const b = await getOrUploadFile("key", "k2", "b", "b.md");

    expect(a).toBe("gs://bucket/a");
    expect(b).toBe("gs://bucket/b");
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});

/* ---- callGeminiWithTools retry logic ---- */

describe("callGeminiWithTools", () => {
  beforeEach(() => {
    mock.restore();
  });

  it("retries on failure then succeeds", async () => {
    const successData: GeminiFunctionCallResponse = {
      candidates: [
        {
          content: {
            parts: [
              {
                functionCall: {
                  name: "help_with_curriculum",
                  args: { response: "Try again!", topic: "retry" },
                },
              },
            ],
          },
        },
      ],
    };

    const fetchSpy = spyOn(globalThis, "fetch")
      // First call: network error
      .mockRejectedValueOnce(new Error("network down"))
      // Second call: success
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(successData),
      } as unknown as Response);

    const result = await callGeminiWithTools(
      "test-key",
      "gemini-2.0-flash",
      "system prompt",
      [{ role: "user", parts: [{ text: "hi" }] }],
      [{ functionDeclarations: [] }],
    );

    expect(result.reply).toBe("Try again!");
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("throws after exhausting retries", async () => {
    spyOn(globalThis, "fetch").mockRejectedValue(
      new Error("persistent failure"),
    );

    await expect(
      callGeminiWithTools(
        "test-key",
        "gemini-2.0-flash",
        "system prompt",
        [{ role: "user", parts: [{ text: "hi" }] }],
        [{ functionDeclarations: [] }],
      ),
    ).rejects.toThrow("persistent failure");
  });
});
