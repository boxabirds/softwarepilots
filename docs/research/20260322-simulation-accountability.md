# Software Pilotry: Consolidated Design Document

> **Status**: Research and design synthesis from extended working session, March 2026.
> **Purpose**: Serve as the authoritative reference for two workstreams: (1) evolving the Pilotry curriculum to centre on accountability and trust, and (2) designing simulations-as-experience across all trainee levels.
> **Audience**: Claude Code or equivalent agent picking up development of curricula, simulator architecture, and tutoring systems.

---

## 1. Core Thesis — Accountability as the Invariant

### 1.1 The Fundamental Insight

Agents have no consequences. You cannot sue an AI agent. You cannot revoke its licence. If agent-generated software loses customer data, the agent experiences nothing. Consequences only land on humans. Therefore, every software system that matters needs a human in the accountability chain — not because humans are better at building, but because humans are the only entity that can bear responsibility.

Software Pilotry is the professional practice of being accountable for software systems, regardless of how they were created.

### 1.2 The Accountability Analogy

The model is the trusted professional advisor:

- "I have a good lawyer" — the lawyer doesn't participate in every decision. They may be called twice a year. But when they're called, they bring expertise the client can't replicate and willingness to be accountable for their advice. Their professional reputation is behind every assessment.
- "I have a good tech guy" — this relationship already exists everywhere but is currently informal, uncredentialed, and the accountability is fuzzy. Pilotry is the professionalisation of this relationship.

The label "Software Pilot" may or may not stick. The substance is what matters: a defined body of knowledge, a training pathway that builds substantive competence, and a practice framework that makes accountability real rather than implied.

### 1.3 What Makes Accountability Substantive

Nominal accountability ("my name is on it") is not sufficient. Substantive accountability means the person can:

- Diagnose what's wrong when it breaks
- Verify whether something is trustworthy before it ships
- Know when they're out of their depth and need to escalate
- Stand behind their assessment and accept consequences if it's wrong

The training exists to build that substantive accountability. The simulations exist to test it under pressure.

---

## 2. Curriculum Architecture

### 2.1 Three-Layer Structure (Durability Model)

The curriculum is structured in three layers with different refresh cadences:

**Layer A — Foundation (permanent, 5+ year shelf life)**

What is accountability in software? What does it mean to be the person who signs off? What's the minimum understanding required to be substantively accountable? How do you know when you're out of your depth? This is the equivalent of medical ethics and professional responsibility. It does not change with technology.

Contents: accountability frameworks, professional responsibility, risk assessment, communication under pressure, design rationale documentation, the "why" behind systems.

**Layer B — Systems Understanding (durable, updated annually)**

How software works, how it breaks, how systems interact, what failure looks like. This is the "bullshit detector" training — the deep knowledge that lets a doctor know when ChatGPT's diagnosis is wrong, or a lawyer know when the AI-drafted clause creates liability. For Software Pilots, it's the knowledge that lets you look at a broken system and form a correct hypothesis, even if you didn't build it.

Contents: how software breaks (concurrency, resource exhaustion, network failures), systems thinking (latency, throughput, backpressure, cascading failures), security fundamentals, the nature of outages (from research — see Section 5), distributed systems failure modes, gray failures and differential observability.

**Layer B is explicitly resilient to agent improvement.** Even if agents become flawless code generators, understanding how systems fail remains necessary for the person who is accountable when they do fail.

**Layer C — Current Practice (refreshed quarterly)**

Which tools exist, how they work, what their failure modes are, how to verify their output, how to specify work for them. This is the perishable layer.

Contents: specific agent tools and their characteristics, prompt engineering techniques, current failure mode catalogs ("agents consistently fail at X"), tool-specific verification checklists, current best practices for specification.

**Design principle**: Layer C content can be swapped without affecting Layers A or B. The curriculum framework is durable; the tool-specific content is expected to change.

### 2.2 Levels as Scopes of Accountability

Levels map to the scope of what a person is competent to be accountable for:

| Level | Scope of Accountability | Real-World Analog |
|---|---|---|
| L0 | Learning — not yet accountable for anything in production | Medical student |
| L1 | A single application — "I can tell you whether it's working, whether it's secure enough, and what's wrong when it breaks" | Junior doctor under supervision |
| L10 | A system of services — "I can tell you how they interact, where the failure points are, and how to fix them under pressure" | Experienced GP / specialist |
| L20 | An organisation's software practices — "I can tell you whether your teams are building responsibly, where your systemic risks are, and how to structure processes for quality" | Medical director / hospital board advisor |

Each level is not just more knowledge — it is a wider scope of what the person is willing and competent to put their name behind.

