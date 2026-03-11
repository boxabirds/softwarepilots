import { Hono } from "hono";
import type { Env } from "../env";

/* ---- Constants ---- */

const DEFAULT_GEMINI_MODEL = "gemini-2.0-flash";
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const RETRY_DELAY_MS = 1000;
const MAX_RETRIES = 1;
const MAX_MESSAGES_PER_SESSION = 30;
const TUTOR_TEMPERATURE = 0.4;

/* ---- Rate limiter (in-memory, resets on worker restart) ---- */

const messageCounts = new Map<string, number>();

/* ---- Tool declarations for Gemini function calling ---- */

const TUTOR_TOOLS = [
  {
    functionDeclarations: [
      {
        name: "help_with_curriculum",
        description:
          "Respond to a question about the current exercise, Python concepts, programming fundamentals, or anything related to the curriculum. Use Socratic questioning — guide discovery, don't give answers directly. Keep responses to 2-3 sentences.",
        parameters: {
          type: "OBJECT",
          properties: {
            response: {
              type: "STRING",
              description: "Your Socratic response helping the learner understand the concept",
            },
            topic: {
              type: "STRING",
              description:
                "Brief label for the topic area (e.g. 'type conversion', 'string concatenation', 'error handling')",
            },
          },
          required: ["response", "topic"],
        },
      },
      {
        name: "off_topic_detected",
        description:
          "The user's message is not related to the current exercise, Python programming, or the curriculum. Use this when the question is about unrelated subjects.",
        parameters: {
          type: "OBJECT",
          properties: {
            redirect_hint: {
              type: "STRING",
              description: "A brief, friendly suggestion to refocus on the exercise",
            },
          },
          required: ["redirect_hint"],
        },
      },
    ],
  },
];

/* ---- Exercise context for tutor prompts ---- */

const EXERCISE_CONTEXT: Record<string, { title: string; starter_code: string; topics: string }> = {
  "2.1": {
    title: "The Compiler Moment",
    starter_code: `price = 10
tax = price * 0.2
label = "Total: " + str(price + tax)
cheap = price < 5
print(label, "| Cheap?", cheap)`,
    topics:
      "variable assignment, arithmetic operators, string concatenation, str() type conversion, boolean comparison, print() function, TypeError when mixing types",
  },
};

/* ---- Request/response types ---- */

interface ChatRequest {
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

interface GeminiFunctionCallResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        functionCall?: {
          name: string;
          args: Record<string, string>;
        };
      }>;
    };
  }>;
}

/* ---- Route ---- */

export const chat = new Hono<{ Bindings: Env }>();

chat.post("/", async (c) => {
  const learnerId = c.get("learnerId" as never) as string;

  // Rate limit
  const count = messageCounts.get(learnerId) ?? 0;
  if (count >= MAX_MESSAGES_PER_SESSION) {
    return c.json({ error: "Message limit reached" }, 429);
  }

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

  const exercise = EXERCISE_CONTEXT[body.exercise_id];
  if (!exercise) {
    return c.json({ error: `Unknown exercise: ${body.exercise_id}` }, 400);
  }

  // Build system prompt
  const systemPrompt = buildTutorSystemPrompt(exercise, body.context);

  // Build conversation history for Gemini multi-turn
  const contents = buildGeminiContents(body.context.conversation, body.message);

  // Call Gemini with forced function calling
  try {
    const model = c.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
    const result = await callGeminiWithTools(c.env.GEMINI_API_KEY, model, systemPrompt, contents);

    // Increment rate counter on success
    messageCounts.set(learnerId, count + 1);

    return c.json(result);
  } catch {
    return c.json({ error: "Tutor unavailable" }, 502);
  }
});

/* ---- Exports for testing ---- */

export { messageCounts, EXERCISE_CONTEXT, MAX_MESSAGES_PER_SESSION };
export type { ChatRequest, GeminiFunctionCallResponse };

/* ---- Prompt builder ---- */

export function buildTutorSystemPrompt(
  exercise: { title: string; starter_code: string; topics: string },
  context: ChatRequest["context"]
): string {
  const lines = [
    `You are a Socratic Python tutor for the exercise "${exercise.title}".`,
    "",
    "Your role:",
    "- Guide the learner to understand concepts through questions, not direct answers",
    "- Keep responses to 2-3 sentences maximum",
    "- Never give away the solution — help them discover it",
    "- Be encouraging but honest",
    "",
    `Relevant topics for this exercise: ${exercise.topics}`,
    "",
    "== Starter Code ==",
    exercise.starter_code,
    "",
    "== Current Code ==",
    context.code,
  ];

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

  lines.push(
    "",
    `The learner is currently on step ${context.current_step}.`,
    "",
    "You MUST call one of the provided functions. Use help_with_curriculum for on-topic questions and off_topic_detected for anything unrelated to this exercise or programming."
  );

  return lines.join("\n");
}

/* ---- Gemini conversation builder ---- */

export function buildGeminiContents(
  conversation: Array<{ role: "user" | "tutor"; content: string }>,
  newMessage: string
): Array<{ role: string; parts: Array<{ text: string }> }> {
  const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];

  for (const msg of conversation) {
    contents.push({
      role: msg.role === "user" ? "user" : "model",
      parts: [{ text: msg.content }],
    });
  }

  contents.push({ role: "user", parts: [{ text: newMessage }] });

  return contents;
}

/* ---- Gemini caller with tool routing ---- */

export async function callGeminiWithTools(
  apiKey: string,
  model: string,
  systemPrompt: string,
  contents: Array<{ role: string; parts: Array<{ text: string }> }>
): Promise<{ reply: string; on_topic: boolean; topic?: string }> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const url = `${GEMINI_API_URL}/${model}:generateContent?key=${apiKey}`;

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents,
          tools: TUTOR_TOOLS,
          toolConfig: {
            functionCallingConfig: { mode: "ANY" },
          },
          generationConfig: {
            temperature: TUTOR_TEMPERATURE,
          },
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Gemini ${response.status}: ${errorBody}`);
      }

      const data = (await response.json()) as GeminiFunctionCallResponse;
      const functionCall = data.candidates?.[0]?.content?.parts?.[0]?.functionCall;

      if (!functionCall) {
        throw new Error("No function call in Gemini response");
      }

      if (functionCall.name === "help_with_curriculum") {
        return {
          reply: functionCall.args.response || "I'm not sure how to help with that.",
          on_topic: true,
          topic: functionCall.args.topic,
        };
      }

      if (functionCall.name === "off_topic_detected") {
        return {
          reply:
            functionCall.args.redirect_hint ||
            "That's an interesting question, but let's focus on the exercise. What part of the code are you curious about?",
          on_topic: false,
        };
      }

      throw new Error(`Unexpected tool: ${functionCall.name}`);
    } catch (err) {
      if (attempt < MAX_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
        continue;
      }
      throw err;
    }
  }

  throw new Error("Unreachable");
}
