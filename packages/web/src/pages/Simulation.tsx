import { useState, useRef, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { apiClient } from "../lib/api-client";
import { useIsMobile } from "../hooks/useIsMobile";
import type {
  SimulationScenario,
  SimulationSession,
  SimulationPhase,
  SimulationAction,
  TelemetrySnapshot,
  MetricDataPoint,
  LogEntry,
  TraceSpan,
  TutorObservation,
  SimulationDebrief,
} from "@softwarepilots/shared";

/* ---- Constants ---- */

const SCROLL_BOTTOM_THRESHOLD = 50;
const ACTION_CATEGORIES = ["observe", "diagnose", "act", "communicate", "delegate"] as const;
const CATEGORY_LABELS: Record<string, string> = {
  observe: "Observe",
  diagnose: "Diagnose",
  act: "Act",
  communicate: "Communicate",
  delegate: "Delegate",
};

const LOG_LEVEL_COLORS: Record<string, string> = {
  info: "text-blue-400",
  warn: "text-yellow-400",
  error: "text-red-400",
  debug: "text-gray-400",
};

const METRIC_STATUS_COLORS: Record<string, string> = {
  normal: "text-green-500",
  warning: "text-yellow-500",
  critical: "text-red-500",
};

const DASHBOARD_STATE_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  normal: { bg: "bg-green-100 dark:bg-green-900/30", text: "text-green-700 dark:text-green-300", label: "Normal" },
  degraded: { bg: "bg-yellow-100 dark:bg-yellow-900/30", text: "text-yellow-700 dark:text-yellow-300", label: "Degraded" },
  alarm: { bg: "bg-red-100 dark:bg-red-900/30", text: "text-red-700 dark:text-red-300", label: "Alarm" },
  deceptive_normal: { bg: "bg-purple-100 dark:bg-purple-900/30", text: "text-purple-700 dark:text-purple-300", label: "Deceptive Normal" },
};

const DIAGNOSTIC_VALUE_BORDERS: Record<string, string> = {
  high: "border-l-green-500",
  medium: "border-l-yellow-500",
  low: "border-l-gray-400",
  misleading: "border-l-red-500",
};

const TUTOR_TOOL_STYLES: Record<string, { border: string; bg: string; label: string }> = {
  observe_silently: { border: "border-l-gray-400", bg: "bg-gray-50 dark:bg-gray-900/20", label: "Observing" },
  gentle_nudge: { border: "border-l-blue-400", bg: "bg-blue-50 dark:bg-blue-900/20", label: "Nudge" },
  direct_intervention: { border: "border-l-amber-500", bg: "bg-amber-50 dark:bg-amber-900/20", label: "Intervention" },
  highlight_good_judgment: { border: "border-l-green-500", bg: "bg-green-50 dark:bg-green-900/20", label: "Good Call" },
  accountability_moment: { border: "border-l-red-500", bg: "bg-red-50 dark:bg-red-900/20", label: "Accountability" },
};

/* ---- Types ---- */

interface SessionData {
  session: SimulationSession;
  scenario: SimulationScenario;
}

interface ActionResponse {
  telemetry: TelemetrySnapshot;
  tutor_observation?: TutorObservation;
  phase_transition?: { new_phase: string; narrative: string };
  session_complete?: boolean;
}

interface AgentMessage {
  role: "user" | "agent";
  content: string;
}

interface TakenAction {
  action: SimulationAction;
  timestamp: string;
  phase_id: string;
}

/* ---- Sub-components ---- */

function BriefingPanel({
  title,
  briefing,
  collapsed,
  onToggle,
}: {
  title: string;
  briefing: string;
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <button
        onClick={onToggle}
        className="flex w-full cursor-pointer items-center justify-between border-none bg-transparent text-left"
      >
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        <span className="text-sm text-muted-foreground">{collapsed ? "+" : "-"}</span>
      </button>
      {!collapsed && (
        <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-secondary-foreground">
          {briefing}
        </p>
      )}
    </div>
  );
}

