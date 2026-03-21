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
  GEMINI_API_URL,
} from "../lib/gemini";
import { updateSectionProgress, buildProgressContext } from "./curriculum-progress";
import { buildCurriculumContext } from "../lib/context-assembly";
import type { GeminiFunctionCallResponse } from "../lib/gemini";

/* ---- Constants ---- */

const DEFAULT_GEMINI_MODEL = "gemini-2.0-flash";
const SOCRATIC_TEMPERATURE = 0.4;
const SOCRATIC_TOOL_COUNT = 7;
const MAX_RESPONSE_SENTENCES = 3;
const RETRY_DELAY_MS = 1000;
const MAX_RETRIES = 1;

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
  concept?: string;
  confidence_assessment?: string;
  understanding_level?: string;
  learner_readiness?: string;
  concepts_demonstrated?: string[];
  concept_levels?: string[];
  struggle_reason?: string;
  final_understanding?: string;
  concepts_covered?: string[];
  concepts_missed?: string[];
  recommendation?: string;
  pause_reason?: string;
  concepts_covered_so_far?: string;
  resume_suggestion?: string;
}

/* ---- Tool builder ---- */

export function buildSocraticTools(
  section: SectionMeta,
  meta: CurriculumMeta
): Array<{ functionDeclarations: Array<Record<string, unknown>> }> {
  const sectionContext =
    `Section: "${section.title}" (Module: ${section.module_title}). ` +
    `Key insight: ${section.key_intuition}. ` +
    `Profile: ${meta.profile}.`;

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
      name: "provide_instruction",
      description:
        `Provide a direct explanation when Socratic questioning has demonstrably failed. ${sectionContext}`,
      parameters: {
        type: "OBJECT",
        properties: {
          instruction: {
            type: "STRING",
            description: "Clear explanation of the concept",
          },
          concept: {
            type: "STRING",
            description: "Which concept is being taught",
          },
          struggle_reason: {
            type: "STRING",
            enum: [
              "repeated_wrong_answer",
              "no_progression",
              "learner_asked",
              "low_confidence_sustained",
            ],
            description: "Why the learner is struggling",
          },
        },
        required: ["instruction", "concept", "struggle_reason"],
      },
    },
    {
      name: "off_topic_detected",
      description:
        `The message is unrelated to "${section.title}" or software pilotry. Gently redirect.`,
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
    {
      name: "session_complete",
      description:
        "All key concepts in this section have been covered and the learner has demonstrated understanding. End the session with a summary.",
      parameters: {
        type: "OBJECT",
        properties: {
          summary: {
            type: "STRING",
            description: "Summary of what was covered in this session",
          },
          final_understanding: {
            type: "STRING",
            enum: ["emerging", "developing", "solid", "strong"],
            description: "Overall understanding level the learner demonstrated",
          },
          concepts_covered: {
            type: "STRING",
            description: "Comma-separated list of concepts that were covered",
          },
          concepts_missed: {
            type: "STRING",
            description:
              "Comma-separated list of concepts that were not reached",
          },
          recommendation: {
            type: "STRING",
            description: "Suggestion for next section or review",
          },
        },
        required: ["summary", "final_understanding", "concepts_covered"],
      },
    },
    {
      name: "session_pause",
      description:
        "Gracefully pause the session when the learner requests a break, shows frustration, or appears fatigued.",
      parameters: {
        type: "OBJECT",
        properties: {
          acknowledgment: {
            type: "STRING",
            description: "A warm closing message acknowledging the learner's effort",
          },
          pause_reason: {
            type: "STRING",
            enum: ["learner_requested", "frustration_detected", "fatigue_detected"],
            description: "The reason for pausing the session",
          },
          concepts_covered_so_far: {
            type: "STRING",
            description: "Comma-separated list of concepts covered before the pause",
          },
          resume_suggestion: {
            type: "STRING",
            description: "Suggestion for where to pick up next time",
          },
        },
        required: ["acknowledgment", "pause_reason", "concepts_covered_so_far", "resume_suggestion"],
      },
    },
  ];

  if (section.concepts && section.concepts.length > 0) {
    const conceptList = section.concepts.join(", ");
    declarations.push({
      name: "track_concepts",
      description:
        `Report which concepts the learner has demonstrated understanding of. ` +
        `Call alongside other tools to track coverage. ` +
        `Available concepts for this section: ${conceptList}`,
      parameters: {
        type: "OBJECT",
        properties: {
          concepts_demonstrated: {
            type: "STRING",
            description:
              "Comma-separated concept labels the learner has shown understanding of",
          },
          concept_levels: {
            type: "STRING",
            description:
              "Comma-separated understanding levels (emerging/developing/solid/strong) corresponding to each concept",
          },
        },
        required: ["concepts_demonstrated", "concept_levels"],
      },
    });
  }

  return [{ functionDeclarations: declarations }];
}

