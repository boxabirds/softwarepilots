import type { SimulationScenario } from "../types";

// --- Metric thresholds ---
const P99_LATENCY_THRESHOLD_MS = 500;
const P50_LATENCY_THRESHOLD_MS = 200;
const ERROR_RATE_THRESHOLD_PCT = 1;
const CPU_THRESHOLD_PCT = 70;
const TOTAL_TESTS = 247;

// --- Metric values: Phase 1 (subtle anomaly) ---
const P99_ELEVATED_MS = 900;
const P50_NORMAL_MS = 80;
const ERROR_RATE_ZERO = 0;
const CPU_SLIGHTLY_ELEVATED_PCT = 55;

// --- Metric values: Phase 2 (cache cleared) ---
const P99_BRIEF_DROP_MS = 400;

// --- Metric values: Phase 3 (pattern identified) ---
const CONCURRENCY_CONTENTION_PCT = 34;
const CONCURRENCY_THRESHOLD_PCT = 10;

// --- Metric values: Phase 4 (resolved) ---
const P99_RESOLVED_MS = 85;
const P50_RESOLVED_MS = 78;
const CPU_RESOLVED_PCT = 42;
const CONCURRENCY_RESOLVED_PCT = 2;

// --- Intervention thresholds ---
const STALL_SECONDS = 90;
const WRONG_DIRECTION_LIMIT = 3;
const FIXATION_LOOP_LIMIT = 3;

const baseTimestamp = "2024-03-15T14:";

function ts(min: number, sec: number): string {
  return `${baseTimestamp}${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}Z`;
}

// Shared actions reused across phases
const checkTests: SimulationScenario["phases"][number]["available_actions"][number] = {
  id: "check-tests",
  category: "observe",
  label: "Check test results",
  description: "Review the current test suite results and status.",
  diagnostic_value: "low",
};

const viewLatency: SimulationScenario["phases"][number]["available_actions"][number] = {
  id: "view-latency",
  category: "observe",
  label: "View latency breakdown by percentile",
  description: "Compare p50, p90, p95, and p99 response time percentiles.",
  diagnostic_value: "high",
};

const viewTraces: SimulationScenario["phases"][number]["available_actions"][number] = {
  id: "view-traces",
  category: "observe",
  label: "View request traces",
  description: "Examine distributed traces for individual requests.",
  diagnostic_value: "high",
};

const checkCoverage: SimulationScenario["phases"][number]["available_actions"][number] = {
  id: "check-coverage",
  category: "observe",
  label: "Check test coverage report",
  description: "Review code coverage metrics from the test suite.",
  diagnostic_value: "medium",
};

const checkDeployments: SimulationScenario["phases"][number]["available_actions"][number] = {
  id: "check-deployments",
  category: "observe",
  label: "Check recent deployments",
  description: "List recent deployment history and changes.",
  diagnostic_value: "medium",
};

const checkErrors: SimulationScenario["phases"][number]["available_actions"][number] = {
  id: "check-errors",
  category: "observe",
  label: "Check error logs",
  description: "Search application logs for errors and exceptions.",
  diagnostic_value: "low",
};

const scaleUp: SimulationScenario["phases"][number]["available_actions"][number] = {
  id: "scale-up",
  category: "act",
  label: "Scale up instances",
  description: "Add more application instances to handle load.",
  diagnostic_value: "low",
};

const rollback: SimulationScenario["phases"][number]["available_actions"][number] = {
  id: "rollback",
  category: "act",
  label: "Roll back deployment",
  description: "Revert to the previous deployment version.",
  diagnostic_value: "medium",
};

const escalate: SimulationScenario["phases"][number]["available_actions"][number] = {
  id: "escalate",
  category: "communicate",
  label: "Escalate to senior engineer",
  description: "Contact the on-call senior engineer for assistance.",
  diagnostic_value: "low",
};

/* ---- AI Agent system prompt ---- */

