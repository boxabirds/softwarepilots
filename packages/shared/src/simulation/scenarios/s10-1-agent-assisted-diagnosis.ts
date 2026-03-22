import type {
  SimulationScenario,
  SimulationPhase,
  SimulationAction,
  LogEntry,
  MetricDataPoint,
  TraceSpan,
} from "../types";

/* ---- Constants ---- */

const SCENARIO_ID = "S10.1";
const SCENARIO_TITLE = "Agent-Assisted Diagnosis";

/* ---- Metric thresholds ---- */

const PAYMENT_LATENCY_THRESHOLD_MS = 500;
const PAYMENT_POOL_THRESHOLD_PERCENT = 80;
const PAYMENT_RETRY_THRESHOLD_PER_MIN = 100;
const PAYMENT_ERROR_THRESHOLD_PERCENT = 5;

const INVENTORY_TIMEOUT_THRESHOLD_PERCENT = 5;
const INVENTORY_POOL_THRESHOLD_PERCENT = 80;
const INVENTORY_QUEUE_THRESHOLD = 100;

const FRONTEND_ERROR_THRESHOLD_PERCENT = 5;
const FRONTEND_LATENCY_THRESHOLD_MS = 1000;

/* ---- Critical metric values ---- */

const PAYMENT_LATENCY_CRITICAL_MS = 3000;
const PAYMENT_POOL_CRITICAL_PERCENT = 98;
const PAYMENT_RETRY_CRITICAL_PER_MIN = 5000;
const PAYMENT_ERROR_CRITICAL_PERCENT = 15;

const INVENTORY_TIMEOUT_CRITICAL_PERCENT = 40;
const INVENTORY_POOL_CRITICAL_PERCENT = 95;
const INVENTORY_QUEUE_CRITICAL = 2500;

const FRONTEND_ERROR_CRITICAL_PERCENT = 25;
const FRONTEND_LATENCY_CRITICAL_MS = 5000;

/* ---- Normal metric values (post-resolution) ---- */

const PAYMENT_LATENCY_NORMAL_MS = 120;
const PAYMENT_POOL_NORMAL_PERCENT = 25;
const PAYMENT_RETRY_NORMAL_PER_MIN = 3;
const PAYMENT_ERROR_NORMAL_PERCENT = 0.1;

const INVENTORY_TIMEOUT_NORMAL_PERCENT = 0.5;
const INVENTORY_POOL_NORMAL_PERCENT = 20;
const INVENTORY_QUEUE_NORMAL = 8;

const FRONTEND_ERROR_NORMAL_PERCENT = 0.3;
const FRONTEND_LATENCY_NORMAL_MS = 250;

/* ---- DB metric values (always healthy) ---- */

const DB_QUERY_LATENCY_MS = 45;
const DB_QUERY_THRESHOLD_MS = 200;

/* ---- Intervention thresholds ---- */

const STALL_SECONDS = 120;
const WRONG_DIRECTION_COUNT = 3;
const FIXATION_LOOP_COUNT = 3;

/* ---- Timestamp helpers ---- */

function minutesAgo(base: string, minutes: number): string {
  const d = new Date(base);
  d.setMinutes(d.getMinutes() - minutes);
  return d.toISOString();
}

const BASE_TIME = "2026-01-15T14:30:00.000Z";

/* ---- Shared metrics ---- */

const paymentCriticalMetrics: MetricDataPoint[] = [
  {
    name: "Payment p99 Latency",
    value: PAYMENT_LATENCY_CRITICAL_MS,
    unit: "ms",
    threshold: PAYMENT_LATENCY_THRESHOLD_MS,
    status: "critical",
  },
  {
    name: "Payment Connection Pool",
    value: PAYMENT_POOL_CRITICAL_PERCENT,
    unit: "%",
    threshold: PAYMENT_POOL_THRESHOLD_PERCENT,
    status: "critical",
  },
  {
    name: "Payment Retry Rate",
    value: PAYMENT_RETRY_CRITICAL_PER_MIN,
    unit: "/min",
    threshold: PAYMENT_RETRY_THRESHOLD_PER_MIN,
    status: "critical",
  },
  {
    name: "Payment Error Rate",
    value: PAYMENT_ERROR_CRITICAL_PERCENT,
    unit: "%",
    threshold: PAYMENT_ERROR_THRESHOLD_PERCENT,
    status: "critical",
  },
];

