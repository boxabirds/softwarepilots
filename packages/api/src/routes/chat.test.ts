import { describe, it, expect, vi, afterEach } from "vitest";
import {
  assembleStepContext,
  buildTutorSystemPrompt,
  buildTutorTools,
  buildGeminiContents,
  computeCodeDiff,
  parseGeminiToolResponse,
} from "./chat";
import type { ChatRequest, GeminiFunctionCallResponse } from "./chat";
import { getExerciseMeta, getExerciseContent } from "@softwarepilots/shared";
import type { PyodideStep } from "@softwarepilots/shared";

/* ---- Test fixtures ---- */

const EXERCISE_21_META = getExerciseMeta("2.1");
const EXERCISE_21_CONTENT = getExerciseContent("2.1");
const EXERCISE_21_STEPS = EXERCISE_21_CONTENT.steps;

const baseContext = (): ChatRequest["context"] => ({
  current_step: 0,
  code: EXERCISE_21_META.starter_code,
  snapshots: [],
  submitted_inputs: {},
  conversation: [],
});

/* ---- Gemini response builders ---- */

const helpCurriculumResponse = (response: string, topic: string): GeminiFunctionCallResponse => ({
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
});

const offTopicResponse = (hint: string): GeminiFunctionCallResponse => ({
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
});

const stepAnswerResponse = (answer: string, coaching?: string): GeminiFunctionCallResponse => ({
  candidates: [
    {
      content: {
        parts: [
          {
            functionCall: {
              name: "provided_step_answer",
              args: { answer, ...(coaching ? { coaching } : {}) },
            },
          },
        ],
      },
    },
  ],
});

const multiToolResponse = (
  ...calls: Array<{ name: string; args: Record<string, string> }>
): GeminiFunctionCallResponse => ({
  candidates: [
    {
      content: {
        parts: calls.map((fc) => ({ functionCall: fc })),
      },
    },
  ],
});

const errorFetchResponse = (status: number, body: string) => ({
  ok: false,
  status,
  text: async () => body,
  json: async () => ({}),
});

const malformedResponse = (): GeminiFunctionCallResponse => ({
  candidates: [{ content: { parts: [{ text: "no function call here" }] } }],
});

/* ---- computeCodeDiff ---- */

describe("computeCodeDiff", () => {
  it("returns no changes when code is identical", () => {
    const code = "line1\nline2";
    expect(computeCodeDiff(code, code)).toBe("(no changes from starter code)");
  });

  it("detects a changed line", () => {
    const diff = computeCodeDiff("line1\nline2", "line1\nchanged");
    expect(diff).toContain("Line 2 changed: 'line2' → 'changed'");
  });

  it("detects added lines", () => {
    const diff = computeCodeDiff("line1", "line1\nline2");
    expect(diff).toContain("Line 2 added: 'line2'");
  });

  it("detects removed lines", () => {
    const diff = computeCodeDiff("line1\nline2", "line1");
    expect(diff).toContain("Line 2 removed: 'line2'");
  });
});

/* ---- assembleStepContext ---- */

describe("assembleStepContext", () => {
  const contentWithContext = {
    intro: {
      welcome: ["Welcome"],
      context: ["Python", "programming language"],
    },
    steps: [
      { type: "predict" as const, prompt: "p0", context: ["predict", "output"] },
      { type: "experiment" as const, prompt: "p1", context: ["experiment", "error"] },
      { type: "edit-and-predict" as const, prompt: "p2", context: ["edit", "modify"] },
      { type: "reflect" as const, prompt: "p3", context: ["reflect", "learned"] },
    ],
  };

  const metaWithTopics = {
    ...EXERCISE_21_META,
    topics: ["variable assignment", "str() type conversion"],
  };

  it("at step 0 includes meta.topics + intro context + step 0 context", () => {
    const result = assembleStepContext(metaWithTopics, contentWithContext, 0);
    expect(result).toContain("variable assignment");
    expect(result).toContain("Python");
    expect(result).toContain("predict");
    expect(result).not.toContain("experiment");
    expect(result).not.toContain("edit");
  });

  it("at step 2 includes intro + steps 0-2 context", () => {
    const result = assembleStepContext(metaWithTopics, contentWithContext, 2);
    expect(result).toContain("Python");
    expect(result).toContain("predict");
    expect(result).toContain("experiment");
    expect(result).toContain("edit");
    expect(result).not.toContain("reflect");
  });

  it("at last step includes all context", () => {
    const result = assembleStepContext(metaWithTopics, contentWithContext, 3);
    expect(result).toContain("reflect");
    expect(result).toContain("learned");
  });

  it("deduplicates keywords (case-insensitive)", () => {
    const meta = { ...metaWithTopics, topics: ["Python"] };
    const result = assembleStepContext(meta, contentWithContext, 0);
    const pythonCount = result.filter((k) => k.toLowerCase() === "python").length;
    expect(pythonCount).toBe(1);
  });

  it("returns just meta.topics when no context fields exist", () => {
    const noContextContent = {
      intro: { welcome: ["Hi"] },
      steps: [{ type: "predict" as const, prompt: "p" }],
    };
    const result = assembleStepContext(metaWithTopics, noContextContent, 0);
    expect(result).toEqual(["variable assignment", "str() type conversion"]);
  });

  it("handles currentStep beyond steps length gracefully", () => {
    const result = assembleStepContext(metaWithTopics, contentWithContext, 99);
    expect(result).toContain("reflect");
    expect(result).toContain("learned");
  });

  it("works with real exercise 2.1 data", () => {
    const result = assembleStepContext(
      EXERCISE_21_META,
      { intro: EXERCISE_21_CONTENT.intro, steps: EXERCISE_21_CONTENT.steps },
      0
    );
    expect(result).toContain("Python");
    expect(result).toContain("variable assignment");
    expect(result).toContain("predict");
  });
});

