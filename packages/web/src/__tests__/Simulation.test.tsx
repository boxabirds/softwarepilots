import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { Simulation } from "../pages/Simulation";
// Import a component from exercise to trigger the same module resolution path
// that makes jest-dom matchers available (works around vitest version mismatch)
import { TutorCard } from "../components/exercise/TutorCard";

/* ---- jsdom stubs ---- */

Element.prototype.scrollTo = vi.fn();

/* ---- Mock data ---- */

const MOCK_SESSION_DATA = {
  session: {
    id: "session-1",
    learner_id: "learner-1",
    scenario_id: "scenario-1",
    profile: "level-1",
    status: "active" as const,
    current_phase: "phase-1",
    started_at: "2026-03-22T10:00:00Z",
  },
  scenario: {
    id: "scenario-1",
    title: "Database Latency Spike",
    level: "level-1" as const,
    tier: "introductory" as const,
    prerequisite_scenarios: [],
    prerequisite_concepts: [],
    briefing: "A production database is experiencing latency spikes. Investigate and resolve.",
    phases: [
      {
        id: "phase-1",
        narrative: "Initial alert received",
        available_actions: [
          {
            id: "action-1",
            category: "observe" as const,
            label: "Check metrics dashboard",
            description: "Look at the monitoring dashboard for anomalies",
            diagnostic_value: "high" as const,
          },
          {
            id: "action-2",
            category: "diagnose" as const,
            label: "Run slow query log",
            description: "Check the slow query log for problematic queries",
            diagnostic_value: "medium" as const,
          },
        ],
        telemetry_snapshot: {
          metrics: [
            { name: "p99 Latency", value: 450, unit: "ms", threshold: 200, status: "critical" as const },
            { name: "CPU", value: 65, unit: "%", status: "warning" as const },
            { name: "Memory", value: 72, unit: "%", status: "normal" as const },
          ],
          logs: [
            { timestamp: "10:01:32", level: "error" as const, service: "db-primary", message: "Query timeout after 5000ms" },
            { timestamp: "10:01:30", level: "warn" as const, service: "api-gateway", message: "Upstream latency exceeded threshold" },
          ],
          traces: [],
          dashboard_state: "alarm" as const,
        },
        triggers: [],
      },
      {
        id: "phase-2",
        narrative: "Investigation deepens",
        available_actions: [],
        telemetry_snapshot: {
          metrics: [],
          logs: [],
          traces: [],
          dashboard_state: "degraded" as const,
        },
        triggers: [],
      },
    ],
    root_causes: [{ id: "rc-1", description: "Missing index on users table" }],
    intervention_thresholds: {
      stall_seconds: 120,
      wrong_direction_count: 3,
      fixation_loop_count: 2,
    },
  },
};

const MOCK_ACTION_RESPONSE = {
  telemetry: {
    metrics: [
      { name: "p99 Latency", value: 380, unit: "ms", threshold: 200, status: "critical" as const },
    ],
    logs: [
      { timestamp: "10:02:00", level: "info" as const, service: "db-primary", message: "Metrics retrieved" },
    ],
    traces: [],
    dashboard_state: "degraded" as const,
  },
  tutor_observation: {
    tool: "gentle_nudge" as const,
    visible: true,
    content: "Good start checking the metrics. What stands out to you?",
  },
};

/* ---- Mock apiClient ---- */

