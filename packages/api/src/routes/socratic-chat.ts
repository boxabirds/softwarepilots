import { Hono } from "hono";
import type { Env } from "../env";
import {
  getCurriculumMeta,
  getSection,
} from "@softwarepilots/shared";
import type {
  LearnerProfile,
  CurriculumMeta,
  SectionMeta,
} from "@softwarepilots/shared";
import {
  buildGeminiContents,
  callGeminiRaw,
  extractGeminiFunctionCalls,
  getOrUploadFile,
} from "../lib/gemini";
import type { GeminiToolDeclaration, GeminiFunctionCallResponse } from "../lib/gemini";

/* ---- Constants ---- */

const DEFAULT_GEMINI_MODEL = "gemini-2.0-flash";
const SOCRATIC_TEMPERATURE = 0.4;
const SOCRATIC_TOOL_COUNT = 5;
const MAX_RESPONSE_SENTENCES = 3;

/* ---- Request/Response types ---- */

export interface SocraticChatRequest {
  profile: LearnerProfile;
  section_id: string;
  message: string;
  context: {
    conversation: Array<{ role: "user" | "tutor"; content: string }>;
  };
}

export interface SocraticChatResponse {
  reply: string;
  tool_type: string;
  topic?: string;
  confidence_assessment?: string;
  understanding_level?: string;
  learner_readiness?: string;
}

/* ---- Tool builder ---- */

export function buildSocraticTools(
  section: SectionMeta,
  meta: CurriculumMeta
): GeminiToolDeclaration[] {
  const topicList = section.topics.join(", ");
  const sectionContext =
    `Section: "${section.title}". ` +
    `Key insight: ${section.key_intuition}. ` +
    `Topics in scope: ${topicList}.`;

  const declarations: Array<Record<string, unknown>> = [
    {
      name: "socratic_probe",
      description:
        `Ask a probing question to deepen understanding. ${sectionContext}`,
      parameters: {
        type: "OBJECT",
        properties: {
          response: {
            type: "STRING",
            description: "The probing question to ask the learner",
          },
          topic: {
            type: "STRING",
            description: "Brief label for the topic area being probed",
          },
          confidence_assessment: {
            type: "STRING",
            enum: ["low", "medium", "high"],
            description:
              "Your assessment of the learner's confidence level on this topic",
          },
        },
        required: ["response", "topic", "confidence_assessment"],
      },
    },
    {
      name: "present_scenario",
      description:
        `Present a realistic scenario that illustrates a concept. ${sectionContext}`,
      parameters: {
        type: "OBJECT",
        properties: {
          scenario: {
            type: "STRING",
            description: "A realistic scenario illustrating the concept",
          },
          question: {
            type: "STRING",
            description: "A question about the scenario for the learner",
          },
          topic: {
            type: "STRING",
            description: "Brief label for the topic area",
          },
        },
        required: ["scenario", "question", "topic"],
      },
    },
    {
      name: "evaluate_response",
      description:
        `Evaluate the learner's answer and provide follow-up. ${sectionContext}`,
      parameters: {
        type: "OBJECT",
        properties: {
          assessment: {
            type: "STRING",
            description: "Brief assessment of the learner's response",
          },
          follow_up: {
            type: "STRING",
            description: "A follow-up question or prompt",
          },
          understanding_level: {
            type: "STRING",
            enum: ["emerging", "developing", "solid", "strong"],
            description: "Assessment of the learner's understanding level",
          },
          topic: {
            type: "STRING",
            description: "Brief label for the topic area",
          },
        },
        required: ["assessment", "follow_up", "understanding_level", "topic"],
      },
    },
    {
      name: "surface_key_insight",
      description:
        `Guide the learner toward the key insight: "${section.key_intuition}". ${sectionContext}`,
      parameters: {
        type: "OBJECT",
        properties: {
          bridge: {
            type: "STRING",
            description:
              "A bridging statement or question leading toward the key insight",
          },
          learner_readiness: {
            type: "STRING",
            enum: ["close", "ready", "articulated"],
            description:
              "How close the learner is to articulating the key insight",
          },
        },
        required: ["bridge", "learner_readiness"],
      },
    },
    {
      name: "off_topic_detected",
      description:
        `The message is unrelated to "${section.title}" or these topics: ${topicList}. Gently redirect.`,
      parameters: {
        type: "OBJECT",
        properties: {
          redirect_hint: {
            type: "STRING",
            description:
              "A brief, friendly suggestion to refocus on the section",
          },
        },
        required: ["redirect_hint"],
      },
    },
  ];

  return [{ functionDeclarations: declarations }];
}

/* ---- System prompt builder ---- */