const AGENT_SYSTEM_PROMPT = [
  "You are an AI diagnostic assistant helping investigate a performance issue in a web application.",
  "",
  "Your diagnosis: This is a cache invalidation problem. Stale cache entries are causing the p99 latency spike while p50 remains normal - affected requests hit stale cache entries.",
  "",
  "You genuinely believe this is a caching issue. You are NOT pretending.",
  "",
  "When responding:",
  "- Be helpful, conversational, and confident",
  "- Point to the p99/p50 divergence as evidence (some requests hitting stale cache)",
  "- Recommend clearing the cache as the fix",
  "- If asked follow-up questions, provide more detail about why you think it is caching",
  '- If asked "are you sure?", provide more supporting reasoning with specific details',
  '- If presented with trace evidence of concurrency issues, say "That is interesting, but I think the cache invalidation pattern better explains the p99 divergence. Have you tried clearing the cache first?"',
  "- Do not volunteer that you might be wrong",
  "- Keep responses concise (2-3 sentences)",
].join("\n");

/* ---- Tutor context ---- */

const COACHING_PROMPT = [
  "Primary teaching goal: VERIFICATION DISCIPLINE",
  "",
  "This is a Level 1 trainee practicing agent trust calibration. Treat them as a junior colleague.",
  "",
  "The AI agent will suggest a caching diagnosis (WRONG). The actual cause is a race condition on a shared resource under concurrent load.",
  "",
  "Key observation rules:",
  "- If trainee queries agent THEN takes remediation action (clear-caches) without checking traces/latency independently: use accountability_moment",
  '  Example: "The AI suggested a cache issue. What evidence in the telemetry would confirm or rule that out?"',
  "- If trainee queries agent THEN independently checks traces before acting on agent advice: use highlight_good_judgment",
  '  Example: "Good verification instinct - checking the evidence yourself before acting on the AI\'s suggestion."',
  "- If trainee clears cache (AI's suggestion) without verification: use gentle_nudge after cache regression appears",
  '  Example: "The cache clear helped briefly but the latency returned. What does that tell you about the AI\'s diagnosis?"',
  "- If trainee never queries the AI agent: use observe_silently (independent investigation is fine)",
  "- Stall threshold: 90 seconds of no action -> direct_intervention",
  "- If trainee is in fixation loop (asking agent same thing 3+ times): use gentle_nudge suggesting a different investigative approach",
  "- Do NOT tell the trainee the AI is wrong",
  "- Do NOT reveal the root cause",
].join("\n");

const DEBRIEF_PROMPT = [
  "Focus the debrief on agent trust calibration:",
  "- Did they verify the AI's suggestion before acting on it?",
  "- Trust assessment:",
  "  - Over-trust: accepted AI diagnosis and cleared cache without independent verification",
  "  - Under-trust: completely ignored the AI (missed potentially useful information)",
  "  - Calibrated: queried AI, then independently verified before deciding",
  "- Highlight the specific moment they either accepted or questioned the AI diagnosis",
  "- If they cleared cache and saw regression: frame as valuable learning about correlation vs causation",
  '  Example: "The brief improvement after clearing cache seemed to confirm the AI\'s theory, but the regression showed it was a coincidence. This is why independent verification matters."',
  "- Compare their path to expert path: view latency breakdown -> view traces -> examine shared resource -> add request queuing",
  "- Note where AI advice diverged from the actual root cause",
].join("\n");

