import type { Env } from "../env";
import {
  GEMINI_API_URL,
} from "../lib/gemini";
import type { GeminiFunctionCallResponse } from "../lib/gemini";
import { getPrompt, resolveTemplate } from "../lib/prompts";
import type {
  SimulationScenario,
  SimulationPhase,
  SimulationSession,
  SimulationEvent,
  SimulationDebrief,
  InterventionThresholds,
  TutorObservation,
} from "@softwarepilots/shared";

/* ---- Constants ---- */

const DEFAULT_GEMINI_MODEL = "gemini-flash-latest";
const TUTOR_TEMPERATURE = 0.3;
const DEBRIEF_TEMPERATURE = 0.3;
const TUTOR_TOOL_COUNT = 5;
const MAX_RETRIES = 1;
const RETRY_DELAY_MS = 1000;

/* ---- Action log type ---- */

export interface ActionLogEntry {
  action_id: string;
  category: "observe" | "diagnose" | "act" | "communicate" | "delegate";
  label: string;
  timestamp: string;
  diagnostic_value: "high" | "medium" | "low" | "misleading";
  phase_id: string;
}

/* ---- Tool builder ---- */

export function buildSimulationTutorTools(): Array<{
  functionDeclarations: Array<Record<string, unknown>>;
}> {
  const declarations: Array<Record<string, unknown>> = [
    {
      name: "observe_silently",
      description:
        "Internal reasoning about the trainee's current approach. NOT visible to the trainee. " +
        "Use this when the trainee is progressing adequately or when you need to track reasoning without intervening.",
      parameters: {
        type: "OBJECT",
        properties: {
          reasoning: {
            type: "STRING",
            description:
              "The tutor's internal reasoning about what they observe in the trainee's actions",
          },
        },
        required: ["reasoning"],
      },
    },
    {
      name: "gentle_nudge",
      description:
        "A subtle hint to guide the trainee without giving away the answer. " +
        "Visible to the trainee. Use when the trainee is slightly off-track or could benefit from a small pointer.",
      parameters: {
        type: "OBJECT",
        properties: {
          observation: {
            type: "STRING",
            description:
              "What you noticed about the trainee's approach",
          },
          hint: {
            type: "STRING",
            description:
              "A gentle hint to nudge the trainee in a better direction",
          },
          confidence: {
            type: "STRING",
            enum: ["low", "medium", "high"],
            description:
              "How confident you are that the trainee needs this nudge",
          },
        },
        required: ["observation", "hint", "confidence"],
      },
    },
    {
      name: "direct_intervention",
      description:
        "A clear, direct piece of guidance when the trainee is significantly off-track or at risk. " +
        "Visible to the trainee. Use when the trainee is heading in the wrong direction or stalling too long.",
      parameters: {
        type: "OBJECT",
        properties: {
          observation: {
            type: "STRING",
            description:
              "What triggered this intervention",
          },
          guidance: {
            type: "STRING",
            description:
              "Direct guidance on what the trainee should consider or do next",
          },
          severity: {
            type: "STRING",
            enum: ["moderate", "urgent"],
            description:
              "How urgent this intervention is",
          },
        },
        required: ["observation", "guidance", "severity"],
      },
    },
    {
      name: "highlight_good_judgment",
      description:
        "Praise a specific decision the trainee made that demonstrates good engineering judgment. " +
        "Visible to the trainee. Use to reinforce positive patterns.",
      parameters: {
        type: "OBJECT",
        properties: {
          decision: {
            type: "STRING",
            description:
              "The specific decision the trainee made that was good",
          },
          why_it_matters: {
            type: "STRING",
            description:
              "Why this decision matters in real-world incident response",
          },
        },
        required: ["decision", "why_it_matters"],
      },
    },
    {
      name: "accountability_moment",
      description:
        "A probing question that asks the trainee to justify their reasoning or consider accountability. " +
        "Visible to the trainee. Use at key decision points to develop accountability habits.",
      parameters: {
        type: "OBJECT",
        properties: {
          decision_context: {
            type: "STRING",
            description:
              "The context around the decision being probed",
          },
          probe_question: {
            type: "STRING",
            description:
              "A Socratic question that probes the trainee's reasoning or accountability",
          },
          dimension: {
            type: "STRING",
            enum: ["diagnosis", "verification", "escalation", "sign_off"],
            description:
              "Which accountability dimension this probe targets",
          },
        },
        required: ["decision_context", "probe_question", "dimension"],
      },
    },
  ];

  return [{ functionDeclarations: declarations }];
}

