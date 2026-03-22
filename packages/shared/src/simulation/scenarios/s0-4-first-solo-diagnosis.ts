import type {
  SimulationScenario,
  SimulationPhase,
  SimulationAction,
  LogEntry,
  MetricDataPoint,
} from "../types";

/* ---- Constants ---- */

const SCENARIO_ID = "S0.4";
const SCENARIO_TITLE = "First Solo Diagnosis";
const DEPLOYMENT_VERSION = "v2.4.1";
const DEPLOYMENT_OFFSET_MINUTES = 30;

/* ---- Metric thresholds ---- */

const ERROR_RATE_THRESHOLD_PERCENT = 5;
const RESPONSE_TIME_THRESHOLD_MS = 500;
const MEMORY_THRESHOLD_PERCENT = 80;
const CPU_THRESHOLD_PERCENT = 70;

/* ---- Critical metric values ---- */

const CRITICAL_ERROR_RATE_PERCENT = 45;
const CRITICAL_RESPONSE_TIME_MS = 8000;
const CRITICAL_MEMORY_PERCENT = 95;
const NORMAL_CPU_PERCENT = 40;

/* ---- Normal metric values (post-resolution) ---- */

const NORMAL_ERROR_RATE_PERCENT = 0.2;
const NORMAL_RESPONSE_TIME_MS = 120;
const NORMAL_MEMORY_PERCENT = 45;

/* ---- Intervention thresholds ---- */

const STALL_SECONDS = 60;
const WRONG_DIRECTION_COUNT = 2;
const FIXATION_LOOP_COUNT = 3;

/* ---- Timestamp helpers ---- */

function minutesAgo(base: string, minutes: number): string {
  const d = new Date(base);
  d.setMinutes(d.getMinutes() - minutes);
  return d.toISOString();
}

/**
 * Build a base timestamp for log entries. The scenario uses relative
 * timestamps so that logs tell a coherent story regardless of when the
 * simulation is loaded.
 */
const BASE_TIME = "2026-01-15T14:30:00.000Z";

/* ---- Shared metrics ---- */

const criticalMetrics: MetricDataPoint[] = [
  {
    name: "HTTP 500 Error Rate",
    value: CRITICAL_ERROR_RATE_PERCENT,
    unit: "%",
    threshold: ERROR_RATE_THRESHOLD_PERCENT,
    status: "critical",
  },
  {
    name: "Response Time p99",
    value: CRITICAL_RESPONSE_TIME_MS,
    unit: "ms",
    threshold: RESPONSE_TIME_THRESHOLD_MS,
    status: "critical",
  },
  {
    name: "Memory Usage",
    value: CRITICAL_MEMORY_PERCENT,
    unit: "%",
    threshold: MEMORY_THRESHOLD_PERCENT,
    status: "critical",
  },
  {
    name: "CPU Usage",
    value: NORMAL_CPU_PERCENT,
    unit: "%",
    threshold: CPU_THRESHOLD_PERCENT,
    status: "normal",
  },
];

const normalMetrics: MetricDataPoint[] = [
  {
    name: "HTTP 500 Error Rate",
    value: NORMAL_ERROR_RATE_PERCENT,
    unit: "%",
    threshold: ERROR_RATE_THRESHOLD_PERCENT,
    status: "normal",
  },
  {
    name: "Response Time p99",
    value: NORMAL_RESPONSE_TIME_MS,
    unit: "ms",
    threshold: RESPONSE_TIME_THRESHOLD_MS,
    status: "normal",
  },
  {
    name: "Memory Usage",
    value: NORMAL_MEMORY_PERCENT,
    unit: "%",
    threshold: MEMORY_THRESHOLD_PERCENT,
    status: "normal",
  },
  {
    name: "CPU Usage",
    value: NORMAL_CPU_PERCENT,
    unit: "%",
    threshold: CPU_THRESHOLD_PERCENT,
    status: "normal",
  },
];

/* ---- Shared log entries ---- */

const baseLogs: LogEntry[] = [
  {
    timestamp: minutesAgo(BASE_TIME, 2),
    level: "error",
    service: "web-app",
    message: "java.lang.OutOfMemoryError: Java heap space",
  },
  {
    timestamp: minutesAgo(BASE_TIME, 3),
    level: "error",
    service: "web-app",
    message: "Application health check failed",
  },
  {
    timestamp: minutesAgo(BASE_TIME, 5),
    level: "warn",
    service: "web-app",
    message: "Memory usage exceeding threshold",
  },
  {
    timestamp: minutesAgo(BASE_TIME, DEPLOYMENT_OFFSET_MINUTES),
    level: "info",
    service: "deploy-pipeline",
    message: `Deployment ${DEPLOYMENT_VERSION} completed successfully ${DEPLOYMENT_OFFSET_MINUTES} minutes ago`,
  },
];