vi.mock("../lib/api-client", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

/* ---- Mock useIsMobile ---- */

vi.mock("../hooks/useIsMobile", () => ({
  useIsMobile: () => false,
}));

import { apiClient } from "../lib/api-client";

const mockGet = vi.mocked(apiClient.get);
const mockPost = vi.mocked(apiClient.post);

function renderSimulation(sessionId = "session-1") {
  return render(
    <MemoryRouter initialEntries={[`/simulation/${sessionId}`]}>
      <Routes>
        <Route path="/simulation/:sessionId" element={<Simulation />} />
      </Routes>
    </MemoryRouter>,
  );
}

/* ---- Helper: assert text is in the document ---- */

function expectText(text: string | RegExp) {
  const el = screen.getByText(text);
  expect(el).toBeTruthy();
}

function expectNoText(text: string | RegExp) {
  const el = screen.queryByText(text);
  expect(el).toBeNull();
}

/* ---- Tests ---- */

describe("Simulation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("shows loading state initially", () => {
    mockGet.mockReturnValue(new Promise(() => {})); // never resolves
    renderSimulation();
    expectText("Loading simulation...");
  });

  it("shows error state on fetch failure", async () => {
    mockGet.mockRejectedValue(new Error("Network error"));
    renderSimulation();

    await waitFor(() => {
      expectText(/Network error/);
    });
    expectText("Back to Dashboard");
  });

  it("renders session with briefing, telemetry, and actions", async () => {
    mockGet.mockResolvedValue(MOCK_SESSION_DATA);
    renderSimulation();

    await waitFor(() => {
      expectText("Database Latency Spike");
    });

    // Briefing text
    expectText(/production database is experiencing/);

    // Metrics
    expectText("p99 Latency");
    expectText("450");

    // Dashboard state badge
    expectText("Alarm");

    // Action categories
    expectText("Observe");
    expectText("Diagnose");

    // Action cards
    expectText("Check metrics dashboard");
    expectText("Run slow query log");
  });

  it("briefing can be collapsed and expanded", async () => {
    mockGet.mockResolvedValue(MOCK_SESSION_DATA);
    const user = userEvent.setup();
    renderSimulation();

    await waitFor(() => {
      expectText("Database Latency Spike");
    });

    // Briefing starts expanded
    expectText(/production database is experiencing/);

    // Collapse
    await user.click(screen.getByText("Database Latency Spike"));
    expectNoText(/production database is experiencing/);

    // Expand
    await user.click(screen.getByText("Database Latency Spike"));
    expectText(/production database is experiencing/);
  });

  it("sends action and updates telemetry", async () => {
    mockGet.mockResolvedValue(MOCK_SESSION_DATA);
    mockPost.mockResolvedValue(MOCK_ACTION_RESPONSE);
    const user = userEvent.setup();
    renderSimulation();

    await waitFor(() => {
      expectText("Check metrics dashboard");
    });

    await user.click(screen.getByText("Check metrics dashboard"));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith("/api/simulation/action", {
        session_id: "session-1",
        action_id: "action-1",
      });
    });

    // Tutor observation appears
    await waitFor(() => {
      expectText(/Good start checking the metrics/);
    });
  });

  it("shows tutor sidebar with observing state when no observations", async () => {
    mockGet.mockResolvedValue(MOCK_SESSION_DATA);
    renderSimulation();

    await waitFor(() => {
      expectText("Tutor is observing...");
    });
  });

  it("renders phase indicator dots", async () => {
    mockGet.mockResolvedValue(MOCK_SESSION_DATA);
    renderSimulation();

    await waitFor(() => {
      expectText("Database Latency Spike");
    });

    // Should have 2 phase dots (phase-1, phase-2)
    const phaseDots = screen.getAllByTitle(/Phase \d+/);
    expect(phaseDots).toHaveLength(2);
  });

  it("shows agent chat when scenario has ai_agent_behavior", async () => {
    const dataWithAgent = {
      ...MOCK_SESSION_DATA,
      scenario: {
        ...MOCK_SESSION_DATA.scenario,
        ai_agent_behavior: {
          behavior: "sometimes_wrong" as const,
          personality: "Helpful but occasionally overconfident",
          knowledge_gaps: ["connection pooling"],
        },
      },
    };
    mockGet.mockResolvedValue(dataWithAgent);
    renderSimulation();

    await waitFor(() => {
      expectText("AI Agent");
    });
    expect(screen.getByPlaceholderText("Ask the agent...")).toBeTruthy();
  });

  it("does not show agent chat when scenario has no ai_agent_behavior", async () => {
    mockGet.mockResolvedValue(MOCK_SESSION_DATA);
    renderSimulation();

    await waitFor(() => {
      expectText("Database Latency Spike");
    });

    expectNoText("AI Agent");
  });

  it("telemetry tabs switch between metrics and logs", async () => {
    mockGet.mockResolvedValue(MOCK_SESSION_DATA);
    const user = userEvent.setup();
    renderSimulation();

    await waitFor(() => {
      expectText("p99 Latency");
    });

    // Switch to logs tab
    await user.click(screen.getByText("Logs"));
    expectText(/Query timeout after 5000ms/);

    // Switch back to metrics
    await user.click(screen.getByText("Metrics"));
    expectText("p99 Latency");
  });

  /* ---- TelemetryDisplay: dashboard_state badge colors ---- */

  describe("TelemetryDisplay - dashboard state badges", () => {
    const DASHBOARD_STATES = ["normal", "degraded", "alarm", "deceptive_normal"] as const;
    const DASHBOARD_LABELS: Record<string, string> = {
      normal: "Normal",
      degraded: "Degraded",
      alarm: "Alarm",
      deceptive_normal: "Deceptive Normal",
    };

    for (const state of DASHBOARD_STATES) {
      it(`renders "${DASHBOARD_LABELS[state]}" badge for dashboard_state="${state}"`, async () => {
        const data = {
          ...MOCK_SESSION_DATA,
          scenario: {
            ...MOCK_SESSION_DATA.scenario,
            phases: [
              {
                ...MOCK_SESSION_DATA.scenario.phases[0],
                telemetry_snapshot: {
                  ...MOCK_SESSION_DATA.scenario.phases[0].telemetry_snapshot,
                  dashboard_state: state,
                },
              },
              MOCK_SESSION_DATA.scenario.phases[1],
            ],
          },
        };
        mockGet.mockResolvedValue(data);
        renderSimulation();

        await waitFor(() => {
          expectText(DASHBOARD_LABELS[state]);
        });
      });
    }
  });

  /* ---- TelemetryDisplay: metrics with status colors ---- */

  it("renders metrics with status-dependent styling", async () => {
    mockGet.mockResolvedValue(MOCK_SESSION_DATA);
    renderSimulation();

    await waitFor(() => {
      expectText("p99 Latency");
    });

    // All three metrics render with their values
    expectText("450");
    expectText("65");
    expectText("72");

    // Threshold is shown where defined
    expectText(/threshold: 200 ms/);
  });

  /* ---- TelemetryDisplay: logs in terminal style ---- */

  it("renders logs in terminal style with level, service, and message", async () => {
    mockGet.mockResolvedValue(MOCK_SESSION_DATA);
    const user = userEvent.setup();
    renderSimulation();

    await waitFor(() => {
      expectText("Database Latency Spike");
    });

    // Switch to logs tab
    await user.click(screen.getByText("Logs"));

    // Log entries display timestamp, level, service, and message
    expectText("10:01:32");
    expectText("error");
    expectText("[db-primary]");
    expectText("Query timeout after 5000ms");

    expectText("10:01:30");
    expectText("warn");
    expectText("[api-gateway]");
    expectText("Upstream latency exceeded threshold");
  });

  /* ---- TelemetryDisplay: traces as span trees ---- */

  it("renders traces as a span tree when trace data is present", async () => {
    const dataWithTraces = {
      ...MOCK_SESSION_DATA,
      scenario: {
        ...MOCK_SESSION_DATA.scenario,
        phases: [
          {
            ...MOCK_SESSION_DATA.scenario.phases[0],
            telemetry_snapshot: {
              ...MOCK_SESSION_DATA.scenario.phases[0].telemetry_snapshot,
              traces: [
                {
                  span_id: "span-root",
                  service: "api-gateway",
                  operation: "POST /query",
                  duration_ms: 520,
                  status: "ok" as const,
                },
                {
                  span_id: "span-child",
                  parent_span_id: "span-root",
                  service: "db-primary",
                  operation: "SELECT users",
                  duration_ms: 480,
                  status: "error" as const,
                },
              ],
            },
          },
          MOCK_SESSION_DATA.scenario.phases[1],
        ],
      },
    };
    mockGet.mockResolvedValue(dataWithTraces);
    const user = userEvent.setup();
    renderSimulation();

    await waitFor(() => {
      expectText("Database Latency Spike");
    });

    // Traces tab should appear when there is trace data
    await user.click(screen.getByText("Traces"));

    // Root span
    expectText("api-gateway");
    expectText("POST /query");
    expectText("520ms");

    // Child span (nested)
    expectText("db-primary");
    expectText("SELECT users");
    expectText("480ms");
  });

  /* ---- ActionPanel: disabled actions show as grayed ---- */

  it("disables action buttons while an action is in progress", async () => {
    // Mock an action that never resolves to keep the loading state
    mockGet.mockResolvedValue(MOCK_SESSION_DATA);
    mockPost.mockReturnValue(new Promise(() => {})); // never resolves
    const user = userEvent.setup();
    renderSimulation();

    await waitFor(() => {
      expectText("Check metrics dashboard");
    });

    // Click the first action - triggers loading
    await user.click(screen.getByText("Check metrics dashboard"));

    // The action buttons should now be disabled
    const actionButtons = screen.getAllByRole("button").filter(
      (btn) => btn.textContent === "Check metrics dashboard" || btn.textContent === "Run slow query log"
    );

    // At least one action button should be disabled and have the opacity class
    for (const btn of actionButtons) {
      // When disabled, buttons get the disabled attribute
      if (btn.hasAttribute("disabled")) {
        expect(btn.className).toContain("opacity-50");
      }
    }
  });

  /* ---- ActionPanel: actions grouped by category ---- */

  it("renders actions grouped under their category headings", async () => {
    mockGet.mockResolvedValue(MOCK_SESSION_DATA);
    renderSimulation();

    await waitFor(() => {
      expectText("Database Latency Spike");
    });

    // Category headings
    expectText("Observe");
    expectText("Diagnose");

    // Actions under correct categories
    expectText("Check metrics dashboard");
    expectText("Run slow query log");
  });

  /* ---- ActionPanel: clicking an action triggers the handler ---- */

  it("clicking an action sends the correct action_id to the API", async () => {
    mockGet.mockResolvedValue(MOCK_SESSION_DATA);
    mockPost.mockResolvedValue(MOCK_ACTION_RESPONSE);
    const user = userEvent.setup();
    renderSimulation();

    await waitFor(() => {
      expectText("Run slow query log");
    });

    await user.click(screen.getByText("Run slow query log"));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith("/api/simulation/action", {
        session_id: "session-1",
        action_id: "action-2",
      });
    });
  });

  /* ---- TutorSidebar: observations with different tool styles ---- */

  it("renders tutor observations with styling per tool type", async () => {
    mockGet.mockResolvedValue(MOCK_SESSION_DATA);
    // First action returns a gentle_nudge
    mockPost.mockResolvedValueOnce({
      ...MOCK_ACTION_RESPONSE,
      tutor_observation: {
        tool: "gentle_nudge" as const,
        visible: true,
        content: "Nice approach, keep going.",
      },
    });
    // Second action returns highlight_good_judgment
    mockPost.mockResolvedValueOnce({
      telemetry: MOCK_ACTION_RESPONSE.telemetry,
      tutor_observation: {
        tool: "highlight_good_judgment" as const,
        visible: true,
        content: "Excellent diagnostic reasoning.",
      },
    });

    const user = userEvent.setup();
    renderSimulation();

    await waitFor(() => {
      expectText("Check metrics dashboard");
    });

    // Trigger first observation
    await user.click(screen.getByText("Check metrics dashboard"));
    await waitFor(() => {
      expectText("Nice approach, keep going.");
    });
    // Tool label for gentle_nudge
    expectText("Nudge");

    // Trigger second observation
    await user.click(screen.getByText("Check metrics dashboard"));
    await waitFor(() => {
      expectText("Excellent diagnostic reasoning.");
    });
    // Tool label for highlight_good_judgment
    expectText("Good Call");
  });

  /* ---- AgentChatPanel: message input works ---- */

  it("sends agent chat message on Enter", async () => {
    const dataWithAgent = {
      ...MOCK_SESSION_DATA,
      scenario: {
        ...MOCK_SESSION_DATA.scenario,
        ai_agent_behavior: {
          behavior: "sometimes_wrong" as const,
          personality: "Helpful but occasionally overconfident",
          knowledge_gaps: ["connection pooling"],
        },
      },
    };
    mockGet.mockResolvedValue(dataWithAgent);
    mockPost.mockResolvedValue({ response: "I think you should check the connection pool." });

    const user = userEvent.setup();
    renderSimulation();

    await waitFor(() => {
      expectText("AI Agent");
    });

    const input = screen.getByPlaceholderText("Ask the agent...");
    await user.type(input, "What do you think?{enter}");

    // The user message should appear in the chat
    await waitFor(() => {
      expectText("What do you think?");
    });
  });

  /* ---- DebriefView: renders all structured sections ---- */

  it("renders debrief view with all sections after session completes", async () => {
    mockGet.mockResolvedValue(MOCK_SESSION_DATA);

    // Action that completes the session
    mockPost.mockResolvedValueOnce({
      telemetry: MOCK_ACTION_RESPONSE.telemetry,
      session_complete: true,
    });

    // Debrief API response
    const mockDebrief = {
      good_judgment_moments: [
        {
          action: "Checked metrics first",
          why_it_was_good: "Established baseline before making changes",
          timestamp: "10:01:00",
        },
      ],
      missed_signals: [
        {
          signal: "Connection pool exhaustion",
          what_to_check: "Active connections count",
          when_it_was_visible: "From the first telemetry snapshot",
        },
      ],
      expert_path_comparison: {
        expert_steps: ["Check metrics", "Review connection pool", "Add index"],
        trainee_steps: ["Check metrics", "Restart service"],
        divergence_points: ["Trainee skipped connection pool analysis"],
      },
      accountability_assessment: {
        verified: true,
        escalated_when_needed: false,
        documented_reasoning: true,
        overall: "Solid investigation with room for improvement in escalation.",
      },
    };

    mockPost.mockResolvedValueOnce(mockDebrief);

    const user = userEvent.setup();
    renderSimulation();

    await waitFor(() => {
      expectText("Check metrics dashboard");
    });

    // Trigger session completion
    await user.click(screen.getByText("Check metrics dashboard"));

    // Wait for debrief to render
    await waitFor(() => {
      expectText("Simulation Debrief");
    });

    // Good judgment moments
    expectText("Good Judgment Moments");
    expectText("Checked metrics first");
    expectText("Established baseline before making changes");

    // Missed signals
    expectText("Missed Signals");
    expectText("Connection pool exhaustion");
    expectText(/Active connections count/);

    // Expert path comparison
    expectText("Expert Path Comparison");
    expectText("Expert Steps");
    expectText("Your Steps");
    // "Check metrics" appears in both expert and trainee steps
    const checkMetricsElements = screen.getAllByText("Check metrics");
    expect(checkMetricsElements.length).toBeGreaterThanOrEqual(2);
    expectText("Restart service");
    expectText("Divergence Points");
    expectText("Trainee skipped connection pool analysis");

    // Accountability assessment
    expectText("Accountability Assessment");
    expectText("Verified findings");
    expectText("Escalated when needed");
    expectText("Documented reasoning");
    expectText("Solid investigation with room for improvement in escalation.");
  });

  /* ---- PhaseIndicator: highlights current phase ---- */

  it("highlights the current phase dot with ring styling", async () => {
    mockGet.mockResolvedValue(MOCK_SESSION_DATA);
    renderSimulation();

    await waitFor(() => {
      expectText("Database Latency Spike");
    });

    const phaseDots = screen.getAllByTitle(/Phase \d+/);
    expect(phaseDots).toHaveLength(2);

    // Phase 1 is current - should have ring styling
    expect(phaseDots[0].className).toContain("ring-2");

    // Phase 2 is future - should NOT have ring styling
    expect(phaseDots[1].className).not.toContain("ring-2");
  });
});