export function buildSocraticSystemPrompt(
  meta: CurriculumMeta,
  section: SectionMeta,
  conversation: Array<{ role: "user" | "tutor"; content: string }>
): string {
  const lines = [
    `You are a Socratic tutor for "${section.title}" in the ${meta.profile} software pilotry curriculum.`,
    "",
    "== Pedagogical Approach ==",
    meta.tutor_guidance,
    "",
    "== Target Insight ==",
    `The key intuition for this section: ${section.key_intuition}`,
    "",
    `== Topic Scope ==`,
    section.topics.join(", "),
    "",
    "== Rules ==",
    `- Maximum ${MAX_RESPONSE_SENTENCES} sentences per response`,
    "- Never lecture — always ask questions that guide the learner to discover insights",
    "- You MUST call exactly one of the provided functions",
    "- Use socratic_probe to ask probing questions",
    "- Use present_scenario to illustrate with realistic examples",
    "- Use evaluate_response when the learner provides an answer",
    "- Use surface_key_insight when the learner is approaching the key intuition",
    "- Use off_topic_detected to redirect off-topic messages",
  ];

  if (conversation.length > 0) {
    lines.push(
      "",
      `== Conversation Context ==`,
      `${conversation.length} previous exchanges in this session.`
    );
  }

  return lines.join("\n");
}

/* ---- Response parser ---- */

export function parseSocraticResponse(
  data: GeminiFunctionCallResponse
): SocraticChatResponse {
  const { functionCalls, fallbackText } = extractGeminiFunctionCalls(data);

  if (functionCalls.length === 0) {
    if (fallbackText) {
      return { reply: fallbackText, tool_type: "fallback" };
    }
    throw new Error("No function call in Gemini response");
  }

  const fc = functionCalls[0];

  switch (fc.name) {
    case "socratic_probe":
      return {
        reply: fc.args.response || "What do you think about that?",
        tool_type: "socratic_probe",
        topic: fc.args.topic,
        confidence_assessment: fc.args.confidence_assessment,
      };

    case "present_scenario": {
      const scenarioReply = fc.args.question
        ? `${fc.args.scenario}\n\n${fc.args.question}`
        : fc.args.scenario || "Consider this scenario...";
      return {
        reply: scenarioReply,
        tool_type: "present_scenario",
        topic: fc.args.topic,
      };
    }

    case "evaluate_response": {
      const evalReply = fc.args.follow_up
        ? `${fc.args.assessment}\n\n${fc.args.follow_up}`
        : fc.args.assessment || "Let me evaluate that.";
      return {
        reply: evalReply,
        tool_type: "evaluate_response",
        topic: fc.args.topic,
        understanding_level: fc.args.understanding_level,
      };
    }

    case "surface_key_insight":
      return {
        reply: fc.args.bridge || "You're getting close to something important.",
        tool_type: "surface_key_insight",
        learner_readiness: fc.args.learner_readiness,
      };

    case "off_topic_detected":
      return {
        reply:
          fc.args.redirect_hint ||
          "That's interesting, but let's focus on the section. What part are you curious about?",
        tool_type: "off_topic_detected",
      };

    default:
      throw new Error(`Unexpected tool: ${fc.name}`);
  }
}

/* ---- Route ---- */

export const socraticChat = new Hono<{ Bindings: Env }>();

socraticChat.post("/", async (c) => {
  // Parse and validate
  let body: SocraticChatRequest;
  try {
    body = await c.req.json<SocraticChatRequest>();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }

  if (!body.profile || typeof body.profile !== "string") {
    return c.json({ error: "profile is required" }, 400);
  }
  if (!body.section_id || typeof body.section_id !== "string") {
    return c.json({ error: "section_id is required" }, 400);
  }
  if (!body.message || typeof body.message !== "string" || !body.message.trim()) {
    return c.json({ error: "message is required" }, 400);
  }

  // Load curriculum and section
  let meta: CurriculumMeta;
  let section: SectionMeta;
  try {
    meta = getCurriculumMeta(body.profile);
    section = getSection(body.profile, body.section_id);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid profile or section";
    return c.json({ error: message }, 400);
  }

  // Upload section markdown (placeholder for now)
  await getOrUploadFile(
    c.env.GEMINI_API_KEY,
    section.markdown_path || `sections/${section.id}.md`,
    section.title
  );

  // Build system prompt and tools
  const conversation = body.context?.conversation ?? [];
  const systemPrompt = buildSocraticSystemPrompt(meta, section, conversation);
  const tools = buildSocraticTools(section, meta);

  // Build Gemini contents from conversation history
  const contents = buildGeminiContents(conversation, body.message);

  // Call Gemini
  try {
    const model = c.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
    const rawResponse = await callGeminiRaw({
      apiKey: c.env.GEMINI_API_KEY,
      model,
      systemPrompt,
      contents,
      tools,
      temperature: SOCRATIC_TEMPERATURE,
    });

    const result = parseSocraticResponse(rawResponse);
    return c.json(result);
  } catch {
    return c.json({ error: "Tutor unavailable" }, 502);
  }
});