const phase2AdditionalLogs: LogEntry[] = [
  {
    timestamp: minutesAgo(BASE_TIME, 1),
    level: "error",
    service: "web-app",
    message: "java.lang.OutOfMemoryError: Java heap space - request handler /api/reports",
  },
  {
    timestamp: minutesAgo(BASE_TIME, 4),
    level: "warn",
    service: "web-app",
    message: `Memory trend: steady increase since deployment ${DEPLOYMENT_VERSION}`,
  },
  {
    timestamp: minutesAgo(BASE_TIME, 6),
    level: "error",
    service: "web-app",
    message: "GC overhead limit exceeded - heap utilization at 97%",
  },
];

const restartLogs: LogEntry[] = [
  {
    timestamp: minutesAgo(BASE_TIME, 0),
    level: "error",
    service: "web-app",
    message: "java.lang.OutOfMemoryError: Java heap space - errors have returned after restart",
  },
  {
    timestamp: minutesAgo(BASE_TIME, 1),
    level: "warn",
    service: "web-app",
    message: "Memory usage climbing rapidly after service restart",
  },
];

const recoveryLogs: LogEntry[] = [
  {
    timestamp: BASE_TIME,
    level: "info",
    service: "web-app",
    message: "Service recovering - error rates dropping",
  },
  {
    timestamp: minutesAgo(BASE_TIME, -1),
    level: "info",
    service: "web-app",
    message: "Memory usage stabilized at normal levels",
  },
  {
    timestamp: minutesAgo(BASE_TIME, -2),
    level: "info",
    service: "deploy-pipeline",
    message: `Rollback to previous version complete - ${DEPLOYMENT_VERSION} reverted`,
  },
];

/* ---- Shared actions ---- */

const baseObservationActions: SimulationAction[] = [
  {
    id: "check-logs",
    category: "observe",
    label: "Check application logs",
    description: "Review recent application log entries for errors, warnings, and patterns.",
    diagnostic_value: "high",
  },
  {
    id: "check-errors",
    category: "observe",
    label: "View detailed error breakdown",
    description: "Examine the error distribution by type, endpoint, and frequency.",
    diagnostic_value: "medium",
  },
  {
    id: "check-memory",
    category: "observe",
    label: "Check memory usage trend",
    description: "Review memory consumption over time to identify leaks or spikes.",
    diagnostic_value: "medium",
  },
  {
    id: "check-deployments",
    category: "observe",
    label: "Check recent deployments",
    description: "Review the deployment history for recent changes that may correlate with issues.",
    diagnostic_value: "high",
  },
];

const restartAction: SimulationAction = {
  id: "restart-service",
  category: "act",
  label: "Restart the service",
  description: "Perform a rolling restart of the web application service.",
  diagnostic_value: "low",
  phase_trigger: "restart-without-diagnosis",
};

const escalateAction: SimulationAction = {
  id: "escalate",
  category: "communicate",
  label: "Escalate to senior engineer",
  description: "Page the on-call senior engineer for assistance with the incident.",
  diagnostic_value: "low",
};

const rollbackAction: SimulationAction = {
  id: "rollback-deployment",
  category: "act",
  label: "Roll back recent deployment",
  description: `Revert the application to the version prior to ${DEPLOYMENT_VERSION}.`,
  diagnostic_value: "high",
  phase_trigger: "correct-fix",
};

const increaseMemoryAction: SimulationAction = {
  id: "increase-memory",
  category: "act",
  label: "Increase memory allocation",
  description: "Increase the JVM heap size and container memory limits.",
  diagnostic_value: "medium",
  phase_trigger: "correct-fix",
};

/* ---- Phases ---- */

const phase1AlertReceived: SimulationPhase = {
  id: "alert-received",
  narrative:
    "Alert fired: users reporting HTTP errors. The monitoring dashboard shows multiple red indicators.",
  telemetry_snapshot: {
    metrics: criticalMetrics,
    logs: baseLogs,
    dashboard_state: "alarm",
  },
  available_actions: [
    ...baseObservationActions,
    restartAction,
    escalateAction,
  ],
  triggers: [
    {
      id: "phase-2-ready",
      condition: "2+ observation actions taken",
      target_phase: "root-cause-identified",
    },
    {
      id: "restart-without-diagnosis",
      condition: "restart-service action taken before sufficient observation",
      target_phase: "service-restarted",
    },
  ],
};

