import { Hono } from "hono";
import type { Env } from "../env";
import { getExerciseMeta, getExerciseContent } from "@softwarepilots/shared";
import type { PyodideStep, PyodideStepType, ExerciseMeta, ExerciseDefinition } from "@softwarepilots/shared";
import {
  buildGeminiContents,
  callGeminiWithTools,
  parseGeminiToolResponse,
} from "../lib/gemini";

// Re-export Gemini functions so existing consumers (tests, etc.) still work
export { buildGeminiContents, callGeminiWithTools, parseGeminiToolResponse };

/* ---- Constants ---- */

const DEFAULT_GEMINI_MODEL = "gemini-2.0-flash";
const TUTOR_TEMPERATURE = 0.4;

/* ---- Step-type to input expectation mapping ---- */

const STEP_INPUT_EXPECTATIONS: Partial<Record<PyodideStepType, string>> = {
  predict: "their prediction of what the code will print",
  "edit-and-predict": "their prediction of what their modified code will do",
  reflect: "a description of what they changed and what they learned",
};

/* ---- Step context assembly ---- */

/**
 * Assembles deduplicated topic scope from exercise-level topics,
 * intro context, and accumulated step context up to the current step.
 */
export function assembleStepContext(
  meta: ExerciseMeta,
  content: ExerciseDefinition["content"],
  currentStep: number
): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  const add = (keyword: string) => {
    const lower = keyword.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      result.push(keyword);
    }
  };

  for (const topic of meta.topics) add(topic);
  if (content.intro.context) {
    for (const kw of content.intro.context) add(kw);
  }
  const maxStep = Math.min(currentStep, content.steps.length - 1);
  for (let i = 0; i <= maxStep; i++) {
    const stepContext = content.steps[i].context;
    if (stepContext) {
      for (const kw of stepContext) add(kw);
    }
  }

  return result;
}

/* ---- Dynamic tool builder ---- */

export function buildTutorTools(
  step: PyodideStep,
  contextScope: string[],
  title: string
): Array<{ functionDeclarations: Array<Record<string, unknown>> }> {
  const topicList = contextScope.join(", ");

  const declarations: Array<Record<string, unknown>> = [
    {
      name: "help_with_curriculum",
      description: `Respond to a question about: ${topicList}. Use Socratic questioning - guide discovery, don't give answers directly. Keep responses to 2-3 sentences.`,
      parameters: {
        type: "OBJECT",
        properties: {
          response: {
            type: "STRING",
            description:
              "Your Socratic response helping the learner understand the concept",
          },
          topic: {
            type: "STRING",
            description:
              "Brief label for the topic area (e.g. 'type conversion', 'string concatenation')",
          },
        },
        required: ["response", "topic"],
      },
    },
    {
      name: "off_topic_detected",
      description: `The message is unrelated to "${title}" or any of these topics: ${topicList}. Gently redirect the learner back to the exercise.`,
      parameters: {
        type: "OBJECT",
        properties: {
          redirect_hint: {
            type: "STRING",
            description:
              "A brief, friendly suggestion to refocus on the exercise",
          },
        },
        required: ["redirect_hint"],
      },
    },
  ];

  // Only include provided_step_answer for steps that collect text input
  const expectation = STEP_INPUT_EXPECTATIONS[step.type];
  if (expectation) {
    declarations.push({
      name: "provided_step_answer",
      description: `The learner has provided ${expectation}. Extract their answer verbatim. Optionally add one sentence of Socratic coaching.`,
      parameters: {
        type: "OBJECT",
        properties: {
          answer: {
            type: "STRING",
            description: "The learner's answer extracted verbatim",
          },
          coaching: {
            type: "STRING",
            description:
              "Optional 1-sentence Socratic feedback on their answer",
          },
        },
        required: ["answer"],
      },
    });
  }

  return [{ functionDeclarations: declarations }];
}

/* ---- Code diff utility ---- */

export function computeCodeDiff(starter: string, current: string): string {
  const starterLines = starter.split("\n");
  const currentLines = current.split("\n");
  const maxLen = Math.max(starterLines.length, currentLines.length);
  const changes: string[] = [];

  for (let i = 0; i < maxLen; i++) {
    const original = starterLines[i];
    const modified = currentLines[i];

    if (original === undefined && modified !== undefined) {
      changes.push(`Line ${i + 1} added: '${modified}'`);
    } else if (modified === undefined && original !== undefined) {
      changes.push(`Line ${i + 1} removed: '${original}'`);
    } else if (original !== modified) {
      changes.push(`Line ${i + 1} changed: '${original}' → '${modified}'`);
    }
  }

  return changes.length > 0 ? changes.join("\n") : "(no changes from starter code)";
}