/* ---- System prompt builder ---- */

export function buildSimulationTutorPrompt(
  scenario: SimulationScenario,
  actionLog: ActionLogEntry[],
  currentPhase: SimulationPhase,
  tutorTemplate: string
): string {
  // Assemble dynamic sections
  const rootCauseLines = scenario.root_causes
    .map((rc) => `- [${rc.id}] ${rc.description}`)
    .join("\n");

  const aiAgentBlock = scenario.ai_agent_behavior
    ? [
        "",
        "== AI Agent Behavior ==",
        `Behavior: ${scenario.ai_agent_behavior.behavior}`,
        `Personality: ${scenario.ai_agent_behavior.personality}`,
        `Knowledge gaps: ${scenario.ai_agent_behavior.knowledge_gaps.join(", ")}`,
      ].join("\n")
    : "";

  const coachingBlock = scenario.tutor_context?.coaching_prompt
    ? [
        "",
        "== Scenario-Specific Coaching ==",
        scenario.tutor_context.coaching_prompt,
      ].join("\n")
    : "";

  const metricsBlock = currentPhase.telemetry_snapshot.metrics.length > 0
    ? "\n\nCurrent metrics:\n" + currentPhase.telemetry_snapshot.metrics
        .map((m) => {
          const thresholdInfo = m.threshold !== undefined ? ` (threshold: ${m.threshold})` : "";
          return `  - ${m.name}: ${m.value} ${m.unit} [${m.status}]${thresholdInfo}`;
        })
        .join("\n")
    : "";

  const logsBlock = currentPhase.telemetry_snapshot.logs.length > 0
    ? "\n\nRecent logs:\n" + currentPhase.telemetry_snapshot.logs
        .map((log) => `  - [${log.level}] ${log.service}: ${log.message}`)
        .join("\n")
    : "";

  let actionLogBlock: string;
  if (actionLog.length === 0) {
    actionLogBlock = "No actions taken yet.";
  } else {
    actionLogBlock = actionLog
      .map(
        (entry) =>
          `  [${entry.timestamp}] ${entry.category}/${entry.label} ` +
          `(diagnostic_value: ${entry.diagnostic_value}, phase: ${entry.phase_id})`
      )
      .join("\n");
  }

  // Resolve the template with all variables
  const resolved = resolveTemplate(tutorTemplate, {
    scenario_title: scenario.title,
    scenario_level: scenario.level,
    scenario_tier: scenario.tier,
    scenario_briefing: scenario.briefing,
    root_causes: rootCauseLines,
    ai_agent_block: aiAgentBlock,
    stall_seconds: String(scenario.intervention_thresholds.stall_seconds),
    wrong_direction_count: String(scenario.intervention_thresholds.wrong_direction_count),
    fixation_loop_count: String(scenario.intervention_thresholds.fixation_loop_count),
    coaching_block: coachingBlock,
    phase_id: currentPhase.id,
    phase_narrative: currentPhase.narrative,
    dashboard_state: currentPhase.telemetry_snapshot.dashboard_state,
    metrics_block: metricsBlock,
    logs_block: logsBlock,
    action_log: actionLogBlock,
  });

  return resolved;
}

/* ---- Gemini caller and response parser ---- */

const VISIBLE_TOOLS = new Set([
  "gentle_nudge",
  "direct_intervention",
  "highlight_good_judgment",
  "accountability_moment",
]);