### 2.3 The Vibe Coding / Desktop Agent Fork

There is a fundamental split in how people create software with AI that the curriculum must address:

**Path A — Vibe coding tools (v0, Lovable, Replit, Bolt, etc.)**

The user types a description, something appears, they click deploy. The code exists but they may never see it. The failure mode is: "I deployed something I fundamentally don't understand, and when it breaks I have no ability to diagnose or fix it."

The curriculum for this path does not teach code review. It teaches:

- What questions to ask before deploying (where is my data stored? who can access it? what happens at 100x traffic? what are the ongoing costs?)
- What to monitor after deploying (is it running? are there errors? is it costing what I expected?)
- When to call the pilot ("I can see errors but don't know what they mean" / "the agent suggests a fix but I'm not confident" / "a customer reported something I don't understand")
- What accountability means when you didn't write the code (you're still responsible for the outcome; you need to either understand the system or retain someone who does)

This is "informed client" training — it defines the accountability boundary between business owner and Software Pilot.

**Path B — Desktop coding agents (Claude Code, Codex, Cursor, Kiro, etc.)**

The user writes specifications, delegates to agents, reviews output, and ships. They see the code. The failure mode is: "I accepted agent output without adequate verification."

This is the path the existing curricula address. The curriculum teaches specification, verification, trust calibration, and intervention judgment.

**The connection**: a vibe-coding business owner who grows beyond what agents can self-manage needs a Path B person — a Software Pilot — to retain. Path A training teaches you when to call that person. Path B training teaches you how to be that person.

### 2.4 The "Before You Specify" Gap

The current curricula treat specification as a technical skill (how to write a precise spec for an agent). What's missing is the design thinking that produces the spec in the first place.

**Module 0 — Before You Specify** (proposed, all levels):

- Who is this for and what problem does it solve? (user understanding)
- What are the constraints? (technical, business, regulatory)
- What tradeoffs are you making and why? (design rationale)
- What does success look like? (acceptance criteria)
- What happens when things go wrong? (failure modes, not just happy paths)

This module addresses the most common complaint: "the agent built the wrong thing." The agent built exactly what was specified — the specification was wrong because the thinking behind it was incomplete.

**Design rationale documentation** is a key durability skill. The reason legacy code is hard to work with is that the "why" has been lost. Teaching people to document why, not just what, becomes more important as agents generate more of the what.

### 2.5 Verification as a Concrete Practice

The curricula cover verification conceptually but need practical tooling. A verification checklist that adapts by risk level:

**Standard verification (all agent-generated code):**

1. Run linter and type checker — does it pass?
2. Run tests — do they pass?
3. Read the tests — do they verify requirements or just exercise the code?
4. Check test coverage — are critical paths covered?
5. Check for hardcoded secrets (API keys, passwords, connection strings)
6. Check dependencies — are they real, maintained, and necessary?
7. Review error handling — does it handle errors or swallow them?
8. Test with unexpected input — empty, maximum, malformed, concurrent

**Elevated verification (business logic, customer-facing, data transformations):**

9. Trace execution paths for key scenarios manually
10. Verify against specification — does every requirement have corresponding implementation?
11. Check hidden assumptions — what does the code assume about its environment?
12. Test at boundary conditions — zero, one, many, maximum, negative
13. Verify data model matches specification exactly

**Critical verification (security, financial, data deletion, regulatory):**

14. Independent security review (IDOR, injection, auth/authz, secrets)
15. Adversarial testing — attempt to abuse every input and endpoint
16. Two independent reviewers sign off
17. Property-based testing for invariants
18. Production monitoring for output distribution shifts

The checklist adapts by tool class (vibe coding output needs different checks than desktop agent output) and by risk level. The curriculum teaches the checklist; the simulation tests whether trainees follow it under pressure.

### 2.6 Shelf Life and Resilience Strategy

**Will be obsolete within 12-18 months:**

- Specific prompt engineering techniques and syntax
- Specific failure mode catalogs ("agents consistently fail at X")
- Tool-specific workflows and UI guidance
- Current-state capability assessments ("agents can/can't do Y")

**Durable for 3-5+ years:**