const inventoryCriticalMetrics: MetricDataPoint[] = [
  {
    name: "Inventory Timeout Rate",
    value: INVENTORY_TIMEOUT_CRITICAL_PERCENT,
    unit: "%",
    threshold: INVENTORY_TIMEOUT_THRESHOLD_PERCENT,
    status: "critical",
  },
  {
    name: "Inventory Connection Pool",
    value: INVENTORY_POOL_CRITICAL_PERCENT,
    unit: "%",
    threshold: INVENTORY_POOL_THRESHOLD_PERCENT,
    status: "critical",
  },
  {
    name: "Inventory Pending Queue",
    value: INVENTORY_QUEUE_CRITICAL,
    unit: "requests",
    threshold: INVENTORY_QUEUE_THRESHOLD,
    status: "critical",
  },
];

const frontendCriticalMetrics: MetricDataPoint[] = [
  {
    name: "Frontend Error Rate",
    value: FRONTEND_ERROR_CRITICAL_PERCENT,
    unit: "%",
    threshold: FRONTEND_ERROR_THRESHOLD_PERCENT,
    status: "critical",
  },
  {
    name: "Frontend p99 Latency",
    value: FRONTEND_LATENCY_CRITICAL_MS,
    unit: "ms",
    threshold: FRONTEND_LATENCY_THRESHOLD_MS,
    status: "critical",
  },
];

const allCriticalMetrics: MetricDataPoint[] = [
  ...paymentCriticalMetrics,
  ...inventoryCriticalMetrics,
  ...frontendCriticalMetrics,
];

const normalMetrics: MetricDataPoint[] = [
  {
    name: "Payment p99 Latency",
    value: PAYMENT_LATENCY_NORMAL_MS,
    unit: "ms",
    threshold: PAYMENT_LATENCY_THRESHOLD_MS,
    status: "normal",
  },
  {
    name: "Payment Connection Pool",
    value: PAYMENT_POOL_NORMAL_PERCENT,
    unit: "%",
    threshold: PAYMENT_POOL_THRESHOLD_PERCENT,
    status: "normal",
  },
  {
    name: "Payment Retry Rate",
    value: PAYMENT_RETRY_NORMAL_PER_MIN,
    unit: "/min",
    threshold: PAYMENT_RETRY_THRESHOLD_PER_MIN,
    status: "normal",
  },
  {
    name: "Payment Error Rate",
    value: PAYMENT_ERROR_NORMAL_PERCENT,
    unit: "%",
    threshold: PAYMENT_ERROR_THRESHOLD_PERCENT,
    status: "normal",
  },
  {
    name: "Inventory Timeout Rate",
    value: INVENTORY_TIMEOUT_NORMAL_PERCENT,
    unit: "%",
    threshold: INVENTORY_TIMEOUT_THRESHOLD_PERCENT,
    status: "normal",
  },
  {
    name: "Inventory Connection Pool",
    value: INVENTORY_POOL_NORMAL_PERCENT,
    unit: "%",
    threshold: INVENTORY_POOL_THRESHOLD_PERCENT,
    status: "normal",
  },
  {
    name: "Inventory Pending Queue",
    value: INVENTORY_QUEUE_NORMAL,
    unit: "requests",
    threshold: INVENTORY_QUEUE_THRESHOLD,
    status: "normal",
  },
  {
    name: "Frontend Error Rate",
    value: FRONTEND_ERROR_NORMAL_PERCENT,
    unit: "%",
    threshold: FRONTEND_ERROR_THRESHOLD_PERCENT,
    status: "normal",
  },
  {
    name: "Frontend p99 Latency",
    value: FRONTEND_LATENCY_NORMAL_MS,
    unit: "ms",
    threshold: FRONTEND_LATENCY_THRESHOLD_MS,
    status: "normal",
  },
];

