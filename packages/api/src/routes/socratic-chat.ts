import { Hono } from "hono";
import type { Env } from "../env";
import type {
  LearnerProfile,
  CurriculumMeta,
  SectionMeta,
  AccountabilityScope,
} from "@softwarepilots/shared";
import {
  buildGeminiContents,
  GEMINI_API_URL,
} from "../lib/gemini";
import { updateSectionProgress, buildProgressContext } from "./curriculum-progress";
import { getOrCreateEnrollment } from "../lib/enrollment-store";
import { loadCurriculumForEnrollment, extractMeta, findSection } from "../lib/curriculum-store";
import { getPrompt, resolveTemplate } from "../lib/prompts";
import { buildCurriculumContext, buildConversationContext, compressConversation, persistSummary } from "../lib/context-assembly";
import type { GeminiFunctionCallResponse } from "../lib/gemini";

/* ---- Constants ---- */

const DEFAULT_GEMINI_MODEL = "gemini-flash-latest";
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
  query_type?: string;
  topics_referenced?: string;
  dimension?: string;
  readiness?: string;
  gaps?: string[];
  claims_demonstrated?: string[];
  claim_levels?: string[];
  misconceptions_surfaced?: string[];
  misconceptions_resolved?: string[];
  claim_progress?: { demonstrated: number; total: number; percentage: number } | null;
  section_completed?: boolean;
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
            description: "Brief feedback on what the learner said, addressed directly to them using 'you' (e.g., 'You correctly identified...' not 'The learner correctly identifies...')",
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
        `Provide a direct explanation when the learner asks a factual question or when Socratic questioning has demonstrably failed. ${sectionContext}`,
      parameters: {
        type: "OBJECT",
        properties: {
          instruction: {
            type: "STRING",
            description: "A thorough explanation of the concept. This is the one time you teach directly instead of questioning - make it substantive. Explain what the concept is, why it matters in practice, and give a concrete example showing it in action. Do not abbreviate.",
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

  declarations.push({
    name: "lesson_query",
    description:
      "Answer a meta-question about the learning process - objectives, remaining topics, what needs attention, or overall assessment. Use the concept list, coverage data, and conversation history to give a personalised answer.",
    parameters: {
      type: "OBJECT",
      properties: {
        response: {
          type: "STRING",
          description: "The answer to the learner's meta-question",
        },
        query_type: {
          type: "STRING",
          enum: ["objectives", "remaining_topics", "needs_attention", "overall_assessment", "general"],
          description: "The type of meta-question being answered",
        },
        topics_referenced: {
          type: "STRING",
          description: "Comma-separated topics mentioned in the answer",
        },
      },
      required: ["response", "query_type"],
    },
  });

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

  if (section.learning_map && section.learning_map.core_claims.length > 0) {
    const claimList = section.learning_map.core_claims
      .map((c) => `${c.id}: ${c.statement}`)
      .join("; ");
    const misconceptionList = section.learning_map.key_misconceptions
      .map((m) => m.id)
      .join(", ");
    declarations.push({
      name: "claim_assessment",
      description:
        `Report which claims from the learning map the learner demonstrated in this exchange. ` +
        `Call alongside other tools to track claim coverage. ` +
        `Available claims: ${claimList}` +
        (misconceptionList ? `. Misconception IDs: ${misconceptionList}` : ""),
      parameters: {
        type: "OBJECT",
        properties: {
          claims_demonstrated: {
            type: "ARRAY",
            items: { type: "STRING" },
            description:
              "Claim IDs the learner demonstrated understanding of in this exchange",
          },
          claim_levels: {
            type: "ARRAY",
            items: { type: "STRING" },
            description:
              "Understanding levels (developing/solid/strong) corresponding to each claim",
          },
          misconceptions_surfaced: {
            type: "ARRAY",
            items: { type: "STRING" },
            description:
              "Misconception IDs the learner exhibited in this exchange",
          },
          misconceptions_resolved: {
            type: "ARRAY",
            items: { type: "STRING" },
            description:
              "Misconception IDs the learner corrected or moved past in this exchange",
          },
        },
        required: ["claims_demonstrated", "claim_levels"],
      },
    });
  }

  if (meta.accountability_scope) {
    declarations.push({
      name: "accountability_probe",
      description:
        `Ask the learner to connect a technical concept to their accountability scope. ${sectionContext}`,
      parameters: {
        type: "OBJECT",
        properties: {
          response: {
            type: "STRING",
            description:
              "The accountability-focused question to ask the learner",
          },
          topic: {
            type: "STRING",
            description: "Brief label for the topic area being probed",
          },
          dimension: {
            type: "STRING",
            enum: ["diagnosis", "verification", "escalation", "sign_off"],
            description:
              "The accountability dimension being explored",
          },
        },
        required: ["response", "topic", "dimension"],
      },
    });
  }

  if (section.simulation_scenarios && section.simulation_scenarios.length > 0) {
    declarations.push({
      name: "simulation_readiness_check",
      description:
        `Assess whether the learner is ready for related simulation scenarios. ${sectionContext}`,
      parameters: {
        type: "OBJECT",
        properties: {
          scenario_ids: {
            type: "ARRAY",
            items: { type: "STRING" },
            description: "IDs of scenarios being assessed",
          },
          readiness: {
            type: "STRING",
            enum: ["not_ready", "approaching", "ready"],
            description: "Overall readiness for the simulation scenarios",
          },
          gaps: {
            type: "ARRAY",
            items: { type: "STRING" },
            description: "Knowledge gaps that need addressing before simulation",
          },
          recommendation: {
            type: "STRING",
            description: "Next step recommendation based on readiness assessment",
          },
        },
        required: ["scenario_ids", "readiness", "gaps", "recommendation"],
      },
    });
  }

  return [{ functionDeclarations: declarations }];
}

/* ---- System prompt builder ---- */

/**
 * Build a system prompt for review mode - focused on probing overdue concepts
 * rather than teaching new material.
 */
export function buildReviewSystemPrompt(
  meta: CurriculumMeta,
  section: SectionMeta,
  conversation: Array<{ role: "user" | "tutor"; content: string }>,
  reviewPersona: string,
  progressContext?: string,
): string {
  const lines = [
    reviewPersona,
  ];

  if (progressContext) {
    lines.push("", "== Learner Progress Context ==", progressContext);
  }

  // Include section context for the concepts being reviewed
  if (section.key_intuition) {
    lines.push("", "== Section Context ==", `Key insight from this section: ${section.key_intuition}`);
  }

  // Include learning map if available
  const lm = section.learning_map;
  if (lm && lm.core_claims.length > 0) {
    lines.push("", "== Claims for Reference ==");
    lm.core_claims.forEach((claim, i) => {
      lines.push(`${i + 1}. [${claim.id}] ${claim.statement}`);
    });
  }

  if (conversation.length === 0) {
    lines.push(
      "",
      "== First Message ==",
      "Start by greeting the learner and asking about a specific concept that needs review. Be warm and encouraging.",
    );
  }

  return lines.join("\n");
}

export function buildSocraticSystemPrompt(
  meta: CurriculumMeta,
  section: SectionMeta,
  conversation: Array<{ role: "user" | "tutor"; content: string }>,
  persona: string,
  rules: string,
  tutorGuidance: string,
  progressContext?: string,
  curriculumContext?: string,
  conversationContext?: string
): string {
  const lines = [
    persona,
    "",
    "== Pedagogical Approach ==",
    tutorGuidance,
    "",
    "== Target Insight ==",
    `The key intuition for this section: ${section.key_intuition}`,
    "",
    `== Section Context ==`,
    `Module: ${section.module_title}`,
    `Section: ${section.title}`,
    "",
    "== Rules ==",
    rules,
  ];

  // Inject learning map (optional - may not exist for dynamically generated content)
  const lm = section.learning_map;
  if (lm && lm.core_claims.length > 0) {
    lines.push(
      "",
      "== Section Learning Map ==",
      "Core claims to cover (guide the learner through these):"
    );
    lm.core_claims.forEach((claim, i) => {
      lines.push(`${i + 1}. [${claim.id}] ${claim.statement} - Demonstrated when: ${claim.demonstration_criteria}`);
    });
  }
  if (lm && lm.key_misconceptions.length > 0) {
    lines.push(
      "",
      "Common misconceptions to watch for:"
    );
    for (const m of lm.key_misconceptions) {
      lines.push(`- [${m.id}] Belief: ${m.belief} -> Correct: ${m.correction}`);
    }
  }
  if (lm && lm.key_intuition_decomposition.length > 0) {
    lines.push(
      "",
      "Key intuition builds through these steps:"
    );
    const sorted = [...lm.key_intuition_decomposition].sort((a, b) => a.order - b.order);
    for (const step of sorted) {
      lines.push(`${step.order}. ${step.statement}`);
    }
    lines.push(`-> ${section.key_intuition}`);
  }

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

  if (meta.accountability_scope) {
    const scopeDescriptions: Record<AccountabilityScope, string> = {
      "learning": "exploring concepts without production responsibility",
      "single-app": "responsible for a single application's correctness and reliability",
      "system-of-services": "accountable for interconnected services and their failure modes",
      "org-practices": "shaping engineering practices and standards across the organization",
    };
    lines.push(
      "",
      "== Accountability Context ==",
      `The learner's accountability scope: ${meta.accountability_scope} - ${scopeDescriptions[meta.accountability_scope]}.`,
      "Use accountability_probe to ask the learner to connect technical concepts to their real-world responsibilities.",
      "Frame probes around four dimensions: diagnosis (can they identify what went wrong), verification (can they confirm a fix works), escalation (do they know when to involve others), and sign_off (are they confident enough to approve a change).",
    );
  }

  if (section.simulation_scenarios && section.simulation_scenarios.length > 0) {
    lines.push(
      "",
      "== Simulation Scenarios ==",
      "The following simulation scenarios are related to this section:",
    );
    section.simulation_scenarios.forEach((scenario, i) => {
      lines.push(`${i + 1}. ${scenario}`);
    });
    lines.push(
      "When the learner demonstrates sufficient understanding, use simulation_readiness_check to assess whether they are ready for these scenarios.",
    );
  }

  if (progressContext) {
    lines.push("", progressContext);
  }

  if (curriculumContext) {
    lines.push("", curriculumContext);
  }

  if (conversationContext) {
    lines.push("", conversationContext);
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
  "lesson_query",
  "accountability_probe",
]);

const SIDE_EFFECT_TOOLS = new Set([
  "track_concepts",
  "claim_assessment",
  "simulation_readiness_check",
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

    case "lesson_query":
      return fc.args.response || null;

    case "accountability_probe":
      return fc.args.response || "How does this relate to your day-to-day responsibilities?";

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
  if (fc.args.query_type && !result.query_type)
    result.query_type = fc.args.query_type;
  if (fc.args.topics_referenced && !result.topics_referenced)
    result.topics_referenced = fc.args.topics_referenced;
  if (fc.args.dimension && !result.dimension)
    result.dimension = fc.args.dimension;
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

export function extractClaimAssessment(
  fc: { name: string; args: Record<string, string> },
  result: SocraticChatResponse
): void {
  if (fc.name !== "claim_assessment") return;
  const parseJsonArray = (val: string | undefined): string[] | undefined => {
    if (!val) return undefined;
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? parsed : undefined;
    } catch {
      return val.split(",").map((s) => s.trim());
    }
  };
  result.claims_demonstrated =
    parseJsonArray(fc.args.claims_demonstrated) ?? result.claims_demonstrated;
  result.claim_levels =
    parseJsonArray(fc.args.claim_levels) ?? result.claim_levels;
  result.misconceptions_surfaced =
    parseJsonArray(fc.args.misconceptions_surfaced) ?? result.misconceptions_surfaced;
  result.misconceptions_resolved =
    parseJsonArray(fc.args.misconceptions_resolved) ?? result.misconceptions_resolved;
}

function extractSimulationReadiness(
  fc: { name: string; args: Record<string, string> },
  result: SocraticChatResponse
): void {
  if (fc.name !== "simulation_readiness_check") return;
  const parseJsonArray = (val: string | undefined): string[] | undefined => {
    if (!val) return undefined;
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? parsed : undefined;
    } catch {
      return val.split(",").map((s) => s.trim());
    }
  };
  if (fc.args.readiness) result.readiness = fc.args.readiness;
  result.gaps = parseJsonArray(fc.args.gaps) ?? result.gaps;
  if (fc.args.recommendation && !result.recommendation)
    result.recommendation = fc.args.recommendation;
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
      extractClaimAssessment(fc, result);
      extractSimulationReadiness(fc, result);
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

  // Load content from enrollment's pinned curriculum version in DB
  const learnerId = c.get("learnerId" as never) as string | undefined;
  if (!learnerId) {
    return c.json({ error: "Authentication required" }, 401);
  }

  await getOrCreateEnrollment(c.env.DB, learnerId, body.profile);
  const versioned = await loadCurriculumForEnrollment(c.env.DB, learnerId, body.profile);
  if (!versioned) {
    return c.json({ error: `No curriculum version found for profile "${body.profile}". Run the seed script.` }, 500);
  }

  const meta: CurriculumMeta = extractMeta(versioned.content);
  const section: SectionMeta | null = findSection(versioned.content, body.section_id);
  if (!section) {
    return c.json({ error: `Section "${body.section_id}" not found in profile "${body.profile}"` }, 400);
  }

  // Build system prompt and tools
  const conversation = body.context?.conversation ?? [];
  let progressContext = "";
  if (learnerId) {
    try {
      progressContext = await buildProgressContext(c.env.DB, learnerId, body.profile);
    } catch {
      // Non-critical: proceed without progress context
    }
  }
  const curriculumContext = buildCurriculumContext(body.profile, body.section_id);
  let conversationContext = "";
  if (learnerId) {
    try {
      conversationContext = await buildConversationContext(c.env.DB, learnerId, body.profile, body.section_id);
    } catch {
      // Non-critical: proceed without conversation context
    }
  }
  // Fetch prompts from DB and resolve template variables
  let systemPrompt: string;
  const isReviewMode = body.mode === "review";

  if (isReviewMode && learnerId) {
    const reviewPrompt = await getPrompt(c.env.DB, "review.persona");
    const resolvedReview = resolveTemplate(reviewPrompt.content, { profile: meta.profile });
    systemPrompt = buildReviewSystemPrompt(meta, section, conversation, resolvedReview, progressContext || undefined);
  } else {
    const [personaPrompt, rulesPrompt, tutorGuidancePrompt] = await Promise.all([
      getPrompt(c.env.DB, "socratic.persona"),
      getPrompt(c.env.DB, "socratic.rules"),
      getPrompt(c.env.DB, `tutor_guidance.${meta.profile}`),
    ]);
    const resolvedPersona = resolveTemplate(personaPrompt.content, {
      section_title: section.title,
      profile: meta.profile,
    });
    const resolvedRules = resolveTemplate(rulesPrompt.content, {
      max_response_sentences: String(MAX_RESPONSE_SENTENCES),
    });
    systemPrompt = buildSocraticSystemPrompt(meta, section, conversation, resolvedPersona, resolvedRules, tutorGuidancePrompt.content, progressContext || undefined, curriculumContext || undefined, conversationContext || undefined);
  }
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

    // Update progress synchronously so we can include claim_progress in the response.
    if (learnerId) {
      try {
        const progressUpdate = await updateSectionProgress(c.env.DB, learnerId, body.profile, body.section_id, result);
        result.claim_progress = progressUpdate.claim_progress;
        result.section_completed = progressUpdate.section_completed;
      } catch (err) {
        console.error(`[progress] Update failed learner=${learnerId} section=${body.section_id} profile=${body.profile}:`, err instanceof Error ? err.message : err);
      }
    }

    // Compress conversation on session_complete - also needs waitUntil
    if (result.tool_type?.includes("session_complete") && learnerId) {
      const allMessages = [
        ...conversation,
        { role: "user" as const, content: body.message },
        { role: "tutor" as const, content: result.reply },
      ];
      const model = c.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
      const summarizationPrompt = await getPrompt(c.env.DB, "summarization.instructions");
      const compressionPromise = compressConversation(c.env.GEMINI_API_KEY, model, allMessages, section.title, summarizationPrompt.content)
        .then(async (summary) => {
          if (!summary) return;
          // Find the active conversation to persist summary
          const conv = await c.env.DB.prepare(
            `SELECT id FROM curriculum_conversations WHERE learner_id = ? AND profile = ? AND section_id = ? AND archived_at IS NULL`
          )
            .bind(learnerId, body.profile, body.section_id)
            .first<{ id: string }>();
          if (conv) {
            await persistSummary(c.env.DB, conv.id, summary);
          }
        })
        .catch((err) => {
          console.error(`[conversation] Compression failed learner=${learnerId} section=${body.section_id}:`, err instanceof Error ? err.message : err);
        });
      try { c.executionCtx.waitUntil(compressionPromise); } catch { /* test env: no executionCtx */ }
    }

    return c.json(result);
  } catch {
    return c.json({ error: "Tutor unavailable" }, 502);
  }
});
