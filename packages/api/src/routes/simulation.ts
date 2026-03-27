import { Hono } from "hono";
import type { Env } from "../env";
import type {
  SimulationScenario,
  SimulationSession,
  SimulationEvent,
  SimulationPhase,
  TutorObservation,
  SimulationDebrief,
} from "@softwarepilots/shared";
import { listScenarios } from "@softwarepilots/shared";
import { GEMINI_API_URL } from "../lib/gemini";
import { generateDebrief } from "./simulation-tutor";
import { getPrompt, resolveTemplate } from "../lib/prompts";
import type { PriorSessionSummary } from "./simulation-tutor";

/* ---- Constants ---- */

const DEFAULT_GEMINI_MODEL = "gemini-flash-latest";
const AGENT_TEMPERATURE = 0.6;
const AGENT_MAX_TOKENS = 512;

/* ---- Scenario registry ---- */

/**
 * In-memory scenario registry. Scenarios will be populated by
 * scenario-specific stories. For now, returns undefined for
 * unknown IDs, allowing tests to inject scenarios.
 */
const scenarioRegistry = new Map<string, SimulationScenario>();

export function registerScenario(scenario: SimulationScenario): void {
  scenarioRegistry.set(scenario.id, scenario);
}

export function getScenario(id: string): SimulationScenario | undefined {
  return scenarioRegistry.get(id);
}

export function clearScenarioRegistry(): void {
  scenarioRegistry.clear();
}

/* ---- Auto-register all scenarios from shared package ---- */

for (const scenario of listScenarios()) {
  registerScenario(scenario);
}

/* ---- Stub: tutor observation (44.4 will implement) ---- */

export function observeSilently(): TutorObservation {
  return {
    tool: "observe_silently",
    visible: false,
  };
}

/* ---- Stub: debrief generation (44.5 will implement) ---- */

export function generateStubDebrief(
  _scenario: SimulationScenario,
  _events: SimulationEvent[],
): SimulationDebrief {
  return {
    good_judgment_moments: [],
    missed_signals: [],
    expert_path_comparison: {
      expert_steps: [],
      trainee_steps: [],
      divergence_points: [],
    },
    accountability_assessment: {
      verified: false,
      escalated_when_needed: false,
      documented_reasoning: false,
      overall: "Debrief generation pending - stub response",
    },
  };
}

/* ---- Helper: find phase by ID ---- */

function findPhase(
  scenario: SimulationScenario,
  phaseId: string,
): SimulationPhase | undefined {
  return scenario.phases.find((p) => p.id === phaseId);
}

/* ---- Helper: find action in phase ---- */

function findActionInPhase(phase: SimulationPhase, actionId: string) {
  return phase.available_actions.find((a) => a.id === actionId);
}

/* ---- Helper: resolve trigger to target phase ---- */

function resolveTrigger(
  phase: SimulationPhase,
  triggerId: string,
): string | undefined {
  // First check if triggerId directly matches a phase trigger's id
  const trigger = phase.triggers.find((t) => t.id === triggerId);
  if (trigger) {
    return trigger.target_phase;
  }
  // Fallback: treat triggerId as a direct phase ID (backward compat)
  return triggerId;
}

/* ---- Helper: check phase transition (single-action via phase_trigger) ---- */

function checkPhaseTransition(
  phase: SimulationPhase,
  actionId: string,
): string | undefined {
  const action = findActionInPhase(phase, actionId);
  if (action?.phase_trigger) {
    return resolveTrigger(phase, action.phase_trigger);
  }
  return undefined;
}

/* ---- Helper: parse AND-condition trigger ---- */

/**
 * Extracts required action IDs from a combined condition string.
 * Supported formats:
 *   "action:view-traces AND action:view-latency"
 *   "check-connection-pools AND view-retry-logs both taken"
 * Returns the list of action IDs, or null if the condition is not an AND trigger.
 */