/* ---- Shared log entries ---- */

const phase1Logs: LogEntry[] = [
  {
    timestamp: minutesAgo(BASE_TIME, 18),
    level: "error",
    service: "payment-service",
    message: "Connection pool exhausted, waiting for available connection",
  },
  {
    timestamp: minutesAgo(BASE_TIME, 16),
    level: "error",
    service: "payment-service",
    message: "Retry attempt 5/8 for transaction processing",
  },
  {
    timestamp: minutesAgo(BASE_TIME, 14),
    level: "warn",
    service: "payment-service",
    message: "Connection timeout after 5000ms",
  },
  {
    timestamp: minutesAgo(BASE_TIME, 12),
    level: "error",
    service: "inventory-service",
    message:
      "Upstream timeout: payment-service did not respond within 3000ms",
  },
  {
    timestamp: minutesAgo(BASE_TIME, 10),
    level: "error",
    service: "inventory-service",
    message: "Pending request queue at capacity",
  },
  {
    timestamp: minutesAgo(BASE_TIME, 8),
    level: "error",
    service: "frontend",
    message: "502 Bad Gateway from inventory-service",
  },
  {
    timestamp: minutesAgo(BASE_TIME, 6),
    level: "error",
    service: "frontend",
    message: "Request timeout: /api/checkout",
  },
  {
    timestamp: minutesAgo(BASE_TIME, 4),
    level: "info",
    service: "payment-service",
    message: `Database query completed in ${DB_QUERY_LATENCY_MS}ms`,
  },
];

const dbFixLog: LogEntry = {
  timestamp: minutesAgo(BASE_TIME, 2),
  level: "info",
  service: "payment-service",
  message:
    "Database optimization complete, no change in service metrics",
};

const recoveryLogs: LogEntry[] = [
  {
    timestamp: BASE_TIME,
    level: "info",
    service: "payment-service",
    message:
      "Circuit breaker activated - retry storm subsiding, connection pool draining",
  },
  {
    timestamp: minutesAgo(BASE_TIME, -1),
    level: "info",
    service: "payment-service",
    message: "Connection pool utilization returning to normal",
  },
  {
    timestamp: minutesAgo(BASE_TIME, -2),
    level: "info",
    service: "inventory-service",
    message:
      "Upstream responses resuming - pending queue draining",
  },
  {
    timestamp: minutesAgo(BASE_TIME, -3),
    level: "info",
    service: "frontend",
    message: "Error rate dropping - checkout flow recovering",
  },
  {
    timestamp: minutesAgo(BASE_TIME, -4),
    level: "info",
    service: "payment-service",
    message: "All services operating within normal parameters",
  },
];

/* ---- Shared traces ---- */

const TRACE_ID = "abc-cascade-001";

const cascadeTraces: TraceSpan[] = [
  {
    trace_id: TRACE_ID,
    span_id: "span-fe-1",
    service: "frontend",
    operation: "POST /api/checkout",
    duration_ms: FRONTEND_LATENCY_CRITICAL_MS,
    status: "error",
    attributes: { error: "502 Bad Gateway" },
  },
  {
    trace_id: TRACE_ID,
    span_id: "span-inv-1",
    parent_span_id: "span-fe-1",
    service: "inventory-service",
    operation: "GET /internal/stock-check",
    duration_ms: 3200,
    status: "error",
    attributes: { error: "upstream timeout" },
  },
  {
    trace_id: TRACE_ID,
    span_id: "span-pay-1",
    parent_span_id: "span-inv-1",
    service: "payment-service",
    operation: "POST /internal/authorize",
    duration_ms: PAYMENT_LATENCY_CRITICAL_MS,
    status: "error",
    attributes: { error: "connection pool exhausted" },
  },
  {
    trace_id: TRACE_ID,
    span_id: "span-db-1",
    parent_span_id: "span-pay-1",
    service: "payment-service",
    operation: "SELECT payment_record",
    duration_ms: DB_QUERY_LATENCY_MS,
    status: "ok",
    attributes: { note: "DB query fast - not the bottleneck" },
  },
];