/* ---- System prompt builder ---- */

export function buildSocraticSystemPrompt(
  meta: CurriculumMeta,
  section: SectionMeta,
  conversation: Array<{ role: "user" | "tutor"; content: string }>,
  progressContext?: string,
  curriculumContext?: string
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
    `== Section Context ==`,
    `Module: ${section.module_title}`,
    `Section: ${section.title}`,
    "",
    "== Rules ==",
    `- Maximum ${MAX_RESPONSE_SENTENCES} sentences per response`,
    "- Default to Socratic questioning. Only switch to direct instruction (provide_instruction) when questioning demonstrably isn't working.",
    "- You MUST call one or more of the provided functions",
    "- Use socratic_probe to ask probing questions",
    "- Use present_scenario to illustrate with realistic examples",
    "- Use evaluate_response when the learner provides an answer",
    "- Use surface_key_insight when the learner is approaching the key intuition",
    "- Use provide_instruction ONLY when Socratic questioning has demonstrably failed: the learner said 'I don't know', gave the same wrong answer multiple times, or shows no progression after several turns of low confidence. After providing instruction, follow up with a question to check understanding.",
    "- Use off_topic_detected to redirect off-topic messages",
    "- Use session_complete when all key concepts in the section have been covered and the learner has demonstrated understanding of the key insight. Include a summary and list of concepts covered.",
    "- Use session_pause when the learner explicitly asks to stop or take a break, shows signs of frustration, or appears fatigued. Be warm and encouraging. Never say 'you seem tired'. If the learner declines a pause offer, do not offer again for at least 5 more exchanges.",
  ];

  if (section.concepts && section.concepts.length > 0) {
    lines.push(
      "",
      "== Section Concepts ==",
      "The following concepts are covered in this section:"
    );
    section.concepts.forEach((concept, i) => {
      lines.push(`${i + 1}. ${concept}`);
    });
    lines.push(
      "Track which concepts the learner demonstrates understanding of by calling track_concepts alongside your other tool calls."
    );
  }

  if (progressContext) {
    lines.push("", progressContext);
  }

  if (curriculumContext) {
    lines.push("", curriculumContext);
  }

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

const REPLY_TOOLS = new Set([
  "socratic_probe",
  "evaluate_response",
  "present_scenario",
  "surface_key_insight",
  "off_topic_detected",
  "provide_instruction",
  "session_complete",
  "session_pause",
]);

const SIDE_EFFECT_TOOLS = new Set([
  "track_concepts",
]);

function extractReplyText(fc: { name: string; args: Record<string, string> }): string | null {
  switch (fc.name) {
    case "socratic_probe":
      return fc.args.response || "What do you think about that?";

    case "present_scenario": {
      return fc.args.question
        ? `${fc.args.scenario}\n\n${fc.args.question}`
        : fc.args.scenario || "Consider this scenario...";
    }

    case "evaluate_response": {
      return fc.args.follow_up
        ? `${fc.args.assessment}\n\n${fc.args.follow_up}`
        : fc.args.assessment || "Let me evaluate that.";
    }

    case "surface_key_insight":
      return fc.args.bridge || "You're getting close to something important.";

    case "off_topic_detected":
      return (
        fc.args.redirect_hint ||
        "That's interesting, but let's focus on the section. What part are you curious about?"
      );

    case "provide_instruction":
      return fc.args.response || fc.args.instruction || null;

    case "session_complete":
      return fc.args.summary || fc.args.response || null;

    case "session_pause":
      return fc.args.acknowledgment || fc.args.message || fc.args.response || null;

    default:
      return null;
  }
}

function extractMetadata(
  fc: { name: string; args: Record<string, string> },
  result: SocraticChatResponse
): void {
  if (fc.args.topic && !result.topic) result.topic = fc.args.topic;
  if (fc.args.confidence_assessment && !result.confidence_assessment)
    result.confidence_assessment = fc.args.confidence_assessment;
  if (fc.args.understanding_level && !result.understanding_level)
    result.understanding_level = fc.args.understanding_level;
  if (fc.args.learner_readiness && !result.learner_readiness)
    result.learner_readiness = fc.args.learner_readiness;
  if (fc.args.final_understanding)
    result.final_understanding = fc.args.final_understanding;
  if (fc.args.struggle_reason && !result.struggle_reason)
    result.struggle_reason = fc.args.struggle_reason;
  if (fc.args.concept && !result.concept)
    result.concept = fc.args.concept;
  if (fc.args.pause_reason)
    result.pause_reason = fc.args.pause_reason;
  if (fc.args.concepts_covered_so_far)
    result.concepts_covered_so_far = fc.args.concepts_covered_so_far;
  if (fc.args.resume_suggestion)
    result.resume_suggestion = fc.args.resume_suggestion;
}