/* ---- buildTutorTools ---- */

describe("buildTutorTools", () => {
  it("includes help_with_curriculum and off_topic_detected for all step types", () => {
    const step: PyodideStep = { type: "predict", prompt: "test" };
    const tools = buildTutorTools(step, ["variables"], "Test Exercise");
    const names = tools[0].functionDeclarations.map((d) => d.name);
    expect(names).toContain("help_with_curriculum");
    expect(names).toContain("off_topic_detected");
  });

  it("includes provided_step_answer for predict step", () => {
    const step: PyodideStep = { type: "predict", prompt: "test" };
    const tools = buildTutorTools(step, ["variables"], "Test Exercise");
    const names = tools[0].functionDeclarations.map((d) => d.name);
    expect(names).toContain("provided_step_answer");
  });

  it("includes provided_step_answer for reflect step", () => {
    const step: PyodideStep = { type: "reflect", prompt: "test" };
    const tools = buildTutorTools(step, ["variables"], "Test Exercise");
    const names = tools[0].functionDeclarations.map((d) => d.name);
    expect(names).toContain("provided_step_answer");
  });

  it("includes provided_step_answer for edit-and-predict step", () => {
    const step: PyodideStep = { type: "edit-and-predict", prompt: "test" };
    const tools = buildTutorTools(step, ["variables"], "Test Exercise");
    const names = tools[0].functionDeclarations.map((d) => d.name);
    expect(names).toContain("provided_step_answer");
  });

  it("excludes provided_step_answer for experiment step", () => {
    const step: PyodideStep = { type: "experiment", prompt: "test" };
    const tools = buildTutorTools(step, ["variables"], "Test Exercise");
    const names = tools[0].functionDeclarations.map((d) => d.name);
    expect(names).not.toContain("provided_step_answer");
  });

  it("includes topics in help_with_curriculum description", () => {
    const step: PyodideStep = { type: "predict", prompt: "test" };
    const tools = buildTutorTools(step, ["str() conversion", "TypeError"], "Test");
    const helpTool = tools[0].functionDeclarations.find(
      (d) => d.name === "help_with_curriculum"
    );
    expect(helpTool?.description).toContain("str() conversion");
    expect(helpTool?.description).toContain("TypeError");
  });

  it("includes title in off_topic_detected description", () => {
    const step: PyodideStep = { type: "predict", prompt: "test" };
    const tools = buildTutorTools(step, ["vars"], "The Compiler Moment");
    const offTopic = tools[0].functionDeclarations.find(
      (d) => d.name === "off_topic_detected"
    );
    expect(offTopic?.description).toContain("The Compiler Moment");
  });

  it("includes accumulated context keywords in help_with_curriculum description", () => {
    const step: PyodideStep = { type: "predict", prompt: "test" };
    const contextScope = ["variable assignment", "Python", "programming language", "predict"];
    const tools = buildTutorTools(step, contextScope, "Test");
    const helpTool = tools[0].functionDeclarations.find(
      (d) => d.name === "help_with_curriculum"
    );
    expect(helpTool?.description).toContain("Python");
    expect(helpTool?.description).toContain("programming language");
    expect(helpTool?.description).toContain("variable assignment");
  });
});