function parseToolCallToObservation(
  fc: { name: string; args: Record<string, string> }
): TutorObservation {
  const tool = fc.name as TutorObservation["tool"];
  const visible = VISIBLE_TOOLS.has(fc.name);

  const observation: TutorObservation = {
    tool,
    visible,
    metadata: { ...fc.args },
  };

  // Build human-readable content for visible tools
  switch (fc.name) {
    case "gentle_nudge":
      observation.content = fc.args.hint || fc.args.observation;
      break;
    case "direct_intervention":
      observation.content = fc.args.guidance || fc.args.observation;
      break;
    case "highlight_good_judgment":
      observation.content = `${fc.args.decision} - ${fc.args.why_it_matters}`;
      break;
    case "accountability_moment":
      observation.content = fc.args.probe_question;
      break;
    case "observe_silently":
    default:
      // No content for silent observations
      break;
  }

  return observation;
}

export async function evaluateAction(
  env: Env,
  actionLog: ActionLogEntry[],
  scenario: SimulationScenario,
  currentPhase: SimulationPhase,
  thresholds: InterventionThresholds
): Promise<TutorObservation> {
  const model = env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
  const tutorPrompt = await getPrompt(env.DB, "simulation.tutor");
  const systemPrompt = buildSimulationTutorPrompt(scenario, actionLog, currentPhase, tutorPrompt.content);
  const tools = buildSimulationTutorTools();

  // Build a single user message summarising the latest action for Gemini to evaluate
  const latestAction = actionLog.length > 0
    ? actionLog[actionLog.length - 1]
    : null;

  const userMessage = latestAction
    ? `The trainee just performed: [${latestAction.category}] ${latestAction.label} (diagnostic value: ${latestAction.diagnostic_value}). Evaluate this action in the context of the full action log and current phase telemetry.`
    : "The simulation has started. The trainee has not yet taken any action. Observe the initial state.";

  const contents = [
    { role: "user", parts: [{ text: userMessage }] },
  ];

  try {
    let data: GeminiFunctionCallResponse | undefined;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const url = `${GEMINI_API_URL}/${model}:generateContent?key=${env.GEMINI_API_KEY}`;
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents,
            tools,
            toolConfig: {
              functionCallingConfig: { mode: "ANY" },
            },
            generationConfig: { temperature: TUTOR_TEMPERATURE },
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

    // Parse response - extract exactly one tool call
    const parts = data?.candidates?.[0]?.content?.parts;
    if (!parts || parts.length === 0) {
      throw new Error("No parts in Gemini response");
    }

    const functionCalls = parts
      .filter((p) => p.functionCall)
      .map((p) => p.functionCall!);

    if (functionCalls.length === 0) {
      throw new Error("No function call in Gemini response");
    }

    // Use only the first function call (we instructed "exactly one")
    return parseToolCallToObservation(functionCalls[0]);
  } catch {
    // Graceful degradation: return silent observation on any failure
    return {
      tool: "observe_silently",
      visible: false,
      metadata: { error: true },
    };
  }
}

/* ---- Debrief prompt builder ---- */

export interface PriorSessionSummary {
  session_id: string;
  completed_at: string;
  debrief: SimulationDebrief;
}