function parseAndConditionActions(condition: string): string[] | null {
  // Must contain " AND " to be a combined trigger
  if (!condition.includes(" AND ")) {
    return null;
  }

  // Split on " AND " and extract action IDs from each part
  const parts = condition.split(" AND ");
  const actionIds: string[] = [];

  for (const part of parts) {
    const trimmed = part.trim();
    // Handle "action:some-id" prefix format
    const prefixMatch = trimmed.match(/^action:([a-z0-9-]+)/);
    if (prefixMatch) {
      actionIds.push(prefixMatch[1]);
      continue;
    }
    // Handle bare "some-id" possibly followed by " both taken" or other text
    const bareMatch = trimmed.match(/^([a-z0-9-]+)/);
    if (bareMatch) {
      actionIds.push(bareMatch[1]);
      continue;
    }
  }

  return actionIds.length >= 2 ? actionIds : null;
}

/**
 * Checks all AND-condition triggers in the current phase against the full
 * set of action IDs taken so far (including the current action).
 * Returns the target phase ID if any AND trigger is satisfied, or undefined.
 */
function checkAndConditionTriggers(
  phase: SimulationPhase,
  takenActionIds: Set<string>,
): string | undefined {
  for (const trigger of phase.triggers) {
    const requiredActions = parseAndConditionActions(trigger.condition);
    if (!requiredActions) {
      continue;
    }
    const allMet = requiredActions.every((id) => takenActionIds.has(id));
    if (allMet) {
      return trigger.target_phase;
    }
  }
  return undefined;
}

/* ---- Constants: observation count threshold ---- */

const OBSERVATION_COUNT_FOR_PHASE_ADVANCE = 2;

/* ---- Helper: check observation-count triggers ---- */

function checkObservationCountTrigger(
  phase: SimulationPhase,
  observationCount: number,
): string | undefined {
  // Check for triggers with condition matching "N+ observation actions taken"
  for (const trigger of phase.triggers) {
    if (
      trigger.condition.includes("observation actions taken") &&
      observationCount >= OBSERVATION_COUNT_FOR_PHASE_ADVANCE
    ) {
      return trigger.target_phase;
    }
  }
  return undefined;
}

/* ---- Route ---- */

export const simulation = new Hono<{ Bindings: Env }>();

/* POST /api/simulation/start */
simulation.post("/start", async (c) => {
  let body: { scenario_id: string };
  try {
    body = await c.req.json<{ scenario_id: string }>();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }

  if (!body.scenario_id || typeof body.scenario_id !== "string") {
    return c.json({ error: "scenario_id is required" }, 400);
  }

  const scenario = getScenario(body.scenario_id);
  if (!scenario) {
    return c.json({ error: `Scenario not found: ${body.scenario_id}` }, 404);
  }

  const learnerId = c.get("learnerId" as never) as string;

  // Check for existing active session for this learner + scenario
  const existing = await c.env.DB.prepare(
    `SELECT id FROM simulation_sessions WHERE learner_id = ? AND scenario_id = ? AND status = 'active'`
  )
    .bind(learnerId, body.scenario_id)
    .first<{ id: string }>();

  if (existing) {
    return c.json(
      { error: "Active session already exists for this scenario", session_id: existing.id },
      409,
    );
  }

  const sessionId = crypto.randomUUID();
  const initialPhase = scenario.phases[0];

  // Create session row
  await c.env.DB.prepare(
    `INSERT INTO simulation_sessions (id, learner_id, scenario_id, profile, status, current_phase) VALUES (?, ?, ?, ?, 'active', ?)`
  )
    .bind(sessionId, learnerId, scenario.id, scenario.level, initialPhase.id)
    .run();

  // Create initial event
  const eventId = crypto.randomUUID();
  await c.env.DB.prepare(
    `INSERT INTO simulation_events (id, session_id, event_type, event_data) VALUES (?, ?, 'observation', ?)`
  )
    .bind(eventId, sessionId, JSON.stringify({ type: "session_started", phase: initialPhase.id }))
    .run();

  const session: SimulationSession = {
    id: sessionId,
    learner_id: learnerId,
    scenario_id: scenario.id,
    profile: scenario.level,
    status: "active",
    current_phase: initialPhase.id,
    started_at: new Date().toISOString(),
  };

  return c.json({
    session,
    briefing: scenario.briefing,
    initial_phase: initialPhase,
    available_actions: initialPhase.available_actions,
  });
});

