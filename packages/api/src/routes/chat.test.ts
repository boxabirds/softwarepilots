import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  buildTutorSystemPrompt,
  buildGeminiContents,
  messageCounts,
  EXERCISE_CONTEXT,
  MAX_MESSAGES_PER_SESSION,
} from "./chat";

/* ---- Test fixtures ---- */

const EXERCISE_21 = EXERCISE_CONTEXT["2.1"];

const baseContext = () => ({
  current_step: 0,
  code: 'print("hello")',
  snapshots: [] as Array<{ code: string; output: string }>,
  submitted_inputs: {} as Record<number, string>,
  conversation: [] as Array<{ role: "user" | "tutor"; content: string }>,
});

const helpCurriculumResponse = (response: string, topic: string) => ({
  ok: true,
  status: 200,
  text: async () => "",
  json: async () => ({
    candidates: [
      {
        content: {
          parts: [
            {
              functionCall: {
                name: "help_with_curriculum",
                args: { response, topic },
              },
            },
          ],
        },
      },
    ],
  }),
});

const offTopicResponse = (hint: string) => ({
  ok: true,
  status: 200,
  text: async () => "",
  json: async () => ({
    candidates: [
      {
        content: {
          parts: [
            {
              functionCall: {
                name: "off_topic_detected",
                args: { redirect_hint: hint },
              },
            },
          ],
        },
      },
    ],
  }),
});

const errorResponse = (status: number, body: string) => ({
  ok: false,
  status,
  text: async () => body,
  json: async () => ({}),
});

const malformedResponse = () => ({
  ok: true,
  status: 200,
  text: async () => "",
  json: async () => ({
    candidates: [{ content: { parts: [{ text: "no function call here" }] } }],
  }),
});

/* ---- Tests ---- */

describe("buildTutorSystemPrompt", () => {
  it("includes exercise title and starter code", () => {
    const prompt = buildTutorSystemPrompt(EXERCISE_21, baseContext());
    expect(prompt).toContain("The Compiler Moment");
    expect(prompt).toContain("price = 10");
    expect(prompt).toContain("str(price + tax)");
  });

  it("includes current code", () => {
    const ctx = baseContext();
    ctx.code = 'label = "Total: " + (price + tax)';
    const prompt = buildTutorSystemPrompt(EXERCISE_21, ctx);
    expect(prompt).toContain('label = "Total: " + (price + tax)');
  });

  it("includes run history when snapshots exist", () => {
    const ctx = baseContext();
    ctx.snapshots = [
      { code: "print(1)", output: "1" },
      { code: "print(2)", output: "TypeError: can only concatenate str" },
    ];
    const prompt = buildTutorSystemPrompt(EXERCISE_21, ctx);
    expect(prompt).toContain("Run #1 output: 1");
    expect(prompt).toContain("Run #2 output: TypeError");
  });

  it("includes learner predictions", () => {
    const ctx = baseContext();
    ctx.submitted_inputs = { 0: "Total: 12.0 | Cheap? False" };
    const prompt = buildTutorSystemPrompt(EXERCISE_21, ctx);
    expect(prompt).toContain('Step 0: "Total: 12.0 | Cheap? False"');
  });

  it("includes current step number", () => {
    const ctx = baseContext();
    ctx.current_step = 2;
    const prompt = buildTutorSystemPrompt(EXERCISE_21, ctx);
    expect(prompt).toContain("currently on step 2");
  });

  it("omits run history when no snapshots", () => {
    const prompt = buildTutorSystemPrompt(EXERCISE_21, baseContext());
    expect(prompt).not.toContain("Run History");
  });
});

describe("buildGeminiContents", () => {
  it("maps user role to user and tutor role to model", () => {
    const conversation = [
      { role: "user" as const, content: "What is str()?" },
      { role: "tutor" as const, content: "What do you think it does?" },
    ];
    const contents = buildGeminiContents(conversation, "It converts to string?");
    expect(contents).toHaveLength(3);
    expect(contents[0].role).toBe("user");
    expect(contents[1].role).toBe("model");
    expect(contents[2].role).toBe("user");
    expect(contents[2].parts[0].text).toBe("It converts to string?");
  });

  it("works with empty conversation history", () => {
    const contents = buildGeminiContents([], "First question");
    expect(contents).toHaveLength(1);
    expect(contents[0].parts[0].text).toBe("First question");
  });
});

describe("callGeminiWithTools (mocked fetch)", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns on_topic: true for help_with_curriculum tool call", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      helpCurriculumResponse("What type do you think price + tax is?", "type conversion")
    );

    const { callGeminiWithTools } = await import("./chat");
    const result = await callGeminiWithTools("fake-key", "gemini-2.0-flash", "system", [
      { role: "user", parts: [{ text: "Why the error?" }] },
    ]);

    expect(result.on_topic).toBe(true);
    expect(result.reply).toContain("What type");
    expect(result.topic).toBe("type conversion");
  });

  it("returns on_topic: false for off_topic_detected tool call", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      offTopicResponse("Let's focus on the Python code in front of you.")
    );

    const { callGeminiWithTools } = await import("./chat");
    const result = await callGeminiWithTools("fake-key", "gemini-2.0-flash", "system", [
      { role: "user", parts: [{ text: "What is quantum computing?" }] },
    ]);

    expect(result.on_topic).toBe(false);
    expect(result.reply).toContain("focus on the Python code");
  });

  it("throws on Gemini error response", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(errorResponse(500, "Internal error"));

    const { callGeminiWithTools } = await import("./chat");
    await expect(
      callGeminiWithTools("fake-key", "gemini-2.0-flash", "system", [
        { role: "user", parts: [{ text: "test" }] },
      ])
    ).rejects.toThrow("Gemini 500");
  });

  it("throws on malformed response (no function call)", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(malformedResponse());

    const { callGeminiWithTools } = await import("./chat");
    await expect(
      callGeminiWithTools("fake-key", "gemini-2.0-flash", "system", [
        { role: "user", parts: [{ text: "test" }] },
      ])
    ).rejects.toThrow("No function call");
  });
});

describe("rate limiter", () => {
  beforeEach(() => {
    messageCounts.clear();
  });

  it("tracks message counts per learner", () => {
    messageCounts.set("learner-1", 5);
    messageCounts.set("learner-2", 10);
    expect(messageCounts.get("learner-1")).toBe(5);
    expect(messageCounts.get("learner-2")).toBe(10);
  });

  it("different learners don't share counters", () => {
    messageCounts.set("learner-1", MAX_MESSAGES_PER_SESSION);
    expect(messageCounts.get("learner-2")).toBeUndefined();
  });

  it("limit constant is 30", () => {
    expect(MAX_MESSAGES_PER_SESSION).toBe(30);
  });
});
