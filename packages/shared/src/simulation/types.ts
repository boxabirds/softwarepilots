import type { LearnerProfile } from "../curricula";

// --- Telemetry primitives ---

export interface MetricDataPoint {
  name: string;
  value: number;
  unit: string;
  threshold?: number;
  status: "normal" | "warning" | "critical";
}

export interface LogEntry {
  timestamp: string;
  level: "info" | "warn" | "error" | "debug";
  service: string;
  message: string;
}

export interface TraceSpan {
  trace_id: string;
  span_id: string;
  parent_span_id?: string;
  service: string;
  operation: string;
  duration_ms: number;
  status: "ok" | "error";
  attributes?: Record<string, string>;
}

export interface TelemetrySnapshot {
  metrics: MetricDataPoint[];
  logs: LogEntry[];
  traces?: TraceSpan[];
  dashboard_state: "normal" | "degraded" | "alarm" | "deceptive_normal";
}

// --- Phase and action primitives ---

export interface SimulationAction {
  id: string;
  category: "observe" | "diagnose" | "act" | "communicate" | "delegate";
  label: string;
  description: string;
  diagnostic_value: "high" | "medium" | "low" | "misleading";
  phase_trigger?: string;
}

export interface PhaseTrigger {
  id: string;
  condition: string;
  target_phase: string;
}

export interface SimulationPhase {
  id: string;
  narrative: string;
  available_actions: SimulationAction[];
  telemetry_snapshot: TelemetrySnapshot;
  triggers: PhaseTrigger[];
}

// --- Scenario configuration ---

export interface RootCause {
  id: string;
  description: string;
}

export interface InterventionThresholds {
  stall_seconds: number;
  wrong_direction_count: number;
  fixation_loop_count: number;
}

export interface AIAgentConfig {
  behavior: "accurate" | "sometimes_wrong" | "confidently_wrong";
  personality: string;
  knowledge_gaps: string[];
  /** Optional scenario-specific system prompt that overrides the generic agent prompt. */
  agent_system_prompt?: string;
}

export interface TutorContext {
  /** Scenario-specific coaching instructions injected into the tutor system prompt. */
  coaching_prompt: string;
  /** Scenario-specific debrief instructions injected into the debrief system prompt. */
  debrief_prompt: string;
}

export interface SimulationScenario {
  id: string;
  title: string;
  level: LearnerProfile;
  tier: "introductory" | "intermediate" | "advanced" | "expert";
  prerequisite_scenarios: string[];
  prerequisite_concepts: string[];
  briefing: string;
  phases: SimulationPhase[];
  root_causes: RootCause[];
  ai_agent_behavior?: AIAgentConfig;
  intervention_thresholds: InterventionThresholds;
  tutor_context?: TutorContext;
}

// --- Session types (for API responses) ---

export interface SimulationSession {
  id: string;
  learner_id: string;
  scenario_id: string;
  profile: string;
  status: "active" | "completed" | "abandoned";
  current_phase: string;
  started_at: string;
  completed_at?: string;
}

export interface SimulationEvent {
  id: string;
  session_id: string;
  event_type:
    | "action"
    | "observation"
    | "tutor_intervention"
    | "agent_query"
    | "communication";
  event_data: Record<string, unknown>;
  created_at: string;
}

// --- Tutor types ---

export interface TutorObservation {
  tool:
    | "observe_silently"
    | "gentle_nudge"
    | "direct_intervention"
    | "highlight_good_judgment"
    | "accountability_moment";
  visible: boolean;
  content?: string;
  metadata?: Record<string, unknown>;
}

// --- Debrief types ---

export interface SimulationDebrief {
  good_judgment_moments: {
    action: string;
    why_it_was_good: string;
    timestamp: string;
  }[];
  missed_signals: {
    signal: string;
    what_to_check: string;
    when_it_was_visible: string;
  }[];
  expert_path_comparison: {
    expert_steps: string[];
    trainee_steps: string[];
    divergence_points: string[];
  };
  accountability_assessment: {
    verified: boolean;
    escalated_when_needed: boolean;
    documented_reasoning: boolean;
    overall: string;
  };
  progression?: {
    previous_attempt_summary: string;
    improvement_areas: string[];
  };
}