/* POST /api/simulation/action */
simulation.post("/action", async (c) => {
  let body: { session_id: string; action_id: string };
  try {
    body = await c.req.json<{ session_id: string; action_id: string }>();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }

  if (!body.session_id || typeof body.session_id !== "string") {
    return c.json({ error: "session_id is required" }, 400);
  }
  if (!body.action_id || typeof body.action_id !== "string") {
    return c.json({ error: "action_id is required" }, 400);
  }

  // Load session
  const session = await c.env.DB.prepare(
    `SELECT id, learner_id, scenario_id, profile, status, current_phase, started_at, completed_at FROM simulation_sessions WHERE id = ?`
  )
    .bind(body.session_id)
    .first<SimulationSession>();

  if (!session) {
    return c.json({ error: "Session not found" }, 404);
  }

  if (session.status !== "active") {
    return c.json({ error: "Session is not active" }, 409);
  }

  const scenario = getScenario(session.scenario_id);
  if (!scenario) {
    return c.json({ error: "Scenario no longer available" }, 500);
  }

  const currentPhase = findPhase(scenario, session.current_phase);
  if (!currentPhase) {
    return c.json({ error: "Current phase not found in scenario" }, 500);
  }

  // Validate action exists in current phase
  const action = findActionInPhase(currentPhase, body.action_id);
  if (!action) {
    return c.json({ error: `Invalid action: ${body.action_id}` }, 400);
  }

  // Record action event
  const actionEventId = crypto.randomUUID();
  await c.env.DB.prepare(
    `INSERT INTO simulation_events (id, session_id, event_type, event_data) VALUES (?, ?, 'action', ?)`
  )
    .bind(
      actionEventId,
      session.id,
      JSON.stringify({ action_id: action.id, category: action.category, label: action.label }),
    )
    .run();

  // Check for phase transition via action trigger
  let nextPhaseId = checkPhaseTransition(currentPhase, body.action_id);

  // If no direct trigger, check AND-condition triggers against event history
  if (!nextPhaseId) {
    const eventsResult = await c.env.DB.prepare(
      `SELECT event_data FROM simulation_events WHERE session_id = ? AND event_type = 'action'`
    )
      .bind(session.id)
      .all<{ event_data: string }>();

    const takenActionIds = new Set(
      (eventsResult.results ?? []).map((row) => {
        const data = JSON.parse(row.event_data) as { action_id?: string };
        return data.action_id ?? "";
      }),
    );

    nextPhaseId = checkAndConditionTriggers(currentPhase, takenActionIds);

    // If still no trigger, check observation-count triggers
    if (!nextPhaseId && action.category === "observe") {
      const observationCount = (eventsResult.results ?? []).filter((row) => {
        const data = JSON.parse(row.event_data) as { category?: string };
        return data.category === "observe";
      }).length;

      nextPhaseId = checkObservationCountTrigger(currentPhase, observationCount);
    }
  }

  let phaseTransition: { from: string; to: string; new_phase: SimulationPhase } | undefined;

  if (nextPhaseId) {
    const nextPhase = findPhase(scenario, nextPhaseId);
    if (nextPhase) {
      // Update session current_phase
      await c.env.DB.prepare(
        `UPDATE simulation_sessions SET current_phase = ? WHERE id = ?`
      )
        .bind(nextPhaseId, session.id)
        .run();

      // Record transition event
      const transitionEventId = crypto.randomUUID();
      await c.env.DB.prepare(
        `INSERT INTO simulation_events (id, session_id, event_type, event_data) VALUES (?, ?, 'observation', ?)`
      )
        .bind(
          transitionEventId,
          session.id,
          JSON.stringify({
            type: "phase_transition",
            from: currentPhase.id,
            to: nextPhaseId,
          }),
        )
        .run();

      phaseTransition = {
        from: currentPhase.id,
        to: nextPhaseId,
        new_phase: nextPhase,
      };
    }
  }

  // Get current telemetry (from active phase after potential transition)
  const activePhase = phaseTransition?.new_phase ?? currentPhase;
  const telemetry = activePhase.telemetry_snapshot;

  // Tutor observation (stub - 44.4 will implement real logic)
  const tutorObservation = observeSilently();

  return c.json({
    action_result: {
      action_id: action.id,
      category: action.category,
      label: action.label,
      diagnostic_value: action.diagnostic_value,
    },
    telemetry,
    phase_transition: phaseTransition
      ? { from: phaseTransition.from, to: phaseTransition.to }
      : undefined,
    tutor_observation: tutorObservation,
    available_actions: activePhase.available_actions,
  });
});