export function buildDebriefPrompt(
  scenario: SimulationScenario,
  events: SimulationEvent[],
  debriefTemplate: string,
  priorSessions?: PriorSessionSummary[],
): string {
  // Assemble dynamic sections
  const rootCauseLines = scenario.root_causes
    .map((rc) => `- [${rc.id}] ${rc.description}`)
    .join("\n");

  const aiAgentBlock = scenario.ai_agent_behavior
    ? [
        "",
        "== AI Agent Configuration ==",
        `Behavior: ${scenario.ai_agent_behavior.behavior}`,
        `Personality: ${scenario.ai_agent_behavior.personality}`,
        `Knowledge gaps: ${scenario.ai_agent_behavior.knowledge_gaps.join(", ")}`,
        "Note: The trainee should have verified AI suggestions rather than trusting them blindly.",
      ].join("\n")
    : "";

  let eventLogBlock: string;
  if (events.length === 0) {
    eventLogBlock = "No events recorded.";
  } else {
    eventLogBlock = events
      .map((event) => `  [${event.created_at}] ${event.event_type}: ${JSON.stringify(event.event_data)}`)
      .join("\n");
  }

  // Extract tutor observations from events
  const tutorEvents = events.filter((e) => e.event_type === "tutor_intervention");
  const tutorBlock = tutorEvents.length > 0
    ? [
        "",
        "== Tutor Observations Made During Session ==",
        ...tutorEvents.map((te) => `  [${te.created_at}] ${JSON.stringify(te.event_data)}`),
      ].join("\n")
    : "";

  // Extract agent interactions from events
  const agentEvents = events.filter((e) => e.event_type === "agent_query");
  const agentBlock = agentEvents.length > 0
    ? [
        "",
        "== AI Agent Interactions ==",
        ...agentEvents.map((ae) => `  [${ae.created_at}] ${JSON.stringify(ae.event_data)}`),
      ].join("\n")
    : "";

  // Prior sessions for progression
  let priorSessionsBlock = "";
  if (priorSessions && priorSessions.length > 0) {
    const priorLines = [
      "",
      "== Prior Session Attempts ==",
      `The trainee has ${priorSessions.length} prior attempt(s) at this scenario.`,
    ];
    for (const ps of priorSessions) {
      priorLines.push(
        `  Session ${ps.session_id} (completed ${ps.completed_at}):`,
        `    Good judgment moments: ${ps.debrief.good_judgment_moments.length}`,
        `    Missed signals: ${ps.debrief.missed_signals.length}`,
        `    Accountability: ${ps.debrief.accountability_assessment.overall}`,
      );
    }
    priorLines.push("", "Include a 'progression' field comparing this attempt to prior ones.");
    priorSessionsBlock = priorLines.join("\n");
  }

  const debriefGuidanceBlock = scenario.tutor_context?.debrief_prompt
    ? [
        "",
        "== Scenario-Specific Debrief Guidance ==",
        scenario.tutor_context.debrief_prompt,
      ].join("\n")
    : "";

  const outputSchema = JSON.stringify({
    good_judgment_moments: [
      { action: "string - what the trainee did", why_it_was_good: "string - why it was good", timestamp: "string - when it happened" },
    ],
    missed_signals: [
      { signal: "string - what they missed", what_to_check: "string - what they should have done", when_it_was_visible: "string - when it was available" },
    ],
    expert_path_comparison: {
      expert_steps: ["string - step an expert would take"],
      trainee_steps: ["string - step the trainee actually took"],
      divergence_points: ["string - where and why the trainee diverged from expert path"],
    },
    accountability_assessment: {
      verified: "boolean - did trainee verify before acting",
      escalated_when_needed: "boolean - did trainee escalate appropriately",
      documented_reasoning: "boolean - did trainee document/explain their reasoning",
      overall: "string - 1-2 sentence overall assessment",
    },
    progression: priorSessions && priorSessions.length > 0
      ? { previous_attempt_summary: "string - brief summary of prior attempts", improvement_areas: ["string - areas of improvement or regression"] }
      : undefined,
  }, null, 2);

  const resolved = resolveTemplate(debriefTemplate, {
    scenario_title: scenario.title,
    scenario_level: scenario.level,
    scenario_tier: scenario.tier,
    scenario_briefing: scenario.briefing,
    root_causes: rootCauseLines,
    ai_agent_block: aiAgentBlock,
    event_log: eventLogBlock,
    tutor_observations_block: tutorBlock,
    agent_interactions_block: agentBlock,
    prior_sessions_block: priorSessionsBlock,
    debrief_guidance_block: debriefGuidanceBlock,
    output_schema: outputSchema,
  });

  return resolved;
}

/* ---- Minimal fallback debrief ---- */