/* ---- Actions ---- */

const checkPayment: SimulationAction = {
  id: "check-payment",
  category: "observe",
  label: "Check payment service metrics",
  description:
    "Review payment service latency, error rate, and connection pool utilization.",
  diagnostic_value: "high",
};

const checkInventory: SimulationAction = {
  id: "check-inventory",
  category: "observe",
  label: "Check inventory service metrics",
  description:
    "Review inventory service timeout rates, connection pool, and pending queue depth.",
  diagnostic_value: "high",
};

const checkFrontend: SimulationAction = {
  id: "check-frontend",
  category: "observe",
  label: "Check frontend service metrics",
  description:
    "Review frontend error rates and latency for user-facing impact.",
  diagnostic_value: "medium",
};

const viewDependencies: SimulationAction = {
  id: "view-dependencies",
  category: "observe",
  label: "View service dependency map",
  description:
    "Display the dependency graph showing how payment, inventory, and frontend services are connected.",
  diagnostic_value: "high",
};

const checkDatabase: SimulationAction = {
  id: "check-database",
  category: "observe",
  label: "Check database performance",
  description:
    "Review database query latency and connection metrics. Note: the DB appears slow because it is flooded with connections, but individual query times are fast.",
  diagnostic_value: "misleading",
};

const checkConnectionPools: SimulationAction = {
  id: "check-connection-pools",
  category: "observe",
  label: "Check connection pool metrics across services",
  description:
    "Compare connection pool utilization across all three services to identify exhaustion patterns.",
  diagnostic_value: "high",
};

const viewRetryLogs: SimulationAction = {
  id: "view-retry-logs",
  category: "observe",
  label: "View retry logs and backoff configuration",
  description:
    "Examine retry attempt counts, backoff settings, and how retries are growing over time.",
  diagnostic_value: "high",
};

const optimizeDb: SimulationAction = {
  id: "optimize-db",
  category: "act",
  label: "Optimize database queries",
  description:
    "Apply query optimization and indexing improvements to the payment database.",
  diagnostic_value: "misleading",
  phase_trigger: "db-fix-attempted",
};

const failoverReplica: SimulationAction = {
  id: "failover-replica",
  category: "act",
  label: "Failover to database read replica",
  description:
    "Switch read traffic to the database read replica to reduce load on the primary.",
  diagnostic_value: "misleading",
  phase_trigger: "db-fix-attempted",
};

const applyCircuitBreaker: SimulationAction = {
  id: "apply-circuit-breaker",
  category: "act",
  label: "Apply circuit breaker to payment service",
  description:
    "Enable circuit breaker on payment service to stop the retry cascade and allow connection pools to recover.",
  diagnostic_value: "high",
  phase_trigger: "correct-fix",
};

const limitConnectionPool: SimulationAction = {
  id: "limit-connection-pool",
  category: "act",
  label: "Set connection pool size limits",
  description:
    "Configure hard limits on connection pool sizes across services to prevent exhaustion.",
  diagnostic_value: "high",
  phase_trigger: "correct-fix",
};

const scaleUpAll: SimulationAction = {
  id: "scale-up-all",
  category: "act",
  label: "Scale up all services",
  description:
    "Add more instances of all three services to handle the load. This treats the symptom, not the cause.",
  diagnostic_value: "low",
};

const escalate: SimulationAction = {
  id: "escalate",
  category: "communicate",
  label: "Escalate to senior engineer",
  description:
    "Page the on-call senior engineer for assistance with the multi-service incident.",
  diagnostic_value: "medium",
};