const phase2RootCauseIdentified: SimulationPhase = {
  id: "root-cause-identified",
  narrative:
    "Your investigation reveals a pattern. The errors began 30 minutes ago, coinciding with a deployment.",
  telemetry_snapshot: {
    metrics: criticalMetrics,
    logs: [...baseLogs, ...phase2AdditionalLogs],
    dashboard_state: "alarm",
  },
  available_actions: [
    ...baseObservationActions,
    restartAction,
    escalateAction,
    rollbackAction,
    increaseMemoryAction,
  ],
  triggers: [
    {
      id: "correct-fix",
      condition: "rollback-deployment or increase-memory action taken",
      target_phase: "resolved",
    },
  ],
};

const phase3ServiceRestarted: SimulationPhase = {
  id: "service-restarted",
  narrative:
    "The service restarts and runs normally for a few minutes, then errors return. The memory leak from the recent deployment has not been addressed.",
  telemetry_snapshot: {
    metrics: criticalMetrics,
    logs: [...baseLogs, ...restartLogs],
    dashboard_state: "alarm",
  },
  available_actions: [
    ...baseObservationActions,
    // restart-service intentionally omitted - already tried
    escalateAction,
  ],
  triggers: [
    {
      id: "phase-2-ready",
      condition: "2+ observation actions taken",
      target_phase: "root-cause-identified",
    },
  ],
};

const phase4Resolved: SimulationPhase = {
  id: "resolved",
  narrative:
    "The fix has been applied. Error rates are dropping and memory usage is returning to normal levels.",
  telemetry_snapshot: {
    metrics: normalMetrics,
    logs: recoveryLogs,
    dashboard_state: "normal",
  },
  available_actions: [],
  triggers: [],
};

/* ---- Tutor context ---- */

const COACHING_PROMPT = [
  "Primary teaching goal: OBSERVE BEFORE ACT",
  "",
  "This is a Level 0 trainee's first solo diagnosis. Use simple, encouraging language.",
  "",
  "Key observation rules:",
  "- If trainee's FIRST action is a remediation (restart-service, escalate): use gentle_nudge",
  '  Example: "You jumped to a fix before understanding the problem. What does the dashboard tell you about what is happening?"',
  "- If trainee's FIRST action is an observation (check-logs, check-errors, check-memory, check-deployments): use highlight_good_judgment",
  '  Example: "Good instinct - looking at the data before taking action. What do you see?"',
  "- If trainee has taken no action for 60+ seconds: use direct_intervention",
  '  Example: "The dashboard is showing you something important. Look at the error rate and memory usage - what stands out?"',
  "- At decision point between fixes (rollback vs increase-memory vs restart): use accountability_moment",
  '  Example: "You have a choice to make. What evidence supports your decision?"',
  "- If trainee is progressing well through observations: use observe_silently",
  "- Do NOT reveal the root cause. Guide them to find it.",
  "- Do NOT criticize wrong actions. Frame everything as learning.",
].join("\n");

const DEBRIEF_PROMPT = [
  "Focus the debrief on the observe-before-act habit:",
  "- Did they look at telemetry before attempting a fix?",
  "- Did they form a hypothesis (even implicit) before acting?",
  "- Compare their action sequence to expert path: check metrics -> check logs -> check deployments -> roll back",
  "- If they restarted first: frame as a learning moment, not a failure",
  '  Example: "You tried restarting first, which is a natural instinct. The restart worked temporarily, but the problem returned because the root cause was still there. Next time, investigating first will help you find a lasting fix."',
  "- Highlight what they did well, even if the overall path was suboptimal",
  "- For accountability_assessment: they are learning - be generous but honest",
].join("\n");

/* ---- Scenario ---- */

export const s04FirstSoloDiagnosis: SimulationScenario = {
  id: SCENARIO_ID,
  title: SCENARIO_TITLE,
  level: "level-0",
  tier: "introductory",
  prerequisite_scenarios: [],
  prerequisite_concepts: [],
  briefing:
    "You are on call for a single web application. Users are reporting errors. Your monitoring dashboard is showing alerts. Investigate and resolve the issue.",
  phases: [
    phase1AlertReceived,
    phase2RootCauseIdentified,
    phase3ServiceRestarted,
    phase4Resolved,
  ],
  root_causes: [
    {
      id: "oom-from-deploy",
      description: `Recent deployment ${DEPLOYMENT_VERSION} introduced a memory leak causing OutOfMemoryError`,
    },
  ],
  intervention_thresholds: {
    stall_seconds: STALL_SECONDS,
    wrong_direction_count: WRONG_DIRECTION_COUNT,
    fixation_loop_count: FIXATION_LOOP_COUNT,
  },
  tutor_context: {
    coaching_prompt: COACHING_PROMPT,
    debrief_prompt: DEBRIEF_PROMPT,
  },
};