function extractTrackConcepts(
  fc: { name: string; args: Record<string, string> },
  result: SocraticChatResponse
): void {
  if (fc.name !== "track_concepts") return;
  const parseJsonArray = (val: string | undefined): string[] | undefined => {
    if (!val) return undefined;
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? parsed : undefined;
    } catch {
      return val.split(",").map((s) => s.trim());
    }
  };
  result.concepts_demonstrated =
    parseJsonArray(fc.args.concepts_demonstrated) ?? result.concepts_demonstrated;
  result.concept_levels =
    parseJsonArray(fc.args.concept_levels) ?? result.concept_levels;
  result.concepts_covered =
    parseJsonArray(fc.args.concepts_covered) ?? result.concepts_covered;
  result.concepts_missed =
    parseJsonArray(fc.args.concepts_missed) ?? result.concepts_missed;
  if (fc.args.struggle_reason)
    result.struggle_reason = fc.args.struggle_reason;
}

export function parseSocraticResponse(
  data: GeminiFunctionCallResponse
): SocraticChatResponse {
  const parts = data.candidates?.[0]?.content?.parts;

  if (!parts || parts.length === 0) {
    throw new Error("No parts in Gemini response");
  }

  const functionCalls = parts
    .filter((p) => p.functionCall)
    .map((p) => p.functionCall!);

  if (functionCalls.length === 0) {
    const textPart = parts.find((p) => p.text);
    if (textPart?.text) {
      return { reply: textPart.text, tool_type: "fallback" };
    }
    throw new Error("No function call in Gemini response");
  }

  const replySegments: string[] = [];
  const toolTypes: string[] = [];
  const result: SocraticChatResponse = { reply: "", tool_type: "" };

  for (const fc of functionCalls) {
    if (REPLY_TOOLS.has(fc.name)) {
      const text = extractReplyText(fc);
      if (text) replySegments.push(text);
      toolTypes.push(fc.name);
      extractMetadata(fc, result);
    } else if (SIDE_EFFECT_TOOLS.has(fc.name)) {
      extractTrackConcepts(fc, result);
      if (!toolTypes.includes(fc.name)) toolTypes.push(fc.name);
    } else {
      // Unknown tool - skip gracefully
      toolTypes.push(fc.name);
    }
  }

  result.reply = replySegments.join("\n\n");
  result.tool_type = toolTypes.join("+");

  return result;
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

  // Build system prompt and tools
  const conversation = body.context?.conversation ?? [];
  const learnerId = c.get("learnerId" as never) as string | undefined;
  let progressContext = "";
  if (learnerId) {
    try {
      progressContext = await buildProgressContext(c.env.DB, learnerId, body.profile);
    } catch {
      // Non-critical: proceed without progress context
    }
  }
  const curriculumContext = buildCurriculumContext(body.profile, body.section_id);
  const systemPrompt = buildSocraticSystemPrompt(meta, section, conversation, progressContext || undefined, curriculumContext || undefined);
  const tools = buildSocraticTools(section, meta);

  // Build Gemini contents from conversation history
  const contents = buildGeminiContents(conversation, body.message);

  // Call Gemini with retry
  try {
    const model = c.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
    let data: GeminiFunctionCallResponse | undefined;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const url = `${GEMINI_API_URL}/${model}:generateContent?key=${c.env.GEMINI_API_KEY}`;
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents,
            tools,
            generationConfig: { temperature: SOCRATIC_TEMPERATURE },
          }),
        });

        if (!response.ok) {
          throw new Error(`Gemini ${response.status}`);
        }

        data = (await response.json()) as GeminiFunctionCallResponse;
        break;
      } catch (err) {
        if (attempt < MAX_RETRIES) {
          await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
          continue;
        }
        throw err;
      }
    }

    const result = parseSocraticResponse(data!);

    // Update progress (fire-and-forget - don't block response)
    if (learnerId) {
      updateSectionProgress(c.env.DB, learnerId, body.profile, body.section_id, result).catch(() => {});
    }

    return c.json(result);
  } catch {
    return c.json({ error: "Tutor unavailable" }, 502);
  }
});