/* ---- Request/response types ---- */

export interface ChatRequest {
  exercise_id: string;
  message: string;
  context: {
    current_step: number;
    code: string;
    snapshots: Array<{ code: string; output: string }>;
    submitted_inputs: Record<number, string>;
    conversation: Array<{ role: "user" | "tutor"; content: string }>;
  };
}

// ChatResponse and GeminiFunctionCallResponse are re-exported from ../lib/gemini
export type { ChatResponse, GeminiFunctionCallResponse } from "../lib/gemini";

/* ---- Route ---- */

export const chat = new Hono<{ Bindings: Env }>();

chat.post("/", async (c) => {
  // Parse and validate
  let body: ChatRequest;
  try {
    body = await c.req.json<ChatRequest>();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }

  if (!body.exercise_id || typeof body.exercise_id !== "string") {
    return c.json({ error: "exercise_id is required" }, 400);
  }
  if (!body.message || typeof body.message !== "string" || !body.message.trim()) {
    return c.json({ error: "message is required" }, 400);
  }

  let meta: ExerciseMeta;
  let steps: PyodideStep[];
  let exerciseContent: ExerciseDefinition["content"];
  try {
    meta = getExerciseMeta(body.exercise_id);
    const content = getExerciseContent(body.exercise_id);
    steps = content.steps;
    exerciseContent = { intro: content.intro, steps: content.steps };
  } catch {
    return c.json({ error: `Unknown exercise: ${body.exercise_id}` }, 400);
  }

  const currentStep = steps[body.context.current_step] ?? steps[0];
  const contextScope = assembleStepContext(meta, exerciseContent, body.context.current_step);

  // Build dynamic tools for current step with accumulated context
  const tools = buildTutorTools(currentStep, contextScope, meta.title);

  // Build system prompt with rich context
  const systemPrompt = buildTutorSystemPrompt(meta, steps, body.context, contextScope);

  // Build conversation history for Gemini multi-turn
  const contents = buildGeminiContents(body.context.conversation, body.message);

  // Call Gemini with forced function calling
  try {
    const model = c.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
    const result = await callGeminiWithTools(c.env.GEMINI_API_KEY, model, systemPrompt, contents, tools, TUTOR_TEMPERATURE);

    return c.json(result);
  } catch {
    return c.json({ error: "Tutor unavailable" }, 502);
  }
});

/* ---- Prompt builder ---- */

export function buildTutorSystemPrompt(
  meta: ExerciseMeta,
  steps: PyodideStep[],
  context: ChatRequest["context"],
  contextScope?: string[]
): string {
  const moduleId = meta.id.split(".")[0];

  const lines = [
    `You are a Socratic tutor for "${meta.title}" (Module ${moduleId}).`,
  ];

  if (meta.module_description) {
    lines.push("", `Module concept: ${meta.module_description}`);
  }

  lines.push(
    "",
    "Your role:",
    "- Guide the learner to understand concepts through questions, not direct answers",
    "- Keep responses to 2-3 sentences maximum",
    "- Never give away the solution - help them discover it",
    "- Be encouraging but honest",
    "",
    `This exercise explores: ${(contextScope ?? meta.topics).join(", ")}`,
    "",
    "== Starter Code ==",
    meta.starter_code,
    "",
    "== Code Changes ==",
    computeCodeDiff(meta.starter_code, context.code),
  );

  if (context.snapshots.length > 0) {
    lines.push("", "== Run History ==");
    for (let i = 0; i < context.snapshots.length; i++) {
      lines.push(`Run #${i + 1} output: ${context.snapshots[i].output}`);
    }
  }

  const predictions = Object.entries(context.submitted_inputs)
    .filter(([, v]) => v)
    .map(([step, text]) => `Step ${step}: "${text}"`);
  if (predictions.length > 0) {
    lines.push("", "== Learner's Predictions/Reflections ==", ...predictions);
  }

  const currentStepIndex = context.current_step;
  const currentStep = steps[currentStepIndex];
  if (currentStep) {
    const expectation =
      STEP_INPUT_EXPECTATIONS[currentStep.type] ||
      "no text input - learner edits and runs code";

    lines.push(
      "",
      "== Current Step ==",
      `Step ${currentStepIndex}: "${currentStep.prompt}"`,
      `Expected: ${expectation}`,
    );
  }

  lines.push(
    "",
    "You MUST call one or more of the provided functions. Use help_with_curriculum for on-topic questions, provided_step_answer when the learner provides their answer/prediction/reflection, and off_topic_detected for anything unrelated to this exercise or programming."
  );

  return lines.join("\n");
}

// buildGeminiContents, callGeminiWithTools, parseGeminiToolResponse
// are imported from ../lib/gemini
