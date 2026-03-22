# Plan: Integrate Accountability + Simulation into Software Pilots

## Context

The project teaches software pilotry through Socratic tutoring and code exercises. Two concepts from the research document need integrating:

1. **Accountability as the invariant** - currently siloed in Module 3 ("The Accountable Human") of each curriculum. The research reframes it as the core thread running through everything.
2. **Interactive outage simulation** - a new subsystem where trainees diagnose failures in customised scenarios while the tutor observes and provides feedback.

The Software Pilots stack is Cloudflare-only (Workers, D1, Hono, Gemini). However, the Smithers project (`/Users/julian/expts/smithers`) provides reusable Hetzner Cloud infrastructure patterns - provisioning scripts, Docker Compose orchestration, Cloudflare Tunnel exposure. A separate Hetzner VPS (cx32, 8GB RAM, ~EUR5/month) can host OTel Demo + Grafana for live simulation scenarios.

---

## Outcome 1: Enriched Curriculum

### 1a. Create Level 0 curriculum document

**Create** `docs/curricula/level-0.md`

The TypeScript code exists ([level-0.ts](packages/shared/src/curricula/level-0.ts)) with thin placeholder content (~1 paragraph per section). Write a full curriculum document matching the depth of the L1/L10/L20 docs. Content from research doc Section 2.2 + 4.3:

- Accountability at its simplest (medical student analogy - not yet accountable, building foundations)
- Basic systems vocabulary (server, database, API, deployment)
- How to read dashboards and logs (prerequisite for simulation scenarios S0.x)
- Diagnostic reasoning introduction (observe before acting)
- K8sGames graduation criteria as concrete learning objectives

### 1b. Thread accountability through all three existing curricula

**Modify** `docs/curricula/new-grad.md`, `veteran-engineer.md`, `senior-tech-leader.md`

For each curriculum:
- Add accountability framing paragraph at the top of each Module 1 and Module 2 section (not just Module 3). E.g. for new-grad 1.1 ("How Software Actually Breaks"): "When agent-generated code breaks in production, you answer the question 'why did this happen?' This section builds the diagnostic skill that makes that accountability substantive."
- Rename Module 3 from "The Accountable Human" to "Accountability in Practice" - signalling it's the culmination, not the introduction, of the accountability thread
- Tag each section with its durability layer (A=Foundation/permanent, B=Systems/annual, C=Practice/quarterly)

### 1c. Add "Before You Specify" section

**Add** new section to each curriculum (research doc Section 2.4):

- New-grad: Section 1.4 - design thinking basics (who is this for, constraints, tradeoffs, failure modes)
- Veteran: Section 1.4 - design thinking at system scale (extends existing 1.2 "Architecture as Specification" with "why" documentation)
- Senior leader: strengthen existing 1.1 risk landscape with design rationale governance

### 1d. Add verification checklists

**Add** the three-tier verification checklist from research doc Section 2.5 to each curriculum:

- Standard verification (8 checks for all agent-generated code)
- Elevated verification (5 additional checks for business logic/customer-facing)
- Critical verification (5 additional for security/financial/regulatory)

New-grad: as a new section 2.4 "Verification as a Practice"
Veteran: integrated into existing 3.2 "Verification Strategy"
Senior leader: organisational verification gates in 1.2 "Quality Architecture"

### 1e. Add simulation readiness markers

**Add** to each curriculum a closing section noting which simulation scenarios it prepares for, per the research doc Section 5.3:

- L0: S0.1-S0.4 (guided tours, first solo diagnosis)
- L1: S1.1-S1.5 (diagnostic challenges with agent interactions)
- L10: S10.1-S10.5 (delegation, calibration, identity)
- L20: S20.1-S20.5 (organisational decisions)

### 1f. Update shared TypeScript definitions

**Modify** [curricula.ts](packages/shared/src/curricula.ts)

```typescript
// Add optional fields to CurriculumMeta
export interface CurriculumMeta {
  // ... existing fields ...
  accountability_scope?: string;  // "learning" | "single-app" | "system-of-services" | "org-practices"
}

// Add optional fields to section shape in CurriculumData
sections: {
  // ... existing fields ...
  simulation_scenarios?: string[];  // ["S0.1", "S1.1"] etc.
}[];
```

**Modify** [level-0.ts](packages/shared/src/curricula/level-0.ts) - expand placeholder content to match markdown doc depth (~500-1000 words per section)