/* ---- buildTutorSystemPrompt ---- */

describe("buildTutorSystemPrompt", () => {
  it("includes exercise title and module ID", () => {
    const prompt = buildTutorSystemPrompt(EXERCISE_21_META, EXERCISE_21_STEPS, baseContext());
    expect(prompt).toContain("The Compiler Moment");
    expect(prompt).toContain("Module 2");
  });

  it("includes module description when present", () => {
    const prompt = buildTutorSystemPrompt(EXERCISE_21_META, EXERCISE_21_STEPS, baseContext());
    expect(prompt).toContain("compiler moment");
  });

  it("uses contextScope instead of meta.topics when provided", () => {
    const contextScope = ["variable assignment", "Python", "programming language", "predict"];
    const prompt = buildTutorSystemPrompt(EXERCISE_21_META, EXERCISE_21_STEPS, baseContext(), contextScope);
    expect(prompt).toContain("This exercise explores: variable assignment, Python, programming language, predict");
  });

  it("falls back to meta.topics when contextScope is not provided", () => {
    const prompt = buildTutorSystemPrompt(EXERCISE_21_META, EXERCISE_21_STEPS, baseContext());
    expect(prompt).toContain("This exercise explores: variable assignment");
    expect(prompt).not.toContain("Python");
  });

  it("includes starter code", () => {
    const prompt = buildTutorSystemPrompt(EXERCISE_21_META, EXERCISE_21_STEPS, baseContext());
    expect(prompt).toContain("price = 10");
    expect(prompt).toContain("str(price + tax)");
  });

  it("includes code diff instead of full current code when changed", () => {
    const ctx = baseContext();
    ctx.code = ctx.code.replace("price = 10", "price = 20");
    const prompt = buildTutorSystemPrompt(EXERCISE_21_META, EXERCISE_21_STEPS, ctx);
    expect(prompt).toContain("Code Changes");
    expect(prompt).toContain("changed:");
    expect(prompt).toContain("price = 20");
  });

  it("shows no changes when code matches starter", () => {
    const prompt = buildTutorSystemPrompt(EXERCISE_21_META, EXERCISE_21_STEPS, baseContext());
    expect(prompt).toContain("(no changes from starter code)");
  });

  it("includes run history when snapshots exist", () => {
    const ctx = baseContext();
    ctx.snapshots = [
      { code: "print(1)", output: "1" },
      { code: "print(2)", output: "TypeError: can only concatenate str" },
    ];
    const prompt = buildTutorSystemPrompt(EXERCISE_21_META, EXERCISE_21_STEPS, ctx);
    expect(prompt).toContain("Run #1 output: 1");
    expect(prompt).toContain("Run #2 output: TypeError");
  });

  it("includes learner predictions", () => {
    const ctx = baseContext();
    ctx.submitted_inputs = { 0: "Total: 12.0 | Cheap? False" };
    const prompt = buildTutorSystemPrompt(EXERCISE_21_META, EXERCISE_21_STEPS, ctx);
    expect(prompt).toContain('Step 0: "Total: 12.0 | Cheap? False"');
  });

  it("includes current step context with expectation", () => {
    const ctx = baseContext();
    ctx.current_step = 0;
    const prompt = buildTutorSystemPrompt(EXERCISE_21_META, EXERCISE_21_STEPS, ctx);
    expect(prompt).toContain("Step 0:");
    expect(prompt).toContain("prediction of what the code will print");
  });

  it("shows experiment step has no text input expected", () => {
    const ctx = baseContext();
    ctx.current_step = 1; // experiment step
    const prompt = buildTutorSystemPrompt(EXERCISE_21_META, EXERCISE_21_STEPS, ctx);
    expect(prompt).toContain("no text input");
  });

  it("omits run history when no snapshots", () => {
    const prompt = buildTutorSystemPrompt(EXERCISE_21_META, EXERCISE_21_STEPS, baseContext());
    expect(prompt).not.toContain("Run History");
  });
});

/* ---- buildGeminiContents ---- */

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

/* ---- parseGeminiToolResponse ---- */