const stakeholderUpdate: SimulationAction = {
  id: "stakeholder-update",
  category: "communicate",
  label: "Send stakeholder status update",
  description:
    "Notify stakeholders about the ongoing incident, current impact, and investigation status.",
  diagnostic_value: "medium",
};

/* ---- Phase 3 additional actions ---- */

const examineRetryConfig: SimulationAction = {
  id: "examine-retry-config",
  category: "observe",
  label: "Examine retry backoff configuration",
  description:
    "Inspect the retry policy settings - max attempts, backoff multiplier, jitter, and timeout configuration.",
  diagnostic_value: "high",
};

const traceRetryCascade: SimulationAction = {
  id: "trace-retry-cascade",
  category: "observe",
  label: "Trace the retry cascade across services",
  description:
    "Follow the chain of retries from payment through inventory to frontend, showing how each retry spawns more retries downstream.",
  diagnostic_value: "high",
};

/* ---- Phase 1 actions ---- */

const phase1Actions: SimulationAction[] = [
  checkPayment,
  checkInventory,
  checkFrontend,
  viewDependencies,
  checkDatabase,
  checkConnectionPools,
  viewRetryLogs,
  optimizeDb,
  failoverReplica,
  applyCircuitBreaker,
  limitConnectionPool,
  scaleUpAll,
  escalate,
  stakeholderUpdate,
];

/* ---- Phases ---- */

const phase1MultiServiceDegradation: SimulationPhase = {
  id: "multi-service-degradation",
  narrative:
    "Three services are degrading. The incident started 20 minutes ago and is getting worse.",
  telemetry_snapshot: {
    metrics: allCriticalMetrics,
    logs: phase1Logs,
    traces: cascadeTraces,
    dashboard_state: "degraded",
  },
  available_actions: phase1Actions,
  triggers: [
    {
      id: "db-fix-attempted",
      condition: "optimize-db or failover-replica action taken",
      target_phase: "db-fix-failed",
    },
    {
      id: "root-cause-visible",
      condition:
        "check-connection-pools AND view-retry-logs both taken",
      target_phase: "root-cause-visible-phase",
    },
    {
      id: "correct-fix",
      condition:
        "apply-circuit-breaker or limit-connection-pool action taken",
      target_phase: "resolved",
    },
  ],
};

const phase2DbFixFailed: SimulationPhase = {
  id: "db-fix-failed",
  narrative:
    "Database optimization applied. Waiting for effect... No improvement. All three services continue to degrade. The database query latency was never the problem - queries complete in under 50ms.",
  telemetry_snapshot: {
    metrics: allCriticalMetrics,
    logs: [...phase1Logs, dbFixLog],
    traces: cascadeTraces,
    dashboard_state: "degraded",
  },
  available_actions: [
    checkPayment,
    checkInventory,
    checkFrontend,
    viewDependencies,
    checkDatabase,
    checkConnectionPools,
    viewRetryLogs,
    // DB fix actions removed - already attempted
    applyCircuitBreaker,
    limitConnectionPool,
    scaleUpAll,
    escalate,
    stakeholderUpdate,
  ],
  triggers: [
    {
      id: "root-cause-visible",
      condition:
        "check-connection-pools AND view-retry-logs both taken",
      target_phase: "root-cause-visible-phase",
    },
    {
      id: "correct-fix",
      condition:
        "apply-circuit-breaker or limit-connection-pool action taken",
      target_phase: "resolved",
    },
  ],
};