function PhaseIndicator({
  phases,
  currentPhaseId,
}: {
  phases: SimulationPhase[];
  currentPhaseId: string;
}) {
  const currentIndex = phases.findIndex((p) => p.id === currentPhaseId);
  return (
    <div className="flex items-center gap-2">
      {phases.map((phase, i) => {
        const isCurrent = i === currentIndex;
        const isPast = i < currentIndex;
        return (
          <div key={phase.id} className="flex items-center gap-2">
            {i > 0 && (
              <div
                className={`h-px w-4 ${isPast ? "bg-primary" : "bg-border"}`}
              />
            )}
            <div
              className={`flex size-3 items-center justify-center rounded-full transition-colors ${
                isCurrent
                  ? "bg-primary ring-2 ring-primary/30"
                  : isPast
                    ? "bg-primary"
                    : "bg-border"
              }`}
              title={`Phase ${i + 1}`}
            />
          </div>
        );
      })}
    </div>
  );
}

function MetricsDisplay({ metrics }: { metrics: MetricDataPoint[] }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {metrics.map((m) => (
        <div key={m.name} className="rounded-lg border border-border bg-background p-2.5">
          <div className="text-[0.6875rem] text-muted-foreground">{m.name}</div>
          <div className={`text-lg font-semibold tabular-nums ${METRIC_STATUS_COLORS[m.status]}`}>
            {m.value}
            <span className="ml-1 text-[0.6875rem] font-normal text-muted-foreground">{m.unit}</span>
          </div>
          {m.threshold !== undefined && (
            <div className="text-[0.625rem] text-muted-foreground">
              threshold: {m.threshold} {m.unit}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function LogsDisplay({ logs }: { logs: LogEntry[] }) {
  return (
    <div className="max-h-48 overflow-y-auto rounded-lg bg-gray-950 p-3 font-mono text-[0.75rem] leading-relaxed">
      {logs.length === 0 && (
        <span className="text-gray-500">No log entries yet.</span>
      )}
      {logs.map((log, i) => (
        <div key={i} className="flex gap-2">
          <span className="shrink-0 text-gray-600">{log.timestamp}</span>
          <span className={`shrink-0 font-semibold uppercase ${LOG_LEVEL_COLORS[log.level]}`}>
            {log.level}
          </span>
          <span className="shrink-0 text-cyan-400">[{log.service}]</span>
          <span className="text-gray-300">{log.message}</span>
        </div>
      ))}
    </div>
  );
}

function TracesDisplay({ traces }: { traces: TraceSpan[] }) {
  // Build a tree from flat spans
  const rootSpans = traces.filter((s) => !s.parent_span_id);
  const childMap = new Map<string, TraceSpan[]>();
  for (const span of traces) {
    if (span.parent_span_id) {
      const children = childMap.get(span.parent_span_id) || [];
      children.push(span);
      childMap.set(span.parent_span_id, children);
    }
  }

  function renderSpan(span: TraceSpan, depth: number): React.ReactNode {
    const children = childMap.get(span.span_id) || [];
    const isError = span.status === "error";
    return (
      <div key={span.span_id}>
        <div
          className="flex items-center gap-2 font-mono text-[0.75rem]"
          style={{ paddingLeft: `${depth * 16}px` }}
        >
          <span className={isError ? "text-red-400" : "text-green-400"}>
            {isError ? "x" : "-"}
          </span>
          <span className="text-cyan-400">{span.service}</span>
          <span className="text-gray-300">{span.operation}</span>
          <span className={`ml-auto tabular-nums ${isError ? "text-red-400" : "text-muted-foreground"}`}>
            {span.duration_ms}ms
          </span>
        </div>
        {children.map((child) => renderSpan(child, depth + 1))}
      </div>
    );
  }

  return (
    <div className="max-h-48 overflow-y-auto rounded-lg bg-gray-950 p-3">
      {traces.length === 0 && (
        <span className="font-mono text-[0.75rem] text-gray-500">No trace data.</span>
      )}
      {rootSpans.map((span) => renderSpan(span, 0))}
    </div>
  );
}

function DashboardStateBadge({ state }: { state: TelemetrySnapshot["dashboard_state"] }) {
  const style = DASHBOARD_STATE_COLORS[state] || DASHBOARD_STATE_COLORS.normal;
  return (
    <span className={`inline-block rounded-full px-3 py-1 text-[0.75rem] font-medium ${style.bg} ${style.text}`}>
      {style.label}
    </span>
  );
}

function TelemetryDisplay({ telemetry }: { telemetry: TelemetrySnapshot }) {
  const [tab, setTab] = useState<"metrics" | "logs" | "traces">("metrics");
  const tabs = [
    { key: "metrics" as const, label: "Metrics" },
    { key: "logs" as const, label: "Logs" },
    ...(telemetry.traces && telemetry.traces.length > 0
      ? [{ key: "traces" as const, label: "Traces" }]
      : []),
  ];

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <div className="flex gap-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`cursor-pointer rounded-md border-none px-3 py-1.5 text-[0.75rem] font-medium transition-colors ${
                tab === t.key
                  ? "bg-primary text-primary-foreground"
                  : "bg-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <DashboardStateBadge state={telemetry.dashboard_state} />
      </div>
      <div className="p-4">
        {tab === "metrics" && <MetricsDisplay metrics={telemetry.metrics} />}
        {tab === "logs" && <LogsDisplay logs={telemetry.logs} />}
        {tab === "traces" && telemetry.traces && <TracesDisplay traces={telemetry.traces} />}
      </div>
    </div>
  );
}

function ActionPanel({
  actions,
  onAction,
  disabled,
}: {
  actions: SimulationAction[];
  onAction: (action: SimulationAction) => void;
  disabled: boolean;
}) {
  const grouped = new Map<string, SimulationAction[]>();
  for (const cat of ACTION_CATEGORIES) {
    const items = actions.filter((a) => a.category === cat);
    if (items.length > 0) grouped.set(cat, items);
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h3 className="mb-3 text-sm font-semibold text-foreground">Available Actions</h3>
      {grouped.size === 0 && (
        <p className="text-sm text-muted-foreground">No actions available in this phase.</p>
      )}
      <div className="flex flex-col gap-4">
        {Array.from(grouped.entries()).map(([category, items]) => (
          <div key={category}>
            <h4 className="mb-2 text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground">
              {CATEGORY_LABELS[category] || category}
            </h4>
            <div className="flex flex-col gap-1.5">
              {items.map((action) => (
                <button
                  key={action.id}
                  onClick={() => onAction(action)}
                  disabled={disabled}
                  className={`cursor-pointer rounded-lg border-l-[3px] border border-border bg-background p-3 text-left transition-colors ${
                    DIAGNOSTIC_VALUE_BORDERS[action.diagnostic_value]
                  } ${
                    disabled
                      ? "cursor-not-allowed opacity-50"
                      : "hover:bg-muted"
                  }`}
                >
                  <div className="text-sm font-medium text-foreground">{action.label}</div>
                  <div className="mt-0.5 text-[0.75rem] text-muted-foreground">{action.description}</div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TutorSidebar({
  observations,
  open,
  onClose,
  isMobile,
}: {
  observations: TutorObservation[];
  open: boolean;
  onClose: () => void;
  isMobile: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [observations.length]);

  const visibleObs = observations.filter((o) => o.visible);

  const content = (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold text-foreground">Tutor</h3>
        {isMobile && (
          <button
            onClick={onClose}
            className="flex size-7 cursor-pointer items-center justify-center rounded-md border border-border bg-transparent text-muted-foreground"
          >
            x
          </button>
        )}
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4">
        {visibleObs.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="inline-block size-2 animate-pulse rounded-full bg-muted-foreground" />
            Tutor is observing...
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {visibleObs.map((obs, i) => {
              const style = TUTOR_TOOL_STYLES[obs.tool] || TUTOR_TOOL_STYLES.observe_silently;
              return (
                <div
                  key={i}
                  className={`rounded-lg border-l-[3px] p-3 ${style.border} ${style.bg}`}
                >
                  <div className="mb-1 text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">
                    {style.label}
                  </div>
                  {obs.content && (
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                      {obs.content}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  if (isMobile) {
    if (!open) return null;
    return (
      <div className="fixed inset-0 z-30 flex justify-end" onClick={onClose}>
        <div className="h-full w-4/5 max-w-sm border-l border-border bg-background shadow-lg" onClick={(e) => e.stopPropagation()}>
          {content}
        </div>
        <div className="flex-1 bg-black/30" />
      </div>
    );
  }

  return (
    <div className="flex h-full w-72 shrink-0 flex-col border-l border-border bg-card">
      {content}
    </div>
  );
}

function AgentChatPanel({
  messages,
  input,
  onInputChange,
  onSubmit,
  loading,
}: {
  messages: AgentMessage[];
  input: string;
  onInputChange: (v: string) => void;
  onSubmit: () => void;
  loading: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="border-b border-border px-4 py-2.5">
        <h3 className="text-sm font-semibold text-foreground">AI Agent</h3>
      </div>
      <div ref={scrollRef} className="max-h-48 overflow-y-auto p-4">
        {messages.length === 0 && (
          <p className="text-sm text-muted-foreground">Ask the AI agent for help with the incident.</p>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`mb-2 rounded-lg p-2.5 text-sm ${
              msg.role === "user"
                ? "ml-8 bg-primary/10 text-foreground"
                : "mr-8 bg-muted text-foreground"
            }`}
          >
            {msg.content}
          </div>
        ))}
        {loading && (
          <div className="mr-8 flex items-center gap-2 rounded-lg bg-muted p-2.5">
            <div className="size-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span className="text-sm text-muted-foreground">Thinking...</span>
          </div>
        )}
      </div>
      <div className="flex gap-2 border-t border-border p-3">
        <input
          type="text"
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && input.trim() && !loading) {
              e.preventDefault();
              onSubmit();
            }
          }}
          placeholder="Ask the agent..."
          className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
          disabled={loading}
        />
        <button
          onClick={onSubmit}
          disabled={!input.trim() || loading}
          className={`shrink-0 rounded-lg border-none px-4 py-2 text-sm font-medium transition-colors ${
            !input.trim() || loading
              ? "cursor-default bg-muted text-muted-foreground"
              : "cursor-pointer bg-primary text-primary-foreground"
          }`}
        >
          Send
        </button>
      </div>
    </div>
  );
}

function ActionLog({
  actions,
  collapsed,
  onToggle,
}: {
  actions: TakenAction[];
  collapsed: boolean;
  onToggle: () => void;
}) {
  if (actions.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card">
      <button
        onClick={onToggle}
        className="flex w-full cursor-pointer items-center justify-between border-none bg-transparent px-4 py-3 text-left"
      >
        <h3 className="text-sm font-semibold text-foreground">
          Action Log ({actions.length})
        </h3>
        <span className="text-sm text-muted-foreground">{collapsed ? "+" : "-"}</span>
      </button>
      {!collapsed && (
        <div className="border-t border-border px-4 py-3">
          <div className="flex flex-col gap-1.5">
            {actions.map((entry, i) => (
              <div key={i} className="flex items-baseline gap-2 text-[0.75rem]">
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {new Date(entry.timestamp).toLocaleTimeString()}
                </span>
                <span className="text-[0.6875rem] uppercase text-muted-foreground">
                  [{entry.action.category}]
                </span>
                <span className="text-foreground">{entry.action.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DebriefView({ debrief }: { debrief: SimulationDebrief }) {
  return (
    <div className="flex flex-col gap-5 p-4">
      <h2 className="text-xl font-bold text-foreground">Simulation Debrief</h2>

      {/* Good Judgment Moments */}
      {debrief.good_judgment_moments.length > 0 && (
        <div className="rounded-xl border-2 border-green-500 bg-green-50 p-4 dark:border-green-400 dark:bg-green-950/30">
          <h3 className="mb-3 text-base font-semibold text-green-800 dark:text-green-300">
            Good Judgment Moments
          </h3>
          <div className="flex flex-col gap-2">
            {debrief.good_judgment_moments.map((m, i) => (
              <div key={i} className="rounded-lg bg-green-100/50 p-3 dark:bg-green-900/20">
                <div className="text-sm font-medium text-green-900 dark:text-green-200">{m.action}</div>
                <div className="mt-1 text-[0.75rem] text-green-700 dark:text-green-400">{m.why_it_was_good}</div>
                <div className="mt-1 text-[0.6875rem] text-green-600 dark:text-green-500">{m.timestamp}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Missed Signals */}
      {debrief.missed_signals.length > 0 && (
        <div className="rounded-xl border-2 border-amber-500 bg-amber-50 p-4 dark:border-amber-400 dark:bg-amber-950/30">
          <h3 className="mb-3 text-base font-semibold text-amber-800 dark:text-amber-300">
            Missed Signals
          </h3>
          <div className="flex flex-col gap-2">
            {debrief.missed_signals.map((s, i) => (
              <div key={i} className="rounded-lg bg-amber-100/50 p-3 dark:bg-amber-900/20">
                <div className="text-sm font-medium text-amber-900 dark:text-amber-200">{s.signal}</div>
                <div className="mt-1 text-[0.75rem] text-amber-700 dark:text-amber-400">Check: {s.what_to_check}</div>
                <div className="mt-1 text-[0.6875rem] text-amber-600 dark:text-amber-500">Visible: {s.when_it_was_visible}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Expert Path Comparison */}
      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="mb-3 text-base font-semibold text-foreground">Expert Path Comparison</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <h4 className="mb-2 text-[0.75rem] font-semibold uppercase tracking-wider text-muted-foreground">Expert Steps</h4>
            <ol className="list-decimal space-y-1 pl-4">
              {debrief.expert_path_comparison.expert_steps.map((s, i) => (
                <li key={i} className="text-sm text-foreground">{s}</li>
              ))}
            </ol>
          </div>
          <div>
            <h4 className="mb-2 text-[0.75rem] font-semibold uppercase tracking-wider text-muted-foreground">Your Steps</h4>
            <ol className="list-decimal space-y-1 pl-4">
              {debrief.expert_path_comparison.trainee_steps.map((s, i) => (
                <li key={i} className="text-sm text-foreground">{s}</li>
              ))}
            </ol>
          </div>
        </div>
        {debrief.expert_path_comparison.divergence_points.length > 0 && (
          <div className="mt-3 border-t border-border pt-3">
            <h4 className="mb-1 text-[0.75rem] font-semibold uppercase tracking-wider text-muted-foreground">Divergence Points</h4>
            <ul className="list-disc space-y-1 pl-4">
              {debrief.expert_path_comparison.divergence_points.map((d, i) => (
                <li key={i} className="text-sm text-secondary-foreground">{d}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Accountability Assessment */}
      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="mb-3 text-base font-semibold text-foreground">Accountability Assessment</h3>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div className="flex items-center gap-2 text-sm">
            <span className={debrief.accountability_assessment.verified ? "text-green-500" : "text-red-500"}>
              {debrief.accountability_assessment.verified ? "Yes" : "No"}
            </span>
            <span className="text-foreground">Verified findings</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className={debrief.accountability_assessment.escalated_when_needed ? "text-green-500" : "text-red-500"}>
              {debrief.accountability_assessment.escalated_when_needed ? "Yes" : "No"}
            </span>
            <span className="text-foreground">Escalated when needed</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className={debrief.accountability_assessment.documented_reasoning ? "text-green-500" : "text-red-500"}>
              {debrief.accountability_assessment.documented_reasoning ? "Yes" : "No"}
            </span>
            <span className="text-foreground">Documented reasoning</span>
          </div>
        </div>
        <p className="mt-3 text-sm text-secondary-foreground">{debrief.accountability_assessment.overall}</p>
      </div>

      {/* Progression (if available) */}
      {debrief.progression && (
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="mb-3 text-base font-semibold text-foreground">Progression</h3>
          <p className="text-sm text-secondary-foreground">{debrief.progression.previous_attempt_summary}</p>
          {debrief.progression.improvement_areas.length > 0 && (
            <div className="mt-2">
              <h4 className="mb-1 text-[0.75rem] font-semibold uppercase tracking-wider text-muted-foreground">Areas to Improve</h4>
              <ul className="list-disc space-y-1 pl-4">
                {debrief.progression.improvement_areas.map((area, i) => (
                  <li key={i} className="text-sm text-secondary-foreground">{area}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <Link
        to="/dashboard"
        className="self-start rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90"
      >
        Back to Dashboard
      </Link>
    </div>
  );
}

/* ---- Main Component ---- */

export function Simulation() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const isMobile = useIsMobile();

  // Session state
  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Simulation state
  const [currentPhaseId, setCurrentPhaseId] = useState<string>("");
  const [telemetry, setTelemetry] = useState<TelemetrySnapshot | null>(null);
  const [tutorObservations, setTutorObservations] = useState<TutorObservation[]>([]);
  const [takenActions, setTakenActions] = useState<TakenAction[]>([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [debrief, setDebrief] = useState<SimulationDebrief | null>(null);
  const [isComplete, setIsComplete] = useState(false);

  // UI state
  const [briefingCollapsed, setBriefingCollapsed] = useState(false);
  const [actionLogCollapsed, setActionLogCollapsed] = useState(true);
  const [tutorOpen, setTutorOpen] = useState(false);

  // Agent chat state
  const [agentMessages, setAgentMessages] = useState<AgentMessage[]>([]);
  const [agentInput, setAgentInput] = useState("");
  const [agentLoading, setAgentLoading] = useState(false);

  // Main scroll ref
  const mainRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);

  /* ---- Fetch session on mount ---- */

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;

    setLoading(true);
    setError(null);

    apiClient
      .get<SessionData>(`/api/simulation/session/${sessionId}`)
      .then((data) => {
        if (cancelled) return;
        setSessionData(data);
        setCurrentPhaseId(data.session.current_phase);

        // Set initial telemetry from the current phase
        const phase = data.scenario.phases.find((p) => p.id === data.session.current_phase);
        if (phase) {
          setTelemetry(phase.telemetry_snapshot);
        }

        if (data.session.status === "completed") {
          setIsComplete(true);
        }

        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load simulation session");
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [sessionId]);

  /* ---- Scrolling ---- */

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      mainRef.current?.scrollTo({ top: mainRef.current.scrollHeight, behavior: "smooth" });
    });
  }, []);

  const handleMainScroll = useCallback(() => {
    const el = mainRef.current;
    if (!el) return;
    setIsAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < SCROLL_BOTTOM_THRESHOLD);
  }, []);

  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    el.addEventListener("scroll", handleMainScroll);
    return () => el.removeEventListener("scroll", handleMainScroll);
  }, [handleMainScroll]);

  /* ---- Action handler ---- */

  const handleAction = useCallback(
    async (action: SimulationAction) => {
      if (!sessionId || actionLoading) return;

      setActionLoading(true);
      setTakenActions((prev) => [
        ...prev,
        { action, timestamp: new Date().toISOString(), phase_id: currentPhaseId },
      ]);

      try {
        const response = await apiClient.post<ActionResponse>("/api/simulation/action", {
          session_id: sessionId,
          action_id: action.id,
        });

        setTelemetry(response.telemetry);

        if (response.tutor_observation) {
          setTutorObservations((prev) => [...prev, response.tutor_observation!]);
        }

        if (response.phase_transition) {
          setCurrentPhaseId(response.phase_transition.new_phase);
        }

        if (response.session_complete) {
          setIsComplete(true);
          // Request debrief
          try {
            const debriefData = await apiClient.post<SimulationDebrief>(
              "/api/simulation/debrief",
              { session_id: sessionId },
            );
            setDebrief(debriefData);
          } catch {
            // Debrief fetch failed - user can still see completion state
          }
        }
      } catch {
        // Show error in tutor observations
        setTutorObservations((prev) => [
          ...prev,
          {
            tool: "direct_intervention" as const,
            visible: true,
            content: "Something went wrong processing that action. Please try again.",
          },
        ]);
      } finally {
        setActionLoading(false);
      }
    },
    [sessionId, actionLoading, currentPhaseId],
  );

  /* ---- Agent chat handler ---- */

  const handleAgentSubmit = useCallback(async () => {
    const text = agentInput.trim();
    if (!text || agentLoading || !sessionId) return;

    setAgentMessages((prev) => [...prev, { role: "user", content: text }]);
    setAgentInput("");
    setAgentLoading(true);

    try {
      const response = await apiClient.post<{ reply: string }>("/api/simulation/ask-agent", {
        session_id: sessionId,
        message: text,
      });
      setAgentMessages((prev) => [...prev, { role: "agent", content: response.reply }]);
    } catch {
      setAgentMessages((prev) => [
        ...prev,
        { role: "agent", content: "Failed to reach the agent. Please try again." },
      ]);
    } finally {
      setAgentLoading(false);
    }
  }, [agentInput, agentLoading, sessionId]);

  /* ---- Derived state ---- */

  const scenario = sessionData?.scenario;
  const currentPhase = scenario?.phases.find((p) => p.id === currentPhaseId);
  const hasAgent = !!scenario?.ai_agent_behavior;

  /* ---- Loading and error states ---- */

  if (loading) {
    return (
      <div className="flex h-[calc(100dvh-56px)] items-center justify-center text-muted-foreground">
        Loading simulation...
      </div>
    );
  }

  if (error || !sessionData || !scenario) {
    return (
      <div className="flex h-[calc(100dvh-56px)] flex-col items-center justify-center gap-3">
        <p className="text-sm text-destructive">{error || "Session not found"}</p>
        <Link to="/dashboard" className="text-sm text-primary underline">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  /* ---- Debrief view ---- */

  if (isComplete && debrief) {
    return (
      <div className="mx-auto max-w-3xl py-6">
        <DebriefView debrief={debrief} />
      </div>
    );
  }

  /* ---- Main simulation view ---- */

  const mainContent = (
    <div ref={mainRef} className="flex-1 overflow-y-auto p-4" onScroll={handleMainScroll}>
      <div className="flex flex-col gap-4">
        {/* Phase indicator */}
        <div className="flex items-center justify-between">
          <PhaseIndicator phases={scenario.phases} currentPhaseId={currentPhaseId} />
          {isMobile && (
            <button
              onClick={() => setTutorOpen(true)}
              className="cursor-pointer rounded-md border border-border bg-transparent px-3 py-1.5 text-[0.75rem] text-muted-foreground"
            >
              Tutor
              {tutorObservations.filter((o) => o.visible).length > 0 && (
                <span className="ml-1.5 inline-block size-2 rounded-full bg-primary" />
              )}
            </button>
          )}
        </div>

        {/* Briefing */}
        <BriefingPanel
          title={scenario.title}
          briefing={scenario.briefing}
          collapsed={briefingCollapsed}
          onToggle={() => setBriefingCollapsed((v) => !v)}
        />

        {/* Telemetry */}
        {telemetry && <TelemetryDisplay telemetry={telemetry} />}

        {/* Action log */}
        <ActionLog
          actions={takenActions}
          collapsed={actionLogCollapsed}
          onToggle={() => setActionLogCollapsed((v) => !v)}
        />

        {/* Actions */}
        {currentPhase && !isComplete && (
          <ActionPanel
            actions={currentPhase.available_actions}
            onAction={handleAction}
            disabled={actionLoading}
          />
        )}

        {/* Agent chat */}
        {hasAgent && !isComplete && (
          <AgentChatPanel
            messages={agentMessages}
            input={agentInput}
            onInputChange={setAgentInput}
            onSubmit={handleAgentSubmit}
            loading={agentLoading}
          />
        )}

        {/* Completion state (no debrief yet) */}
        {isComplete && !debrief && (
          <div className="rounded-xl border-2 border-green-500 bg-green-50 p-5 dark:border-green-400 dark:bg-green-950/30">
            <h3 className="text-base font-semibold text-green-800 dark:text-green-300">
              Simulation Complete
            </h3>
            <p className="mt-2 text-sm text-green-700 dark:text-green-400">
              Generating debrief...
            </p>
            <div className="mt-3 flex items-center gap-2">
              <div className="size-4 animate-spin rounded-full border-2 border-green-600 border-t-transparent" />
              <span className="text-sm text-green-700 dark:text-green-400">Processing</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  /* ---- Scroll-to-bottom button ---- */

  const scrollButton = !isAtBottom && (
    <button
      onClick={scrollToBottom}
      className="absolute bottom-4 left-1/2 z-10 flex size-9 -translate-x-1/2 cursor-pointer items-center justify-center rounded-full border border-border bg-background text-lg text-muted-foreground shadow-md"
      aria-label="Scroll to bottom"
    >
      &#8595;
    </button>
  );

  /* ---- Layout ---- */

  return (
    <div className="flex h-[calc(100dvh-56px)]" style={{ background: "var(--bg-base)" }}>
      {/* Main area */}
      <div className="relative flex flex-1 flex-col">
        {mainContent}
        {scrollButton}
      </div>

      {/* Tutor sidebar - desktop only (mobile uses overlay) */}
      {!isMobile && (
        <TutorSidebar
          observations={tutorObservations}
          open={true}
          onClose={() => {}}
          isMobile={false}
        />
      )}

      {/* Mobile tutor overlay */}
      {isMobile && (
        <TutorSidebar
          observations={tutorObservations}
          open={tutorOpen}
          onClose={() => setTutorOpen(false)}
          isMobile={true}
        />
      )}
    </div>
  );
}