**Modify** `new-grad.ts`, `veteran.ts`, `senior-leader.ts` - add `accountability_scope` to meta, add new sections matching markdown changes, add `simulation_scenarios` arrays to relevant sections

### 1g. Update Socratic tutor for accountability awareness

**Modify** [socratic-chat.ts](packages/api/src/routes/socratic-chat.ts)

System prompt additions:
- Accountability context block using `accountability_scope` from meta
- Simulation scenario references when `simulation_scenarios` are present on a section

New tools (extend `buildSocraticTools`):
- `accountability_probe` - asks learner to connect a technical concept to their accountability scope (dimensions: diagnosis, verification, escalation, sign_off)
- `simulation_readiness_check` - assesses whether learner is ready for a related simulation scenario (readiness: not_ready/approaching/ready, with gaps and recommendation)

---

## Outcome 2: Simulation Subsystem

### Architecture: Narrative Simulation (Phase 1)

Phase 1 is text-based interactive scenarios with synthetic telemetry - not live infrastructure. The trainee receives a briefing, views synthetic dashboards/logs/traces rendered as formatted text, takes diagnostic actions, and the tutor observes and intervenes. This runs entirely on Cloudflare Workers + D1.

The key insight from the research: "Score diagnostic reasoning quality, not time-to-resolution." The highest-value training is decision-making under ambiguity, not tool manipulation.

### 2a. Scenario definition format

**Create** `packages/shared/src/simulation/` with types and scenario data:

```typescript
interface SimulationScenario {
  id: string;                          // "S0.4", "S1.1", etc.
  title: string;
  level: LearnerProfile;
  tier: 'introductory' | 'intermediate' | 'advanced' | 'expert';
  prerequisite_scenarios: string[];
  prerequisite_concepts: string[];
  briefing: string;                    // initial situation
  phases: SimulationPhase[];           // branching phases with synthetic telemetry
  root_causes: RootCause[];           // what is actually wrong
  ai_agent_behavior?: AIAgentConfig;  // how the simulated AI assistant behaves
  intervention_thresholds: InterventionThresholds;  // per research doc Section 6.3
}

interface SimulationPhase {
  id: string;
  narrative: string;
  available_actions: SimulationAction[];  // observe/diagnose/act/communicate/delegate
  telemetry_snapshot: TelemetrySnapshot;  // synthetic metrics + logs + traces
  triggers: PhaseTrigger[];              // conditions that advance phases
}

interface TelemetrySnapshot {
  metrics: MetricDataPoint[];          // synthetic Prometheus-style
  logs: LogEntry[];                    // synthetic log lines
  traces?: TraceSpan[];               // synthetic distributed traces
  dashboard_state: 'normal' | 'degraded' | 'alarm' | 'deceptive_normal';
}
```

Each action has a `diagnostic_value` rating (high/medium/low/misleading) and an optional phase transition trigger.

### 2b. MVP scenarios (3 fully authored scenarios covering L0, L1, L10)

Author three complete scenarios with full branching phases, synthetic telemetry, and AI agent behaviour, following research doc Section 5.3:

1. **S0.4 "First Solo Diagnosis"** - single service, obvious failure, trainee must observe before acting. Dashboard shows clear error. Tests diagnostic-first habit. No AI agent. Tutor intervenes after 60s stall.
2. **S1.1 "The False Green Test Suite"** - concurrency bug, tests pass, agent misdiagnoses as a caching issue. Gray failure pattern (dashboard looks almost normal, p99 latency creeping). Tests verification discipline and agent trust calibration. AI agent: `sometimes_wrong`. Tutor intervenes if agent output accepted without verification.
3. **S10.1 "Agent-Assisted Diagnosis"** - cascading gray failure across 3 services (payment -> inventory -> frontend). Agent is confidently wrong (blames database, actual cause is connection pool exhaustion from retry storm). Tests delegation decisions and independent reasoning. AI agent: `confidently_wrong`. Tutor intervenes on fixation loop (same question 3+ times).

### 2c. Database schema

**Create** migration `0008_simulation.sql`:

```sql
CREATE TABLE simulation_sessions (
  id            TEXT PRIMARY KEY,
  learner_id    TEXT NOT NULL REFERENCES learners(id),
  scenario_id   TEXT NOT NULL,
  profile       TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'active',  -- active/completed/abandoned
  current_phase TEXT NOT NULL,
  started_at    TEXT DEFAULT (datetime('now')),
  completed_at  TEXT,
  debrief_json  TEXT
);

CREATE TABLE simulation_events (
  id            TEXT PRIMARY KEY,
  session_id    TEXT NOT NULL REFERENCES simulation_sessions(id),
  event_type    TEXT NOT NULL,  -- action/observation/tutor_intervention/agent_query/communication
  event_data    TEXT NOT NULL,
  created_at    TEXT DEFAULT (datetime('now'))
);
```

### 2d. Simulation API routes

**Create** `packages/api/src/routes/simulation.ts`:

- `POST /api/simulation/start` - begin scenario, return briefing + initial phase + available actions
- `POST /api/simulation/action` - take an action, receive result + updated telemetry + optional tutor observation
- `POST /api/simulation/ask-agent` - query the simulated AI diagnostic agent (uses Gemini with a "sometimes wrong" system prompt based on scenario's `ai_agent_behavior`)
- `POST /api/simulation/debrief` - end scenario, generate tutor debrief
- `GET /api/simulation/session/:id` - resume or review a session

### 2e. Simulation tutor (observation + intervention)

After each trainee action, call Gemini with:
- Full action log with timestamps
- Scenario's correct diagnostic path
- Current phase telemetry
- Intervention thresholds from research doc Section 6.3

Simulation-specific Gemini tools:
- `observe_silently` - trainee making progress, no intervention
- `gentle_nudge` - hint when stuck or heading wrong direction
- `direct_intervention` - guidance when stuck too long or about to make critical error
- `highlight_good_judgment` - acknowledge excellent diagnostic decision
- `accountability_moment` - probe at decision points where accountability matters

### 2f. Simulation web UI

**Create** `packages/web/src/pages/Simulation.tsx`:

- Briefing panel (scenario context)
- Telemetry display (text-rendered synthetic dashboard/logs/traces - styled to resemble real observability tools)
- Action panel (available actions as cards, grouped by category)
- Tutor observation sidebar (tutor comments appear as the trainee progresses)
- AI agent chat panel (L1+ only, for querying the simulated diagnostic agent)
- Phase/progress indicator

Route: add to React Router in App.tsx

### 2g. Debrief system

Post-scenario debrief generated by Gemini following research doc Section 6.4:
- Moments of good judgment (specific praise)
- Missed signals (specific guidance on what to check earlier)
- Comparison to expert diagnostic path
- Progression tracking (comparison to previous attempts at same scenario type)
- Accountability assessment (did they verify, escalate, document reasoning)

Stored in `simulation_sessions.debrief_json` and displayed in a dedicated debrief view.

### 2h. K8sGames integration (lightweight)

Phase 1: link from L0 curriculum to k8sgames.com with self-report progress mechanism. No fork, no instrumentation. Full K8sGames integration (fork + event hooks) is Phase 2.

---

## Outcome 3: Live Simulation Infrastructure (Phase 2)

Using Smithers' Hetzner provisioning patterns, deploy a dedicated simulation VPS:

### 3a. Simulation VPS provisioning

**Create** `scripts/simulation/` in the softwarepilots repo, adapted from Smithers' `scripts/provision.sh`:

- `provision-sim.sh` - provisions a Hetzner cx32 (8GB RAM) with Docker Compose
- `deploy-sim.sh` - deploys OTel Demo + Grafana + simulation bridge
- `teardown-sim.sh` - destroys when not needed (cost control)

Key differences from Smithers setup:
- Server type: `cx32` (8GB RAM) instead of `cx22` (4GB) - OTel Demo minimum
- Firewall: allow Cloudflare Tunnel ingress (Grafana + bridge API)
- Cloud-init installs Docker + Docker Compose (same pattern)
- Cloudflare Tunnel exposes Grafana dashboards to trainees

### 3b. OTel Demo deployment

Docker Compose config for OTel Demo minimal deployment (excludes Kafka, Accounting, Fraud Detection):
- 15+ instrumented microservices (Go, Java, Python, Node.js, etc.)
- Grafana with pre-built dashboards
- Prometheus for metrics, Loki for logs, Tempo for traces
- Locust load generator with configurable profiles
- Feature flags (flagd) for toggling built-in failure scenarios

Exposed via Cloudflare Tunnel:
- `sim-grafana.softwarepilots.dev` - trainee-facing Grafana (read-only viewer role)
- `sim-bridge.softwarepilots.dev` - bridge API for the platform to inject faults and read state

### 3c. Simulation bridge service

**Create** a lightweight Node.js service (runs alongside OTel Demo on the VPS):

- Receives fault injection commands from the Software Pilots API
- Translates to OTel Demo feature flag toggles and/or Toxiproxy rules
- Reads Prometheus metrics and Loki logs, formats as `TelemetrySnapshot`
- Captures trainee Grafana activity (which panels viewed, queries run) via Grafana API
- Exposes HTTP API authenticated with bearer token

This bridge is the "Layer 5 - Orchestration Bridge" from the research doc. It connects scenario state to fault injection to telemetry.

### 3d. Upgraded simulation scenarios

With live infrastructure, L1+ scenarios switch from synthetic to real telemetry:
- Same `SimulationScenario` type, but `TelemetrySnapshot` populated from real Prometheus/Loki
- Trainee views actual Grafana dashboards (opened in new tab/iframe)
- Bridge service injects faults per scenario phase definitions
- Tutor observation enriched with Grafana activity data

The `TelemetrySnapshot` interface abstracts whether data is synthetic or real - no schema changes needed.

### 3e. Cost model

- Hetzner cx32: ~EUR5.50/month (or spun up on-demand for workshops)
- OTel Demo resource usage is fixed (doesn't scale with trainee count)
- Grafana supports multiple concurrent viewers
- Recommended: instructor-led sessions (one scenario running, all trainees view same dashboards)

### Phase 3+ (future)

- **K8sGames fork** with event hooks piping to the bridge via WebSocket
- **Chaos Mesh/LitmusChaos** for K8s-native fault injection (requires K3s on the VPS)
- **MiroFish** behavioural load bridge (separate GPU-equipped VPS, ~EUR30/month with Ollama)
- **Durable Objects** for real-time WebSocket connections from the platform to the bridge

---

## Implementation sequence

### Stream A: Curriculum enrichment (can start immediately)

| Step | What | Files |
|------|------|-------|
| A1 | Create L0 curriculum doc | `docs/curricula/level-0.md` |
| A2 | Thread accountability + add new sections to all curriculum docs | `docs/curricula/*.md` |
| A3 | Extend shared types (optional fields, no breaking changes) | `packages/shared/src/curricula.ts` |
| A4 | Expand L0 TypeScript content + update all curriculum TS files | `packages/shared/src/curricula/*.ts` |
| A5 | Add accountability tools to Socratic tutor | `packages/api/src/routes/socratic-chat.ts` |

A1-A2 can run in parallel. A3-A5 are sequential.

### Stream B: Narrative simulation (can start immediately, parallel to Stream A)

| Step | What | Files |
|------|------|-------|
| B1 | Create simulation types + scenario definitions | `packages/shared/src/simulation/` (new) |
| B2 | Add simulation DB migration | `packages/api/src/db/migrations/0008_simulation.sql` |
| B3 | Create simulation API routes | `packages/api/src/routes/simulation.ts` |
| B4 | Create simulation tutor logic | `packages/api/src/routes/simulation-tutor.ts` |
| B5 | Create simulation web UI | `packages/web/src/pages/Simulation.tsx` + components |
| B6 | Add simulation route to App.tsx | `packages/web/src/App.tsx` |

B1-B6 are sequential.

### Stream C: Live simulation infrastructure (after B1 types are defined)

| Step | What | Files |
|------|------|-------|
| C1 | Create simulation provisioning scripts (adapt from Smithers) | `scripts/simulation/provision-sim.sh`, `deploy-sim.sh`, `teardown-sim.sh` |
| C2 | OTel Demo Docker Compose config (minimal deployment) | `scripts/simulation/docker-compose.yml` |
| C3 | Simulation bridge service | `scripts/simulation/bridge/` (Node.js service on VPS) |
| C4 | Upgrade L1+ scenarios to use live telemetry via bridge | `packages/shared/src/simulation/scenarios/` |

C1-C2 can run in parallel. C3 depends on C2 + B1 (needs types). C4 depends on C3 + B3 (needs bridge + API).

## Verification

- `bun run typecheck` across all packages after type changes (A3-A4)
- Existing Socratic chat tests pass after tool additions (A5)
- New simulation routes testable via HTTP with `bun run dev` (B2-B4)
- Visual verification of simulation UI in browser (B5)
- End-to-end: start a simulation session, take actions, receive tutor feedback, complete debrief
- For Stream C: `ssh` into VPS, verify OTel Demo containers running, Grafana accessible via tunnel