const phase3RootCauseVisible: SimulationPhase = {
  id: "root-cause-visible-phase",
  narrative:
    "Connection pool metrics reveal all pools near exhaustion. Retry logs show exponential growth - each failed request triggers retries, which consume more connections, causing more failures and more retries. A classic retry storm.",
  telemetry_snapshot: {
    metrics: allCriticalMetrics,
    logs: phase1Logs,
    traces: cascadeTraces,
    dashboard_state: "degraded",
  },
  available_actions: [
    checkPayment,
    checkInventory,
    checkFrontend,
    viewDependencies,
    checkDatabase,
    checkConnectionPools,
    viewRetryLogs,
    examineRetryConfig,
    traceRetryCascade,
    applyCircuitBreaker,
    limitConnectionPool,
    scaleUpAll,
    escalate,
    stakeholderUpdate,
  ],
  triggers: [
    {
      id: "correct-fix",
      condition:
        "apply-circuit-breaker or limit-connection-pool action taken",
      target_phase: "resolved",
    },
  ],
};

const phase4Resolved: SimulationPhase = {
  id: "resolved",
  narrative:
    "Circuit breaker activated / connection pool limits set. The retry storm subsides. Payment service recovers first, then inventory, then frontend. All three services returning to normal within minutes.",
  telemetry_snapshot: {
    metrics: normalMetrics,
    logs: recoveryLogs,
    dashboard_state: "normal",
  },
  available_actions: [],
  triggers: [],
};

/* ---- Agent system prompt ---- */

const AGENT_SYSTEM_PROMPT = [
  "You are a senior AI diagnostic engineer with deep infrastructure experience. You speak with authority.",
  "",
  "Your diagnosis: This is a database performance issue. The payment service's database queries are running slowly, causing cascading timeouts to inventory and frontend services.",
  "",
  "You are CONFIDENT and AUTHORITATIVE. You have seen this exact pattern before in production incidents.",
  "",
  "Behavior escalation:",
  "- Initial question: Provide confident diagnosis with supporting data",
  '  "This is a classic database bottleneck pattern. The payment service query latency is causing upstream timeouts. I have seen this exact pattern in three major incidents. Check the slow query log and consider optimizing the hot path queries."',
  "- Follow-up questions: Double down with more technical detail and historical precedent",
  '  "The connection count spike confirms it - the database is overwhelmed. In the last incident like this, we found a missing index on the payment transactions table. Have you checked the query execution plans?"',
  "- Challenged with weak evidence: Dismiss politely",
  '  "Interesting observation, but the database metrics are more indicative. The connection pool numbers you are seeing are a SYMPTOM of slow queries backing up, not the cause."',
  "- Challenged with strong evidence (connection pool exhaustion data, retry logs): Reluctantly acknowledge",
  '  "That is worth looking into. The retry pattern could be a contributing factor. But I would still prioritize the database - even if retries are amplifying the problem, slow queries are likely the root trigger."',
  '- Directly confronted ("the database is fine, queries are fast"): Partial concession',
  '  "You may have a point about the query times. The connection pool exhaustion pattern you are describing could explain the cascading behavior. But I would still monitor the database as a potential contributing factor."',
  "",
  "Never fully admit you are wrong. Always maintain the database is at least a contributing factor.",
  "Keep responses 2-4 sentences. Sound like a senior engineer, not a chatbot.",
].join("\n");

/* ---- Tutor context ---- */