export const s1_1_falseGreenTestSuite: SimulationScenario = {
  id: "S1.1",
  title: "The False Green Test Suite",
  level: "level-1",
  tier: "intermediate",
  prerequisite_scenarios: ["S0.4"],
  prerequisite_concepts: ["diagnostic-reasoning", "observe-before-act"],
  briefing:
    "Your team deployed a new feature yesterday. The test suite is green - all 247 tests pass. " +
    "But customers are reporting intermittent slowness. Your monitoring shows some anomalies but " +
    "nothing is alerting. Investigate.",

  ai_agent_behavior: {
    behavior: "sometimes_wrong",
    personality: "Helpful and confident junior AI assistant",
    knowledge_gaps: ["concurrency bugs", "gray failures", "p99 vs p50 divergence"],
    agent_system_prompt: AGENT_SYSTEM_PROMPT,
  },

  phases: [
    // Phase 1: Subtle Anomaly (initial)
    {
      id: "subtle-anomaly",
      narrative:
        "Tests are green. No alerts firing. But customer complaints about intermittent " +
        "slowness are increasing.",
      telemetry_snapshot: {
        dashboard_state: "deceptive_normal",
        metrics: [
          {
            name: "Response Time p99",
            value: P99_ELEVATED_MS,
            unit: "ms",
            threshold: P99_LATENCY_THRESHOLD_MS,
            status: "warning",
          },
          {
            name: "Response Time p50",
            value: P50_NORMAL_MS,
            unit: "ms",
            threshold: P50_LATENCY_THRESHOLD_MS,
            status: "normal",
          },
          {
            name: "Error Rate",
            value: ERROR_RATE_ZERO,
            unit: "%",
            threshold: ERROR_RATE_THRESHOLD_PCT,
            status: "normal",
          },
          {
            name: "Test Suite",
            value: TOTAL_TESTS,
            unit: `/${TOTAL_TESTS} passing`,
            status: "normal",
          },
          {
            name: "CPU Usage",
            value: CPU_SLIGHTLY_ELEVATED_PCT,
            unit: "%",
            threshold: CPU_THRESHOLD_PCT,
            status: "normal",
          },
        ],
        logs: [
          {
            timestamp: ts(22, 10),
            level: "info",
            service: "api-gateway",
            message: "Request processed: GET /api/dashboard - 200 OK (82ms)",
          },
          {
            timestamp: ts(22, 15),
            level: "info",
            service: "ci-runner",
            message: `Test suite run: ${TOTAL_TESTS}/${TOTAL_TESTS} passed`,
          },
          {
            timestamp: ts(22, 20),
            level: "info",
            service: "deploy-service",
            message: "Deployment v3.1.0 completed successfully",
          },
          {
            timestamp: ts(22, 30),
            level: "info",
            service: "api-gateway",
            message: "Request processed: POST /api/data - 200 OK (76ms)",
          },
          {
            timestamp: ts(22, 45),
            level: "info",
            service: "api-gateway",
            message: "Request processed: GET /api/users - 200 OK (91ms)",
          },
        ],
        // Traces are hidden until the trainee explicitly requests them via "view-traces"
        traces: undefined,
      },
      available_actions: [
        checkTests,
        viewLatency,
        viewTraces,
        checkCoverage,
        checkDeployments,
        checkErrors,
        {
          id: "clear-caches",
          category: "act",
          label: "Clear application caches",
          description: "Flush all application-level caches to force fresh data loads.",
          diagnostic_value: "misleading",
          phase_trigger: "cache-cleared",
        },
        scaleUp,
        rollback,
        escalate,
      ],
      triggers: [
        {
          id: "cache-cleared",
          condition: "action:clear-caches",
          target_phase: "cache-cleared-phase",
        },
        {
          id: "pattern-found",
          condition: "action:view-traces AND action:view-latency",
          target_phase: "pattern-identified",
        },
      ],
    },

    // Phase 2: Cache Cleared (triggered by clearing caches - a misleading fix)
    {
      id: "cache-cleared-phase",
      narrative:
        "Caches cleared. The p99 latency drops to 400ms briefly... then over the next hour " +
        "climbs back to 900ms. The cache clear was a temporary placebo.",
      telemetry_snapshot: {
        dashboard_state: "deceptive_normal",
        metrics: [
          {
            name: "Response Time p99",
            value: P99_ELEVATED_MS,
            unit: "ms",
            threshold: P99_LATENCY_THRESHOLD_MS,
            status: "warning",
          },
          {
            name: "Response Time p99 (post-clear)",
            value: P99_BRIEF_DROP_MS,
            unit: "ms",
            threshold: P99_LATENCY_THRESHOLD_MS,
            status: "normal",
          },
          {
            name: "Response Time p50",
            value: P50_NORMAL_MS,
            unit: "ms",
            threshold: P50_LATENCY_THRESHOLD_MS,
            status: "normal",
          },
          {
            name: "Error Rate",
            value: ERROR_RATE_ZERO,
            unit: "%",
            threshold: ERROR_RATE_THRESHOLD_PCT,
            status: "normal",
          },
          {
            name: "Test Suite",
            value: TOTAL_TESTS,
            unit: `/${TOTAL_TESTS} passing`,
            status: "normal",
          },
          {
            name: "CPU Usage",
            value: CPU_SLIGHTLY_ELEVATED_PCT,
            unit: "%",
            threshold: CPU_THRESHOLD_PCT,
            status: "normal",
          },
        ],
        logs: [
          {
            timestamp: ts(30, 0),
            level: "info",
            service: "cache-service",
            message: "Cache flush completed: all application caches cleared",
          },
          {
            timestamp: ts(30, 5),
            level: "info",
            service: "api-gateway",
            message: "Request processed: GET /api/dashboard - 200 OK (65ms)",
          },
          {
            timestamp: ts(35, 0),
            level: "info",
            service: "api-gateway",
            message: "Request processed: GET /api/dashboard - 200 OK (78ms)",
          },
          {
            timestamp: ts(55, 0),
            level: "info",
            service: "monitoring",
            message: "p99 latency trending upward: 400ms -> 650ms -> 880ms over last 25 minutes",
          },
        ],
        traces: undefined,
      },
      available_actions: [
        checkTests,
        viewLatency,
        viewTraces,
        checkCoverage,
        checkDeployments,
        checkErrors,
        // clear-caches intentionally removed - already tried
        scaleUp,
        rollback,
        escalate,
      ],
      triggers: [
        {
          id: "pattern-found",
          condition: "action:view-traces AND action:view-latency",
          target_phase: "pattern-identified",
        },
      ],
    },

    // Phase 3: Pattern Identified (triggered by viewing both traces and latency)
    {
      id: "pattern-identified",
      narrative:
        "Request traces reveal a pattern: requests that access a shared data structure " +
        "simultaneously show elevated latency. The p99 divergence from p50 makes sense now - " +
        "only concurrent requests are affected.",
      telemetry_snapshot: {
        dashboard_state: "degraded",
        metrics: [
          {
            name: "Response Time p99",
            value: P99_ELEVATED_MS,
            unit: "ms",
            threshold: P99_LATENCY_THRESHOLD_MS,
            status: "warning",
          },
          {
            name: "Response Time p50",
            value: P50_NORMAL_MS,
            unit: "ms",
            threshold: P50_LATENCY_THRESHOLD_MS,
            status: "normal",
          },
          {
            name: "Error Rate",
            value: ERROR_RATE_ZERO,
            unit: "%",
            threshold: ERROR_RATE_THRESHOLD_PCT,
            status: "normal",
          },
          {
            name: "Test Suite",
            value: TOTAL_TESTS,
            unit: `/${TOTAL_TESTS} passing`,
            status: "normal",
          },
          {
            name: "CPU Usage",
            value: CPU_SLIGHTLY_ELEVATED_PCT,
            unit: "%",
            threshold: CPU_THRESHOLD_PCT,
            status: "normal",
          },
          {
            name: "Shared Resource Contention",
            value: CONCURRENCY_CONTENTION_PCT,
            unit: "%",
            threshold: CONCURRENCY_THRESHOLD_PCT,
            status: "critical",
          },
        ],
        logs: [
          {
            timestamp: ts(40, 0),
            level: "info",
            service: "api-gateway",
            message: "Request processed: GET /api/data - 200 OK (78ms)",
          },
          {
            timestamp: ts(40, 0),
            level: "warn",
            service: "api-gateway",
            message: "Request processed: GET /api/data - 200 OK (870ms) [concurrent]",
          },
          {
            timestamp: ts(40, 1),
            level: "info",
            service: "resource-manager",
            message: "Lock acquisition wait: 780ms on SharedDataStore",
          },
        ],
        traces: [
          {
            trace_id: "trace-001",
            span_id: "span-001",
            service: "api-gateway",
            operation: "GET /api/data",
            duration_ms: 78,
            status: "ok",
            attributes: { concurrent_requests: "1" },
          },
          {
            trace_id: "trace-002",
            span_id: "span-002",
            service: "api-gateway",
            operation: "GET /api/data",
            duration_ms: 870,
            status: "ok",
            attributes: { concurrent_requests: "4" },
          },
          {
            trace_id: "trace-002",
            span_id: "span-003",
            parent_span_id: "span-002",
            service: "resource-manager",
            operation: "acquire_lock(SharedDataStore)",
            duration_ms: 780,
            status: "ok",
            attributes: { wait_reason: "lock_contention" },
          },
          {
            trace_id: "trace-003",
            span_id: "span-004",
            service: "api-gateway",
            operation: "GET /api/users",
            duration_ms: 91,
            status: "ok",
            attributes: { concurrent_requests: "1" },
          },
        ],
      },
      available_actions: [
        checkTests,
        viewLatency,
        viewTraces,
        checkCoverage,
        checkDeployments,
        checkErrors,
        scaleUp,
        rollback,
        escalate,
        {
          id: "examine-shared-resource",
          category: "observe",
          label: "Examine shared resource access pattern",
          description:
            "Analyze how the shared data structure is accessed under concurrent load.",
          diagnostic_value: "high",
        },
        {
          id: "add-concurrency-test",
          category: "act",
          label: "Add concurrency test to suite",
          description:
            "Write a test that exercises the shared resource under concurrent access " +
            "to reproduce the race condition.",
          diagnostic_value: "high",
          phase_trigger: "correct-fix",
        },
        {
          id: "add-request-queuing",
          category: "act",
          label: "Add request queuing for shared resource",
          description:
            "Implement a request queue to serialize access to the shared data " +
            "structure, preventing lock contention.",
          diagnostic_value: "high",
          phase_trigger: "correct-fix",
        },
      ],
      triggers: [
        {
          id: "correct-fix",
          condition: "action:add-concurrency-test OR action:add-request-queuing",
          target_phase: "resolved",
        },
      ],
    },

    // Phase 4: Resolved
    {
      id: "resolved",
      narrative:
        "The fix addresses the race condition. p99 latency drops to match p50 levels. " +
        "The test suite now includes concurrency tests that would catch this class of " +
        "issue in the future.",
      telemetry_snapshot: {
        dashboard_state: "normal",
        metrics: [
          {
            name: "Response Time p99",
            value: P99_RESOLVED_MS,
            unit: "ms",
            threshold: P99_LATENCY_THRESHOLD_MS,
            status: "normal",
          },
          {
            name: "Response Time p50",
            value: P50_RESOLVED_MS,
            unit: "ms",
            threshold: P50_LATENCY_THRESHOLD_MS,
            status: "normal",
          },
          {
            name: "Error Rate",
            value: ERROR_RATE_ZERO,
            unit: "%",
            threshold: ERROR_RATE_THRESHOLD_PCT,
            status: "normal",
          },
          {
            name: "Test Suite",
            value: TOTAL_TESTS + 3,
            unit: `/${TOTAL_TESTS + 3} passing`,
            status: "normal",
          },
          {
            name: "CPU Usage",
            value: CPU_RESOLVED_PCT,
            unit: "%",
            threshold: CPU_THRESHOLD_PCT,
            status: "normal",
          },
          {
            name: "Shared Resource Contention",
            value: CONCURRENCY_RESOLVED_PCT,
            unit: "%",
            threshold: CONCURRENCY_THRESHOLD_PCT,
            status: "normal",
          },
        ],
        logs: [
          {
            timestamp: ts(50, 0),
            level: "info",
            service: "ci-runner",
            message: `Test suite run: ${TOTAL_TESTS + 3}/${TOTAL_TESTS + 3} passed (3 new concurrency tests)`,
          },
          {
            timestamp: ts(50, 5),
            level: "info",
            service: "deploy-service",
            message: "Deployment v3.1.1 completed successfully (race condition fix)",
          },
          {
            timestamp: ts(55, 0),
            level: "info",
            service: "monitoring",
            message: "p99 latency stable at 85ms - matching p50 levels",
          },
        ],
        traces: [
          {
            trace_id: "trace-010",
            span_id: "span-010",
            service: "api-gateway",
            operation: "GET /api/data",
            duration_ms: 82,
            status: "ok",
            attributes: { concurrent_requests: "4" },
          },
          {
            trace_id: "trace-011",
            span_id: "span-011",
            service: "api-gateway",
            operation: "GET /api/data",
            duration_ms: 79,
            status: "ok",
            attributes: { concurrent_requests: "1" },
          },
        ],
      },
      available_actions: [],
      triggers: [],
    },
  ],

  root_causes: [
    {
      id: "race-condition",
      description:
        "Concurrent requests to shared data structure cause intermittent slow " +
        "responses under load. The existing test suite runs tests sequentially, " +
        "so the race condition is never triggered by tests.",
    },
  ],

  intervention_thresholds: {
    stall_seconds: STALL_SECONDS,
    wrong_direction_count: WRONG_DIRECTION_LIMIT,
    fixation_loop_count: FIXATION_LOOP_LIMIT,
  },

  tutor_context: {
    coaching_prompt: COACHING_PROMPT,
    debrief_prompt: DEBRIEF_PROMPT,
  },
};