function buildMinimalDebrief(
  events: SimulationEvent[],
): SimulationDebrief {
  const actionEvents = events.filter((e) => e.event_type === "action");
  const traineeSteps = actionEvents.map((e) => {
    const data = e.event_data as Record<string, string>;
    return data.label || data.action_id || "unknown action";
  });

  return {
    good_judgment_moments: [],
    missed_signals: [],
    expert_path_comparison: {
      expert_steps: [],
      trainee_steps: traineeSteps,
      divergence_points: [],
    },
    accountability_assessment: {
      verified: false,
      escalated_when_needed: false,
      documented_reasoning: false,
      overall: "Debrief generation failed - minimal fallback response based on recorded events",
    },
  };
}

/* ---- Gemini debrief generation ---- */

export async function generateDebrief(
  env: Env,
  session: SimulationSession,
  events: SimulationEvent[],
  scenario: SimulationScenario,
  priorSessions?: PriorSessionSummary[],
): Promise<SimulationDebrief> {
  const model = env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
  const debriefPromptRow = await getPrompt(env.DB, "simulation.debrief");
  const systemPrompt = buildDebriefPrompt(scenario, events, debriefPromptRow.content, priorSessions);

  const userMessage = `Generate a structured debrief for session ${session.id}. The trainee completed ${events.length} events across the simulation.`;

  const contents = [
    { role: "user", parts: [{ text: userMessage }] },
  ];

  try {
    let responseText: string | undefined;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const url = `${GEMINI_API_URL}/${model}:generateContent?key=${env.GEMINI_API_KEY}`;
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents,
            generationConfig: {
              temperature: DEBRIEF_TEMPERATURE,
              responseMimeType: "application/json",
            },
          }),
        });

        if (!response.ok) {
          throw new Error(`Gemini ${response.status}`);
        }

        const data = (await response.json()) as {
          candidates?: Array<{
            content?: { parts?: Array<{ text?: string }> };
          }>;
        };

        responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (responseText) break;

        throw new Error("No text in Gemini response");
      } catch (err) {
        if (attempt < MAX_RETRIES) {
          await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
          continue;
        }
        throw err;
      }
    }

    if (!responseText) {
      return buildMinimalDebrief(events);
    }

    // Strip markdown code fences if present
    let cleaned = responseText.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
    }

    const parsed = JSON.parse(cleaned) as SimulationDebrief;

    // Validate required fields exist, fill in defaults for missing ones
    return {
      good_judgment_moments: Array.isArray(parsed.good_judgment_moments)
        ? parsed.good_judgment_moments
        : [],
      missed_signals: Array.isArray(parsed.missed_signals)
        ? parsed.missed_signals
        : [],
      expert_path_comparison: {
        expert_steps: Array.isArray(parsed.expert_path_comparison?.expert_steps)
          ? parsed.expert_path_comparison.expert_steps
          : [],
        trainee_steps: Array.isArray(parsed.expert_path_comparison?.trainee_steps)
          ? parsed.expert_path_comparison.trainee_steps
          : [],
        divergence_points: Array.isArray(parsed.expert_path_comparison?.divergence_points)
          ? parsed.expert_path_comparison.divergence_points
          : [],
      },
      accountability_assessment: {
        verified: Boolean(parsed.accountability_assessment?.verified),
        escalated_when_needed: Boolean(parsed.accountability_assessment?.escalated_when_needed),
        documented_reasoning: Boolean(parsed.accountability_assessment?.documented_reasoning),
        overall: parsed.accountability_assessment?.overall || "Assessment could not be fully determined",
      },
      progression: parsed.progression
        ? {
            previous_attempt_summary: parsed.progression.previous_attempt_summary || "",
            improvement_areas: Array.isArray(parsed.progression.improvement_areas)
              ? parsed.progression.improvement_areas
              : [],
          }
        : undefined,
    };
  } catch {
    // Graceful degradation: return minimal valid debrief on any failure
    return buildMinimalDebrief(events);
  }
}