describe("parseGeminiToolResponse", () => {
  it("parses help_with_curriculum tool call", () => {
    const result = parseGeminiToolResponse(
      helpCurriculumResponse("What type do you think price + tax is?", "type conversion")
    );
    expect(result.on_topic).toBe(true);
    expect(result.reply).toContain("What type");
    expect(result.topic).toBe("type conversion");
    expect(result.step_answer).toBeUndefined();
  });

  it("parses off_topic_detected tool call", () => {
    const result = parseGeminiToolResponse(
      offTopicResponse("Let's focus on the Python code.")
    );
    expect(result.on_topic).toBe(false);
    expect(result.reply).toContain("focus on the Python code");
    expect(result.step_answer).toBeUndefined();
  });

  it("parses provided_step_answer with coaching", () => {
    const result = parseGeminiToolResponse(
      stepAnswerResponse("Total: 12.0 | Cheap? False", "Good prediction!")
    );
    expect(result.on_topic).toBe(true);
    expect(result.step_answer).toBe("Total: 12.0 | Cheap? False");
    expect(result.reply).toBe("Good prediction!");
  });

  it("parses provided_step_answer without coaching", () => {
    const result = parseGeminiToolResponse(
      stepAnswerResponse("Total: 12.0 | Cheap? False")
    );
    expect(result.step_answer).toBe("Total: 12.0 | Cheap? False");
    expect(result.reply).toBe("Got it.");
  });

  it("handles multi-tool: step_answer + help_with_curriculum", () => {
    const result = parseGeminiToolResponse(
      multiToolResponse(
        { name: "provided_step_answer", args: { answer: "12.0", coaching: "Close!" } },
        { name: "help_with_curriculum", args: { response: "Think about the boolean.", topic: "booleans" } }
      )
    );
    expect(result.step_answer).toBe("12.0");
    expect(result.reply).toContain("Close!");
    expect(result.reply).toContain("Think about the boolean.");
    expect(result.topic).toBe("booleans");
    expect(result.on_topic).toBe(true);
  });

  it("throws on empty parts", () => {
    expect(() =>
      parseGeminiToolResponse({ candidates: [{ content: { parts: [] } }] })
    ).toThrow("No parts");
  });

  it("handles unknown tool name gracefully (returns raw args)", () => {
    const result = parseGeminiToolResponse(
      multiToolResponse({ name: "unknown_tool", args: { foo: "bar" } })
    );
    expect(result.reply).toBe(JSON.stringify({ foo: "bar" }));
    expect(result.on_topic).toBe(true);
  });

  it("falls back to text when no function calls", () => {
    const result = parseGeminiToolResponse(malformedResponse());
    expect(result.reply).toBe("no function call here");
    expect(result.on_topic).toBe(true);
  });

  it("provides default reply for off_topic with no hint", () => {
    const result = parseGeminiToolResponse(
      multiToolResponse({ name: "off_topic_detected", args: {} })
    );
    expect(result.on_topic).toBe(false);
    expect(result.reply).toContain("focus on the exercise");
  });
});

/* ---- callGeminiWithTools (mocked fetch) ---- */

describe("callGeminiWithTools (mocked fetch)", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns on_topic: true for help_with_curriculum tool call", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () =>
        helpCurriculumResponse("What type do you think price + tax is?", "type conversion"),
    });

    const { callGeminiWithTools } = await import("./chat");
    const tools = buildTutorTools(
      { type: "predict", prompt: "test" },
      ["variables"],
      "Test"
    );
    const result = await callGeminiWithTools("fake-key", "gemini-2.0-flash", "system", [
      { role: "user", parts: [{ text: "Why the error?" }] },
    ], tools);

    expect(result.on_topic).toBe(true);
    expect(result.reply).toContain("What type");
    expect(result.topic).toBe("type conversion");
  });

  it("returns step_answer for provided_step_answer tool call", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () =>
        stepAnswerResponse("Total: 12.0", "Nice prediction!"),
    });

    const { callGeminiWithTools } = await import("./chat");
    const tools = buildTutorTools(
      { type: "predict", prompt: "test" },
      ["variables"],
      "Test"
    );
    const result = await callGeminiWithTools("fake-key", "gemini-2.0-flash", "system", [
      { role: "user", parts: [{ text: "I think it prints Total: 12.0" }] },
    ], tools);

    expect(result.step_answer).toBe("Total: 12.0");
    expect(result.reply).toBe("Nice prediction!");
  });

  it("throws on Gemini error response", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(errorFetchResponse(500, "Internal error"));

    const { callGeminiWithTools } = await import("./chat");
    const tools = buildTutorTools(
      { type: "predict", prompt: "test" },
      ["variables"],
      "Test"
    );
    await expect(
      callGeminiWithTools("fake-key", "gemini-2.0-flash", "system", [
        { role: "user", parts: [{ text: "test" }] },
      ], tools)
    ).rejects.toThrow("Gemini 500");
  });
});