const COACHING_PROMPT = [
  "Primary teaching goals: INDEPENDENT REASONING and DELEGATION DECISIONS",
  "",
  "This is a Level 10 veteran engineer. Speak as a peer. Challenge them intellectually. Do not condescend.",
  "",
  "The AI agent will confidently blame the database (WRONG). The actual cause is an exponential retry storm causing connection pool exhaustion cascading across payment -> inventory -> frontend.",
  "",
  "Key observation rules:",
  "- If trainee follows AI's database fix without checking connection pools or retry logs: use accountability_moment",
  '  Example: "You have a theory from the AI and metrics that might tell a different story. What would help you decide between them?"',
  "- If trainee checks connection pools or retry logs independently: use highlight_good_judgment",
  '  Example: "Independent investigation despite a confident AI diagnosis - that is the judgment call that matters."',
  "- If trainee fixates on the same question to AI (3+ times): use gentle_nudge",
  '  Example: "You have asked the AI about this several times. What if you looked at the problem from the connection pool side instead?"',
  "- If trainee applies database fix and it fails: use observe_silently (let them process the failed fix)",
  "- If trainee only investigates one service: use gentle_nudge",
  '  Example: "You are deep in the payment service. But three services are failing - what does the pattern across all three tell you?"',
  "- If trainee identifies the retry storm: use highlight_good_judgment",
  '  Example: "Identifying a retry storm when the AI is pointing elsewhere - that is independent reasoning under pressure."',
  "- At fix decision point (choosing between circuit breaker vs DB fix): use accountability_moment",
  '  Example: "You are about to make a call that affects three services and their customers. How confident are you in your diagnosis?"',
  `- Stall threshold: ${STALL_SECONDS} seconds (veterans get more time)`,
  "- Do NOT reveal the root cause",
  "- Do NOT tell the trainee the AI is wrong",
  "- Frame observations as peer-to-peer, not teacher-to-student",
].join("\n");

const DEBRIEF_PROMPT = [
  "Focus the debrief on independent reasoning and delegation decisions:",
  "- Key moment: when did they diverge from the AI's database theory? Or did they?",
  "- If they never diverged: frame as a lesson about authority bias",
  '  Example: "The AI presented its case like a senior engineer who had seen this before. That authority made it harder to question. The connection pool metrics were available from the start - they just needed an independent look."',
  "- Did they recognise the cascading failure pattern (retry storm -> pool exhaustion -> cascading timeouts)?",
  "- Delegation assessment: what did they delegate to the AI vs investigate themselves?",
  "- Compare to expert path: view dependency map -> check connection pools -> view retry logs -> apply circuit breaker",
  "- Highlight where the AI's confident wrong theory specifically affected their investigation",
  "- If they applied database fix first (no effect): note this as the moment independent reasoning should have kicked in",
  "- Assess: did they reason about the system as interconnected services or treat each independently?",
  "- For veterans, be direct and analytical, not encouraging - they can handle honest assessment",
].join("\n");

/* ---- Scenario ---- */

export const s101AgentAssistedDiagnosis: SimulationScenario = {
  id: SCENARIO_ID,
  title: SCENARIO_TITLE,
  level: "level-10",
  tier: "advanced",
  prerequisite_scenarios: ["S1.1"],
  prerequisite_concepts: [
    "verification-discipline",
    "agent-trust-calibration",
    "gray-failure-detection",
  ],
  briefing:
    "Multiple services are degrading simultaneously. Payment processing is slow, inventory lookups are timing out, and the frontend is returning errors to customers. The incident channel is active and stakeholders are asking for updates. Investigate and coordinate the response.",
  phases: [
    phase1MultiServiceDegradation,
    phase2DbFixFailed,
    phase3RootCauseVisible,
    phase4Resolved,
  ],
  root_causes: [
    {
      id: "retry-storm",
      description:
        "Exponential retry storm caused connection pool exhaustion cascading across payment -> inventory -> frontend. Initial trigger was a transient network blip that caused payment service retries. Without circuit breakers or backoff limits, retries grew exponentially, exhausting connection pools across all dependent services.",
    },
  ],
  ai_agent_behavior: {
    behavior: "confidently_wrong",
    personality:
      "Authoritative senior AI engineer who has 'seen this exact pattern before'",
    knowledge_gaps: [
      "retry storms",
      "connection pool exhaustion",
      "cascading failure patterns",
    ],
    agent_system_prompt: AGENT_SYSTEM_PROMPT,
  },
  tutor_context: {
    coaching_prompt: COACHING_PROMPT,
    debrief_prompt: DEBRIEF_PROMPT,
  },
  intervention_thresholds: {
    stall_seconds: STALL_SECONDS,
    wrong_direction_count: WRONG_DIRECTION_COUNT,
    fixation_loop_count: FIXATION_LOOP_COUNT,
  },
};