/* POST /api/simulation/ask-agent */
simulation.post("/ask-agent", async (c) => {
  let body: { session_id: string; message: string };
  try {
    body = await c.req.json<{ session_id: string; message: string }>();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }

  if (!body.session_id || typeof body.session_id !== "string") {
    return c.json({ error: "session_id is required" }, 400);
  }
  if (!body.message || typeof body.message !== "string" || !body.message.trim()) {
    return c.json({ error: "message is required" }, 400);
  }

  // Load session
  const session = await c.env.DB.prepare(
    `SELECT id, learner_id, scenario_id, profile, status, current_phase FROM simulation_sessions WHERE id = ?`
  )
    .bind(body.session_id)
    .first<{ id: string; learner_id: string; scenario_id: string; profile: string; status: string; current_phase: string }>();

  if (!session) {
    return c.json({ error: "Session not found" }, 404);
  }

  if (session.status !== "active") {
    return c.json({ error: "Session is not active" }, 409);
  }

  const scenario = getScenario(session.scenario_id);
  if (!scenario) {
    return c.json({ error: "Scenario no longer available" }, 500);
  }

  if (!scenario.ai_agent_behavior) {
    return c.json({ error: "This scenario does not have an AI agent" }, 400);
  }

  // Build agent system prompt - use scenario-specific prompt when available
  const agentConfig = scenario.ai_agent_behavior;
  let systemPrompt: string;
  if (agentConfig.agent_system_prompt) {
    systemPrompt = agentConfig.agent_system_prompt;
  } else {
    const fallbackPrompt = await getPrompt(c.env.DB, "simulation.agent_fallback");
    systemPrompt = resolveTemplate(fallbackPrompt.content, {
      personality: agentConfig.personality,
      behavior: agentConfig.behavior,
      knowledge_gaps: agentConfig.knowledge_gaps.length > 0
        ? `You have knowledge gaps in: ${agentConfig.knowledge_gaps.join(", ")}. When asked about these topics, respond according to your behavior mode.`
        : "",
      current_phase: session.current_phase,
      scenario_title: scenario.title,
    });
  }

  // Call Gemini
  try {
    const model = c.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
    const url = `${GEMINI_API_URL}/${model}:generateContent?key=${c.env.GEMINI_API_KEY}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: body.message }] }],
        generationConfig: {
          temperature: AGENT_TEMPERATURE,
          maxOutputTokens: AGENT_MAX_TOKENS,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Gemini ${response.status}`);
    }

    const data = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };

    const agentReply =
      data.candidates?.[0]?.content?.parts?.[0]?.text ?? "I'm not sure how to help with that.";

    // Record agent query event
    const eventId = crypto.randomUUID();
    await c.env.DB.prepare(
      `INSERT INTO simulation_events (id, session_id, event_type, event_data) VALUES (?, ?, 'agent_query', ?)`
    )
      .bind(eventId, session.id, JSON.stringify({ message: body.message, response: agentReply }))
      .run();

    return c.json({ response: agentReply });
  } catch {
    return c.json({ error: "AI agent unavailable" }, 502);
  }
});