- Specification discipline (define before you build)
- Systems thinking (how software breaks)
- Accountability frameworks (who is responsible)
- Verification as a discipline (don't trust, verify)
- Judgment and calibration (when to trust automation, when to intervene)
- Design rationale documentation (the "why")

**The biggest threat to shelf life**: agents getting better at verification. If agents can reliably review their own output for security, correctness, and spec conformance, then verification shifts from "do it yourself" to "ensure the verification agent is adequate and intervene when it isn't." The curriculum should frame verification as a responsibility, not a manual activity — the pilot ensures verification happens and is adequate, regardless of who or what performs it.

**Resilience design**: Layer C (current practice) gets a quarterly review. Layer B (systems understanding) gets an annual review. Layer A (foundation) is written to be permanent. Simulation scenarios mirror this — principle scenarios (diagnose a failure, evaluate a spec) are permanent; practice scenarios (use a specific tool) get refreshed.

---

## 3. The Nature of Outages — Research Findings

These findings from the research literature directly inform scenario design for the simulator. All data sources are open/public.

### 3.1 Key Statistical Parameters

| Parameter | Value / Distribution | Source |
|---|---|---|
| Incident duration distribution | Log-normal (positively skewed, median ≪ mean) | VOID Report |
| Cloud workload failure times | Gamma distribution | Birke et al. / Google Cluster Traces |
| Enterprise outage frequency | Median 232/year across all severities | New Relic Observability Forecast 2024 |
| Data centre outage rate | 18.33% of data centres per year | Uptime Institute 2025 |
| Root cause: configuration/human error | 41-80% of incidents | Cross-source aggregate |
| Root cause: network/DNS | 27-35% | New Relic / aggregate |
| Root cause: software deployment | 14-27% | New Relic / aggregate |
| Root cause: hardware | ~8% | Uptime Institute |
| MTTD (high-impact) | Median 37 minutes | New Relic 2024 |
| MTTR (high-impact) | Median 51 minutes | New Relic 2024 |
| Extreme cloud outage annual probability | 3.32% (major), 0.50% (severe), 0.12% (extreme) | Lloyd's of London |

### 3.2 Critical Research Findings for Scenario Design

**Duration tells you almost nothing useful.** The VOID database (~10,000 incidents from ~600 orgs) found no correlation between incident duration and severity. 53% of incidents resolve in under 2 hours. The distribution is so skewed that MTTR is statistically unreliable. Implication for simulator: don't use time-to-resolution as the primary training metric. Score diagnostic reasoning quality instead.

**The most dangerous failures are invisible to monitoring.** Gray failures (Huang et al., Microsoft Research, HotOS 2017) are behind most cloud incidents. The defining characteristic is differential observability: monitoring says the system is healthy while users experience degradation. Gray failures evolve temporally: latent fault → gray failure (externally visible, monitoring blind) → complete failure (monitoring finally detects). Implication for simulator: the highest-value training scenarios are where dashboards look almost normal while something is deeply wrong.

**Metastable failures are the hardest to diagnose.** (Bronson et al., HotOS 2021) A metastable failure occurs when a trigger causes the system to enter a bad state that persists even after the trigger is removed. The root cause is the sustaining feedback loop, not the trigger. Common sustaining mechanisms: retry storms, cache stampedes, slow error handling paths, load balancer emergent behaviour. Implication for simulator: scenarios where the system is "down but up" — stable, but not doing useful work — are the most realistic and most challenging.

**The fix often causes the next outage.** Gunawi et al. (COS study, 597 outages across 32 services) found: software upgrades are one of the most common causes of outages. Recovery itself is dangerous — recovery storms overload the system, and cross-service dependencies mean fixing one service triggers failures in others. Automation can exacerbate rather than alleviate problems (VOID 2024 report). Implication for simulator: scenarios where the trainee's fix makes things worse are realistic and high-value.

**Outages don't have a single root cause.** The "No-SPOF principle" fails because it's not just about redundancy — it requires perfect failure detection, flawless failover code, and working backup components. Cascading bugs (same software logic in all redundant nodes) make failover impossible. Only ~25% of incident reports even attempt root cause analysis. Implication for simulator: scenarios should have multiple contributing factors, not a single injected fault.

**There is no correlation between duration and severity.** Companies can have long incidents that are trivial and short incidents that are existential. Implication for simulator: vary scenario difficulty independently of scenario duration.

### 3.3 Scale-Dependent Failure Modes

The simulator's scenarios must be credible at the infrastructure scale they run on. Different failure modes require different scales:

**Tier 1 — Single process (1 server, 1 app):** Resource exhaustion (memory leak, disk full, file descriptor exhaustion). Diagnostically trivial. Good for L0/early L1 scenarios.

**Tier 2 — Small distributed (3-15 services, 1-3 nodes):** This is the OTel Demo's sweet spot and the simulator's primary operating scale. Enables: partial failures, cascading timeouts, retry storms, connection pool exhaustion, gray failures, the full diagnostic complexity of correlating signals across multiple services.

**Tier 3 — Medium distributed (50-200 services):** Thundering herds, hot-key problems, split-brain, consensus failures, full metastable failure patterns. Mostly cannot be reproduced on single-node Docker Compose. Can be narrated in scenarios while demonstrating the underlying mechanics at Tier 2 scale.

**Tier 4 — Large scale (1000+ services, multi-region):** Cross-region replication lag, DNS propagation, certificate expiry cascades, correlated failures from shared infrastructure. Impossible to simulate on small infrastructure. Handled through narrative + decision-making scenarios (L20).

**Key insight from metastable failures research**: feedback loops that cause metastable failures work at any scale where there's a feedback mechanism (retry logic, circuit breakers, caches, connection pools). A deliberately constrained system lowers the threshold at which these failures trigger, making them achievable with much less traffic. This is the theoretical justification for the simulator's "small system, realistic failures" approach.

---

## 4. Simulator Architecture — Open Source Only

### 4.1 Five-Layer Stack

All components are open source. No commercial dependencies.

```
Layer 1 — SCENARIO ENGINE (narrative + branching)
  Wheel of Misfortune v5 (Apache-2.0) + Ink scripting (MIT) + Jsonnet (Apache-2.0)

Layer 2 — FAILURE PROBABILITY MODEL (what breaks, when)
  Google Cluster Traces (CC-BY) + VOID + pgmpy (MIT) + PFTA (GPL-3.0)

Layer 3 — FAULT INJECTION (make it break)
  Chaos Mesh (Apache-2.0) or LitmusChaos (Apache-2.0)
  + Chaos Toolkit (Apache-2.0) as API abstraction
  + Toxiproxy (MIT) for non-K8s network simulation

Layer 4 — SYNTHETIC TELEMETRY + DASHBOARDS (make it visible)
  OpenTelemetry Demo (Apache-2.0) + Grafana (AGPL-3.0)
  + Prometheus (Apache-2.0) + Loki (AGPL-3.0) + Tempo (AGPL-3.0)
  + OTel Collector (Apache-2.0) + Locust (MIT) for load generation

Layer 5 — ORCHESTRATION BRIDGE (custom code — the gap)
  Connects scenario state → fault injection → telemetry
  This component does not exist and must be built
```

### 4.2 OpenTelemetry Demo — Key Facts

The OTel Demo (Astronomy Shop) is a microservice-based distributed system with 15+ services written in Go, Java, Python, Node.js, .NET, Ruby, PHP, Rust, C++, and more. All services are fully instrumented with OpenTelemetry. It includes a Locust-based load generator and feature flags (via flagd/OpenFeature) for toggling built-in failure scenarios.

**Resource requirements:**

- Minimum: 4GB RAM (minimal deployment, excludes Kafka and dependent services)
- Recommended: 8GB+ RAM (full deployment)
- 4 CPU cores recommended
- 14GB disk space
- Runs on Docker Compose or Kubernetes

**Multi-trainee model:** Grafana supports multiple concurrent viewers. The recommended approach is instructor-led: one OTel Demo instance, one scenario running, all trainees viewing the same dashboards from their own browsers. Resource requirements don't scale with viewer count — they scale with load generation volume and telemetry storage.

**Minimal deployment** excludes Kafka, Accounting service, Fraud Detection service, and the Feature Flag UI. Suitable for simpler scenarios with lower resource requirements.

### 4.3 K8sGames as L0 On-Ramp

K8sGames (k8sgames.com, Apache-2.0) is a browser-based 3D Kubernetes cluster simulator. No real cluster needed. Pure JavaScript (Three.js), ~50K lines, vanilla ES6 modules, no build step.

**Capabilities:** 25 K8s resource types, 29 incident types (OOMKilled, CrashLoopBackOff, ImagePullBackOff, node NotReady, DNS failures, certificate expiry, HPA flapping, etc.), simulated kubectl command bar, Campaign mode (20 levels), Chaos Mode (escalating incidents), Sandbox (free build with Architecture Advisor scoring), Challenges (10 timed scenarios).

**Role in curriculum:** Official Level 0 on-ramp. Zero-infrastructure, zero-cost, self-paced. Builds Kubernetes vocabulary and basic diagnostic reasoning before trainees encounter real Grafana dashboards and distributed traces.

**Tutoring integration approach:** Fork and instrument. Add event hooks to capture: every kubectl command typed, every resource clicked, every incident fired and response time, hint requests, investigation order. Pipe events to the tutoring agent via WebSocket. Estimated scope: moderate — the codebase already tracks achievements and stats internally, so the event model exists.

**Optional enhancement:** Add a simulated "AI assistant" button that sometimes gives correct advice and sometimes is confidently wrong. Even at L0, this plants the Pilotry habit of verifying agent suggestions rather than blindly following them.

**Graduation criteria (tutor-assessed):**

- Diagnoses common incident types without hints in under 2 minutes
- Uses `describe` and `logs` before `delete` (diagnostic-first habit)
- Can explain why something failed, not just fix it
- Completes Campaign levels 1-15 and 5+ Challenge scenarios
- Shows decreasing time-to-resolution across similar incidents

### 4.4 MiroFish Behavioural Load Bridge (Phase 2)

MiroFish is a multi-agent AI swarm intelligence engine (Apache-2.0 / AGPL-3.0) that simulates thousands of AI agents interacting on synthetic social platforms. It is not a production simulator — it simulates human social behaviour. However, it can be used as a realistic traffic shaping layer to generate emergent, bursty, correlated load patterns that conventional load generators (Locust, k6) cannot produce.

**Architecture — Approach B (behaviour bridge):**

MiroFish runs a social simulation. A custom Python "behaviour bridge" reads the simulation state (topic clustering, sentiment shifts, viral cascades, agent frustration) and translates it into traffic commands for Locust/k6. MiroFish handles traffic PATTERN (which endpoints, what correlations). Locust handles traffic VOLUME (thousands of requests per second).

**Key behaviour mappings:**

| Social Signal | Traffic Translation |
|---|---|
| Viral topic cluster (attention concentration > 40%) | 60-70% of traffic concentrates on one endpoint |
| Negative sentiment wave | Support API spike + checkout abandonment |
| Agent frustration + slow system response | Retry storm (60% of requests are retries) |
| Lull followed by activity snap-back | Thundering herd (8x spike in 2 seconds) |
| Influencer agent post | Traffic ramp to specific product category |

**Critical feature — the feedback loop:** System health metrics (p99 latency from Prometheus) feed back into MiroFish as environmental context. Agents become "frustrated" by slow responses, generating retry storms that make the system worse — exactly the positive feedback loop that causes real metastable failures.

**Compute requirements:**

- Practical configuration: 100 agents, 1 decision every 30 seconds on local Ollama (decent GPU)
- ~200 LLM calls/minute (feasible locally)
- MiroFish shapes traffic; Locust fills volume (500 virtual users, ~5,000 req/min)
- Phase 3 (sponsorship): 1,000+ agents on cloud LLM APIs (~$3-5/min)

**Why this matters for training:** The highest-value training scenarios feature emergent failures — incidents that weren't scripted but arose from the interaction of system behaviour and user behaviour. MiroFish produces these organically. No one (including the scenario designer) knows exactly when or how the system will fail.

**Implementation phasing:**

- Phase 1 (MVP): No MiroFish. Locust with hand-tuned traffic profiles. Docker Compose only.
- Phase 2 (needs GPU): MiroFish-Offline (Neo4j + Ollama), 100 agents, behaviour bridge (~500-800 lines Python). Replace scripted Locust profiles with dynamic shaping.
- Phase 3 (needs sponsorship): 1,000+ agents, full feedback loop, emergent failure scenarios, real-time swarm visualisation alongside Grafana dashboards.

---

## 5. Curriculum-to-Simulator Mapping

### 5.1 Tools Available to Trainees by Level

| Tool | L0 | L1 | L10 | L20 |
|---|---|---|---|---|
| K8sGames (browser) | Primary | Warm-up | — | — |
| Grafana dashboards | Guided | Independent | Independent | Read-only |
| Loki log search | Guided | Independent | Independent | — |
| Jaeger trace explorer | Guided | Independent | Independent | — |
| Web terminal (kubectl, curl, psql, etc.) | Read-only | Full access | Full access | — |
| Source code access | — | Yes | Yes | — |
| AI diagnostic/coding agent | — | Available (sometimes wrong) | Available (calibration target) | Available (org-level evaluation) |
| Communication channels (simulated Slack) | — | — | Limited | Primary interface |
| Stakeholder messages (CEO, legal, PR) | — | — | — | Primary interface |

### 5.2 What the Tutoring Agent Evaluates by Level

| Dimension | L0 | L1 | L10 | L20 |
|---|---|---|---|---|
| Observational accuracy | Primary | Secondary | — | — |
| Diagnostic reasoning | — | Primary | Secondary | — |
| Agent trust calibration | Introduced | Primary | Primary | Secondary |
| Delegation decisions | — | — | Primary | Secondary |
| Verification discipline | — | Primary | Primary | Secondary |
| Communication quality | — | — | Secondary | Primary |
| Organisational decision quality | — | — | — | Primary |

### 5.3 Scenario Inventory

Full scenario specifications are in the separate mapping document (curriculum-simulator-mapping.md). Summary:

**Level 0 — Guided Tours and First Solo:**

- S0.1: Guided dashboard tour ("Something is slow")
- S0.2: Guided log exploration
- S0.3: Guided trace exploration
- S0.4: First solo diagnosis ("Something broke")
- Pre-requisite: K8sGames Campaign levels 1-15

**Level 1 — Diagnostic Challenges with Agent Interactions:**

- S1.1: The False Green Test Suite (concurrency bug, agent misdiagnoses)
- S1.2: End-to-End Trace Under Pressure (payment/order disagreement, agent suggests dangerous fix)
- S1.3: Security Review Under Fire (IDOR, weak hashing, unauth'd endpoint, agent misses subtle issues)
- S1.4: Specification vs. Reality (spec gap causes production perf issue)
- S1.5: Failure Mode Scavenger Hunt (hallucinated API, missing validation, multi-instance bug)

**Level 10 — Delegation, Calibration, and Identity:**

- S10.1: Agent-Assisted Diagnosis (cascading gray failure, agent confidently wrong)
- S10.2: Architecture as Specification (integration failure from missing interface contract)
- S10.3: Legacy System Agent "Improvement" (agent refactors away important workaround)
- S10.4: Macro Action Delegation (build a feature live, tutor evaluates delegation process)
- S10.5: The Identity Exercise (mentor a junior through diagnosis without fixing it yourself)

**Level 20 — Organisational Decisions:**

- S20.1: The Correlated Agent Failure (same vulnerability across multiple services)
- S20.2: The False Economy (velocity up, quality down — structural decision)
- S20.3: The War Room (live incident with stakeholder pressure, pricing bug in agent-generated code)
- S20.4: Maturity Assessment Workshop (design transition from Level 2 to Level 3)
- S20.5: Hiring Simulation (design interview process, evaluate simulated candidates)

**Cross-Level Scenarios:**

- SX.1: The Full-Stack Incident (same cascading failure, four levels experience it differently)
- SX.2: The MiroFish Incident (emergent failure from agent swarm traffic, Phase 2+)

### 5.4 Scenario Complexity Ladder

Each level has four difficulty tiers:

| Tier | Root Cause | Symptoms | AI Agent Behaviour | Tutor |
|---|---|---|---|---|
| Introductory | Single, clear | Obvious | Mostly helpful | Frequent guidance |
| Intermediate | Multiple contributing factors | Ambiguous | Sometimes helpful, sometimes wrong | Guidance when stuck |
| Advanced | Gray failure / metastable | Misleading | Confidently wrong / fixation loop | Debrief only |
| Expert | Emergent (MiroFish) | Multiple simultaneous issues | Produces plausible but dangerous "fix" | Retrospective evaluation only |

---

## 6. Tutoring Agent Design

### 6.1 The Socratic Pattern

Each curriculum area has a compact knowledge base (~10 pages) covering core concepts. The tutoring agent uses this to conduct Socratic conversations that:

- Allow the user to explore concepts in directions they choose
- Provide guardrails for staying on topic
- Detect meta questions ("What's this course about? What's my progress?")
- Detect fatigue or frustration and encourage breaks
- Probe for overconfidence (especially at L1 where trainees don't know what they don't know)
- Challenge over-skepticism (especially at L10 where veterans resist delegation)

### 6.2 Simulation Observation

During simulation scenarios, the tutoring agent observes (requires instrumentation):

**From K8sGames (L0):**

- kubectl commands typed
- Resources clicked and inspected
- Time to respond to each incident
- Hints requested
- Order of investigation (diagnostic-first vs. fix-first)

**From OTel Demo + Grafana (L1+):**

- Which Grafana panels viewed and for how long
- Log queries executed (LogQL)
- Traces explored in Jaeger
- Terminal commands run
- Questions asked to the AI diagnostic/coding agent
- Whether AI agent output was accepted uncritically or verified independently
- Sequence of tools used (order reveals reasoning strategy)
- Time spent on each diagnostic step

**From communication channels (L20):**

- Time to first stakeholder communication
- Quality and accuracy of status updates
- Decision timing (when rollback was ordered, when escalation happened)
- Whether decisions had stated reasoning

### 6.3 Intervention Thresholds

| Level | Tutor intervenes when... |
|---|---|
| L0 | Stalls >60 seconds or using the wrong tool |
| L1 | Accepts AI output without verification, or stalls >3 minutes |
| L10 | Asks AI agent same question 3+ times (fixation loop), or misses gray failure after 10 minutes |
| L20 | Hasn't communicated to stakeholders within 5 minutes, or makes decision without stated reasoning |

### 6.4 Post-Scenario Debrief

The tutor replays the trainee's actions with timestamps and highlights:

- Moments of good judgment (with specific praise)
- Missed signals (with specific guidance on what to check earlier)
- Comparison to expert diagnostic path (not prescriptive — "both routes work, but here's the shorter one")
- Progression tracking (comparison to previous scenarios of same type)

### 6.5 Progression Decisions

The tutor tracks readiness to advance:

- L0 → L1: K8sGames graduation criteria met + successful solo diagnosis in S0.4
- L1 → L10: Consistent verification discipline + accurate trust calibration of AI agent across S1.1-S1.5 + can explain "why" not just "what"
- L10 → L20: Effective delegation decisions + can mentor others through diagnosis + recognises systemic risk patterns

---

## 7. Open Data Sources and Tools Reference

### 7.1 Failure Probability Data

| Source | Contents | Access |
|---|---|---|
| Google Cluster Traces (2019) | 8 clusters × ~12k machines × 29 days, task failure events, resource usage | CC-BY, BigQuery or download |
| Alibaba Cluster Trace (2018) | 8-day trace, CPU/memory/network/disk I/O | Public, GitHub |
| VOID (thevoid.community) | ~10,000 incidents from ~600 orgs, duration/severity metadata | Free |
| danluu/post-mortems | Hundreds of public post-mortems, categorised | Free, GitHub |
| icco/postmortems | Structured JSON metadata fork of above | Free, GitHub |
| New Relic Observability Forecast 2024 | MTTD/MTTR benchmarks, root cause distributions | Free report |
| Uptime Institute Annual Outage Analysis | Frequency-by-cause data, human error percentages | Executive summary free, full report subscription |
| Lloyd's "Cloud Down" / "Counting the Cost" | Actuarial analysis, return-period probabilities | Public reports |

### 7.2 Failure Modelling Tools

| Tool | Purpose | Licence |
|---|---|---|
| pgmpy | Bayesian network inference (Python) | MIT |
| PFTA | Fault tree analysis with Monte Carlo | GPL-3.0 |
| EMFTA | Graphical fault tree editor (CMU SEI) | EPL |
| DFTCalc | Dynamic fault trees with temporal dependencies | GPL |
| NetworkX | Service dependency graph modelling (Python) | BSD |

### 7.3 Chaos Engineering / Fault Injection

| Tool | Strengths | Licence |
|---|---|---|
| Chaos Mesh | Broadest fault types, native workflow engine, CNCF Incubating | Apache-2.0 |
| LitmusChaos | Argo-based workflows, ChaosHub library, CNCF Incubating | Apache-2.0 |
| Chaos Toolkit | Declarative JSON/YAML, extensible drivers, good API layer | Apache-2.0 |
| Toxiproxy | TCP proxy for network simulation, lightweight, no K8s needed | MIT |
| stress-ng | CPU/memory/I/O stress testing | GPL-2.0 |

### 7.4 Telemetry and Observability

| Tool | Role | Licence |
|---|---|---|
| OpenTelemetry Demo | Full instrumented microservices app | Apache-2.0 |
| OpenTelemetry Collector | Telemetry pipeline (receive, transform, route) | Apache-2.0 |
| Grafana | Dashboards and visualisation | AGPL-3.0 |
| Prometheus | Metrics collection and storage | Apache-2.0 |
| Loki | Log aggregation | AGPL-3.0 |
| Tempo | Distributed tracing backend | AGPL-3.0 |
| Locust | Load generation (Python) | MIT |
| k6 | Load testing (Go) | AGPL-3.0 |
| Grafana fake-metrics-generator | Synthetic Prometheus metrics | Apache-2.0 |
| otelgen | Synthetic OTel logs/metrics/traces via CLI | Apache-2.0 |

### 7.5 Scenario and Narrative

| Tool | Role | Licence |
|---|---|---|
| Wheel of Misfortune v5 | SRE training exercise web app with JSON scenarios | Apache-2.0 |
| Ink (Inkle) | Branching interactive narrative scripting | MIT |
| Jsonnet | Programmatic scenario generation from templates | Apache-2.0 |
| K8sGames | Browser-based K8s cluster simulator with 29 incident types | Apache-2.0 |

### 7.6 Key Academic References

| Paper / Report | Key Finding | Relevance |
|---|---|---|
| Huang et al., "Gray Failure" (HotOS 2017) | Gray failure = differential observability. Behind most cloud incidents. | Highest-value scenario design: dashboards look normal, system is broken |
| Bronson et al., "Metastable Failures" (HotOS 2021) | Root cause is the sustaining feedback loop, not the trigger | Scenario pattern: system enters stable-but-down state, fix must break the loop |
| Gunawi et al., "Why Does the Cloud Stop Computing?" (SoCC 2016) | 597 outages analysed. No-SPOF fails due to imperfect recovery chains. Cascading bugs defeat redundancy. | Multi-factor scenarios. Recovery can make things worse. |
| VOID Reports (2021-2024) | MTTR is unreliable. No duration-severity correlation. Automation can exacerbate. | Don't score on speed. Score on reasoning. Automation isn't always the answer. |
| Nygard, "Release It!" stability anti-patterns | 12 concrete failure modes (integration points, cascading failures, blocked threads, thundering herd, etc.) | Direct scenario templates for each anti-pattern |
| Buldyrev et al., PNAS 2019 | Percolation theory for cascading failures in interdependent networks | Mathematical model for blast radius computation in simulator |

---

## 8. Implementation Roadmap

### Phase 1 — MVP (no MiroFish, Docker Compose only)

**Infrastructure:** OTel Demo on Docker Compose + Grafana/Prometheus/Loki/Tempo. Toxiproxy for network fault injection. K8sGames as-is (linked, not forked).

**Scenarios:** S0.1-S0.4, S1.1, S1.2, S10.1, SX.1.

**Tutoring agent:** Basic observation (which panels viewed, commands run) + scripted intervention points. Socratic knowledge bases for L0 and L1 core modules (~10 pages each).

**Output:** Working proof-of-concept where a trainee can go through a guided L0 tour, attempt an L1 diagnostic challenge with AI agent interaction, and receive a basic debrief.

### Phase 2 — Enhanced Tutoring + Full Scenario Set

**Infrastructure:** K8sGames forked and instrumented for event capture. OTel Demo with additional custom services for specific scenarios. Chaos Mesh or LitmusChaos for K8s-native fault injection.

**Scenarios:** Full S1.x, S10.x, S20.x scenario sets. SX.1 with multi-level concurrent participation.

**Tutoring agent:** LLM-powered Socratic questioning based on observed trainee actions. Progression tracking across scenarios. Personalised debrief with comparison to expert paths.

**Curriculum:** Evolved curricula incorporating accountability framing, specification-as-design-thinking module, verification checklists, vibe coding path.

### Phase 3 — MiroFish + Advanced Features

**Infrastructure:** MiroFish-Offline (Neo4j + Ollama) + behaviour bridge. Feedback loop from system health to agent behaviour. Full emergent failure scenarios.

**Scenarios:** SX.2 (MiroFish emergent incident). Multi-trainee concurrent scenarios across levels. Expert-tier scenarios with no scripted root cause.

**Tutoring agent:** Full adaptive guidance. Cumulative performance tracking. Progression recommendations. Evidence-of-competence records (the beginning of credentialing).

**Sponsorship targets:** LLM provider (showcase for multi-agent systems), observability vendor (Grafana as training platform), cloud provider (chaos engineering showcase).

---

## 9. Open Questions for Development

1. **Level 0 curriculum document**: Doesn't exist yet. Needs to cover: basic systems vocabulary, how to read dashboards, introduction to diagnostic reasoning, the accountability concept at its simplest. Should it be a fourth standalone curriculum alongside the three existing ones, or a pre-module added to the New Grad curriculum?

2. **Vibe coding path**: Is this a parallel curriculum or an introductory module within the existing structure? How much systems understanding does the "informed client" need? Where does the accountability boundary sit between business owner and retained Software Pilot?

3. **Credentialing**: The simulation evaluation records are the beginning of a competence demonstration system. Is there an appetite for formalising this into a certification or credential? What would that look like? Who would administer it?

4. **Community contribution model**: The scenario format (JSON + Ink scripts + fault injection spec) could enable community-contributed scenarios from real post-mortems. How do we quality-control community scenarios? What's the governance model?

5. **The AI agent in scenarios**: How sophisticated does the simulated AI diagnostic agent need to be? Can we use a real LLM with a system prompt that makes it sometimes wrong, or do we need scripted wrong answers for reproducibility?

6. **Metrics and research**: The simulator generates data about how people diagnose incidents. This is potentially valuable research data (with consent). Is there a research partnership opportunity?

7. **Business model**: Open-source simulator + open-source curriculum. Revenue from: facilitated workshops, enterprise customisation, retained pilot services, certification fees? Which comes first?