/* POST /api/simulation/debrief */
simulation.post("/debrief", async (c) => {
  let body: { session_id: string };
  try {
    body = await c.req.json<{ session_id: string }>();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }

  if (!body.session_id || typeof body.session_id !== "string") {
    return c.json({ error: "session_id is required" }, 400);
  }

  // Load session
  const session = await c.env.DB.prepare(
    `SELECT id, learner_id, scenario_id, profile, status, current_phase, started_at, completed_at, debrief_json FROM simulation_sessions WHERE id = ?`
  )
    .bind(body.session_id)
    .first<SimulationSession & { debrief_json?: string }>();

  if (!session) {
    return c.json({ error: "Session not found" }, 404);
  }

  // If debrief already exists, return it
  if (session.debrief_json) {
    const debrief = JSON.parse(session.debrief_json) as SimulationDebrief;
    return c.json({ debrief, session });
  }

  const scenario = getScenario(session.scenario_id);
  if (!scenario) {
    return c.json({ error: "Scenario no longer available" }, 500);
  }

  // Load all events for this session
  const eventsResult = await c.env.DB.prepare(
    `SELECT id, session_id, event_type, event_data, created_at FROM simulation_events WHERE session_id = ? ORDER BY created_at ASC`
  )
    .bind(session.id)
    .all<{ id: string; session_id: string; event_type: string; event_data: string; created_at: string }>();

  const events: SimulationEvent[] = (eventsResult.results ?? []).map((row) => ({
    id: row.id,
    session_id: row.session_id,
    event_type: row.event_type as SimulationEvent["event_type"],
    event_data: JSON.parse(row.event_data),
    created_at: row.created_at,
  }));

  // Look up prior completed sessions for progression data
  const priorResult = await c.env.DB.prepare(
    `SELECT id, completed_at, debrief_json FROM simulation_sessions
     WHERE learner_id = ? AND scenario_id = ? AND status = 'completed' AND id != ?
     ORDER BY completed_at DESC`
  )
    .bind(session.learner_id, session.scenario_id, session.id)
    .all<{ id: string; completed_at: string; debrief_json: string }>();

  const priorSessions: PriorSessionSummary[] = (priorResult.results ?? [])
    .filter((row) => row.debrief_json)
    .map((row) => ({
      session_id: row.id,
      completed_at: row.completed_at,
      debrief: JSON.parse(row.debrief_json) as SimulationDebrief,
    }));

  // Generate debrief via Gemini (falls back to minimal debrief on failure)
  const debrief = await generateDebrief(
    c.env,
    session,
    events,
    scenario,
    priorSessions.length > 0 ? priorSessions : undefined,
  );

  // Mark session completed and store debrief
  const now = new Date().toISOString();
  await c.env.DB.prepare(
    `UPDATE simulation_sessions SET status = 'completed', completed_at = ?, debrief_json = ? WHERE id = ?`
  )
    .bind(now, JSON.stringify(debrief), session.id)
    .run();

  return c.json({
    debrief,
    session: { ...session, status: "completed" as const, completed_at: now },
  });
});

/* GET /api/simulation/session/:id */
simulation.get("/session/:id", async (c) => {
  const sessionId = c.req.param("id");

  const session = await c.env.DB.prepare(
    `SELECT id, learner_id, scenario_id, profile, status, current_phase, started_at, completed_at, debrief_json FROM simulation_sessions WHERE id = ?`
  )
    .bind(sessionId)
    .first<SimulationSession & { debrief_json?: string }>();

  if (!session) {
    return c.json({ error: "Session not found" }, 404);
  }

  // Load all events
  const eventsResult = await c.env.DB.prepare(
    `SELECT id, session_id, event_type, event_data, created_at FROM simulation_events WHERE session_id = ? ORDER BY created_at ASC`
  )
    .bind(sessionId)
    .all<{ id: string; session_id: string; event_type: string; event_data: string; created_at: string }>();

  const events: SimulationEvent[] = (eventsResult.results ?? []).map((row) => ({
    id: row.id,
    session_id: row.session_id,
    event_type: row.event_type as SimulationEvent["event_type"],
    event_data: JSON.parse(row.event_data),
    created_at: row.created_at,
  }));

  // Reconstruct current state
  const scenario = getScenario(session.scenario_id);
  const currentPhase = scenario
    ? findPhase(scenario, session.current_phase)
    : undefined;

  const debrief = session.debrief_json
    ? (JSON.parse(session.debrief_json) as SimulationDebrief)
    : undefined;

  return c.json({
    session: {
      id: session.id,
      learner_id: session.learner_id,
      scenario_id: session.scenario_id,
      profile: session.profile,
      status: session.status,
      current_phase: session.current_phase,
      started_at: session.started_at,
      completed_at: session.completed_at,
    },
    events,
    current_phase: currentPhase,
    available_actions: currentPhase?.available_actions ?? [],
    debrief,
  });
});
