# Technical Architecture — Software Pilotry Platform

**Baseline v0.1 — March 2026**

---

## Design Constraints

1. **All Cloudflare.** Workers, Pages, D1, Durable Objects, R2, AI Gateway, Containers. No AWS/GCP/Azure dependencies.
2. **Per-learner isolation.** Every learner gets their own state, their own agent context, and their own sandboxed execution. No cross-contamination.
3. **Three execution tiers.** Content ranges from "edit five lines and watch the console" to "build a full app with an AI agent and evaluate it." The platform must support all three without forcing the heaviest tier on the simplest exercise.
4. **Cost-proportional.** A learner reading narrative content costs near zero. A learner running a Cloudflare Container costs real money. The architecture must scale cost with activity, not enrolment.
5. **Evaluator-native.** AI-evaluated exercises are the core feedback loop, not an add-on. The evaluator is a first-class service with structured rubrics, not a chatbot wrapper.

---

## System Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Cloudflare Pages                       │
│              React SPA — course shell, routing            │
│         Sandpack embeds (Tier 1 exercises)                │
└──────────────┬──────────────────────────────┬────────────┘
               │                              │
               ▼                              ▼
┌──────────────────────┐       ┌──────────────────────────┐
│   Course API Worker  │       │   Evaluator Worker       │
│   Auth, progress,    │       │   Rubric engine,         │
│   content delivery   │       │   AI Gateway calls,      │
│                      │       │   submission scoring     │
└──────┬───────────────┘       └──────┬───────────────────┘
       │                              │
       ▼                              ▼
┌──────────────────────┐       ┌──────────────────────────┐
│   D1 Database        │       │   AI Gateway             │
│   Learner state,     │       │   Rate limiting,         │
│   progress, scores,  │       │   cost control,          │
│   submissions        │       │   provider routing       │
└──────────────────────┘       └──────────────────────────┘
       │
       ▼
┌──────────────────────┐       ┌──────────────────────────┐
│   Durable Objects    │       │   Cloudflare Containers  │
│   Per-learner tutor  │       │   Tier 3 sandboxes,      │
│   agent (persistent  │       │   VibeSDK fork for       │
│   memory + context)  │       │   agent-assisted builds  │
└──────────────────────┘       └──────────────────────────┘

┌──────────────────────┐
│   R2 Object Storage  │
│   Submission assets,  │
│   generated apps,    │
│   learner artefacts  │
└──────────────────────┘
```

---

## Content Type Taxonomy

Every exercise in the curriculum maps to one of these content types. Each type has a defined execution environment, input/output contract, and evaluation method.

### CT-1: Narrative

**What it is:** Explanatory text, diagrams, embedded video, conceptual frameworks.
**Execution:** None — static content rendered in the SPA.
**Evaluation:** None, or lightweight comprehension check (multiple choice).
**Cost per learner:** Near zero (Pages CDN).
**Used in:** All modules for conceptual sections.

### CT-2: Constrained Code Sandbox

**What it is:** Learner edits a small number of lines in a controlled environment. Some files locked/hidden. Console output visible. The learner writes code, predicts output, runs it, sees the result.
**Execution:** Sandpack (client-side bundler in iframe). Zero server cost.
**Input:** Pre-configured file set with editable regions marked. Template (vanilla JS, React, or Node via Nodebox).
**Output:** Console output, rendered preview, or both.
**Evaluation:** Automated assertion (did the output match?), or AI evaluator compares output to expected behaviour.
**Cost per learner:** Zero marginal (client-side only).
**Used in:** Module 2 (compiler moment, DevTools exercises), Module 3 (comparing outputs).

### CT-3: Database Sandbox

**What it is:** Learner runs SQL queries against a pre-loaded dataset. Sees results, errors, constraint violations.
**Execution:** sql.js (SQLite compiled to WASM, runs in browser) with pre-loaded `.sqlite` file fetched from R2. No server-side database per learner.
**Input:** Pre-loaded schema + seed data. Guided query prompts.
**Output:** Query results table, or error message on constraint violation.
**Evaluation:** Assertion (did the query return expected rows?), or AI evaluator assesses whether the learner correctly identified the constraint failure.
**Cost per learner:** Near zero (WASM + static asset from R2/CDN).
**Used in:** Module 2 Section 2.3 (data has structure).

### CT-4: Diagnostic Exercise

**What it is:** Learner is given a broken or instrumented web page and must use browser DevTools (Console, Network, Elements) to find and describe problems.
**Execution:** Sandpack or a hosted static page served from Pages with deliberate errors. The errors are in the page itself — the learner's tool is their own browser DevTools.
**Input:** URL or embedded Sandpack preview of a broken app. Error manifest (known bugs the learner must find).
**Output:** Learner submits a structured report: which errors they found, where (console/network/elements), what the error message said, what they think caused it.
**Evaluation:** AI evaluator scores the report against the error manifest. Partial credit for finding some but not all.
**Cost per learner:** Near zero (static broken page + evaluator inference call).
**Used in:** Module 2 (DevTools cockpit, Section 2.4), Module 6 (applied diagnostics).

### CT-5: Multi-Output Comparison

**What it is:** Learner submits an identical specification to an AI agent N times and compares the outputs side by side. The point is experiencing variability — same input, different results.
**Execution:** Platform submits the learner's spec to the AI Gateway N times (configurable, default 5) with identical parameters. Responses are stored and displayed side by side.
**Input:** Learner-authored specification text.
**Output:** N agent responses displayed in a comparison view (diff highlights optional).
**Evaluation:** AI evaluator scores the learner's written analysis of what differed, what mattered, and what didn't.
**Cost per learner:** N inference calls per exercise via AI Gateway. Moderate — rate-limited per learner.
**Used in:** Module 3 Section 3.1 (the stochastic moment).

### CT-6: Structured Authoring

**What it is:** Learner writes a document to a structured template — problem definition, acceptance criteria, edge cases, constraint specification, risk assessment, go/no-go justification, personal charter. The document has defined sections and evaluation dimensions.
**Execution:** Rich text editor in the SPA with section scaffolding. Saved to D1.
**Input:** Template with section headers and guidance prompts. Context from prior exercises (e.g. "use the dental booking system from 4.1").
**Output:** Structured document stored as JSON in D1.
**Evaluation:** AI evaluator scores each section against a rubric. Per-dimension scores (e.g. "testability: 7/10, edge case coverage: 5/10") with specific feedback.
**Cost per learner:** One evaluator inference call per submission. Low-moderate.
**Used in:** Module 1 (problem description), Module 4 (all specification exercises), Module 5 (risk assessment), Module 6 (hiring brief), Module 7 (persona definitions), Module 8 (go/no-go justification), Module 9 (sustainable practice charter).

### CT-7: Agent-Assisted Build

**What it is:** Learner uses an AI agent to build a working application from their specification. The platform provides the agent environment, or the learner uses their own tools and submits the result.
**Execution — platform-hosted path:** Cloudflare Container running a VibeSDK fork. Learner provides specification, agent generates app in phases, learner reviews and iterates. WebSocket streaming for real-time feedback.
**Execution — bring-your-own-tools path:** Learner builds in Claude Code, Cursor, or any agent tool. Submits a URL or uploads a bundle for evaluation.
**Input:** Learner's specification (from CT-6). Optional: iterative prompts during the build.
**Output:** Running application (Container preview URL or uploaded bundle). Build log showing agent phases.
**Evaluation:** Multi-dimensional: (a) does the app satisfy the learner's own acceptance criteria? (b) security scan (hardcoded secrets, missing auth, SQL injection patterns), (c) AI evaluator reviews code quality and specification adherence.
**Cost per learner:** High — Container instance + multiple inference calls. This is the expensive content type. Rate-limited: max concurrent containers per learner, session time caps.
**Used in:** Module 6 (build cycle), final project.

### CT-8: App Review

**What it is:** Learner is given a pre-built application (agent-generated, with deliberate flaws) and must evaluate it — find security issues, unhandled edge cases, missing functionality, accessibility problems.
**Execution:** Pre-built app served from a Container or Pages. The app is the same for all learners (no per-learner compute). Learner interacts with it in their browser and submits findings.
**Input:** Running app URL + the original specification it was built from. Flaw manifest (known issues the learner should find).
**Output:** Structured review report (CT-6 format): issues found, severity, specification gap that caused each one.
**Evaluation:** AI evaluator scores against flaw manifest. Bonus for finding issues not in the manifest.
**Cost per learner:** Near zero (shared app) + one evaluator call.
**Used in:** Module 4 Section 4.3 (edge cases), Module 6 Section 6.3 (security), Module 8 (verification).

### CT-9: Simulation Exercise

**What it is:** Learner defines user personas and test scenarios. The platform runs synthetic users through an application and reports results. Learner interprets the results.
**Execution:** AI Gateway calls to simulate persona behaviour against the target app (Container or external URL). Results aggregated and presented as a report.
**Input:** Persona definitions (CT-6 format), scenario scripts, target app URL.
**Output:** Simulation results: which scenarios passed/failed per persona, with logs.
**Evaluation:** AI evaluator scores the learner's interpretation of results — did they identify the right failures, prioritise correctly, propose the right fixes?
**Cost per learner:** Multiple inference calls (personas × scenarios). Moderate-high. Capped per exercise.
**Used in:** Module 7 Section 7.3 (simulation and synthetic testing).

### CT-10: Dashboard Interpretation

**What it is:** Learner is presented with a simulated analytics dashboard (pre-rendered with synthetic data) and must answer analytical questions — conversion rates, drop-off points, anomalies, segment comparisons.
**Execution:** Static dashboard UI served from Pages with synthetic data baked in. No live data connection.
**Input:** Dashboard view + set of analytical questions.
**Output:** Learner's written answers.
**Evaluation:** AI evaluator scores answers against known correct values and reasoning quality.
**Cost per learner:** Near zero (static content) + one evaluator call.
**Used in:** Module 7 Section 7.5 (analytics as a pilotry skill).

### CT-11: Case Study Analysis

**What it is:** Learner reads a case study (real or composite) and answers structured questions about roles, failures, accountability, and what should have been done differently.
**Execution:** Narrative content (CT-1) + structured response form (CT-6).
**Input:** Case study text + analysis questions.
**Output:** Written analysis.
**Evaluation:** AI evaluator against rubric.
**Cost per learner:** One evaluator call. Low.
**Used in:** Module 1 (AI failure case studies), Module 5 (agent risk assessment).

---

## Core Services

### Course API Worker

Single Worker handling:
- **Authentication:** GitHub OAuth (initial), extensible to email/password.
- **Learner progress:** Module completion, exercise scores, weak-area tracking. All in D1.
- **Content routing:** Serves exercise configurations (which files, which template, which rubric) as JSON. Actual content lives in the SPA bundle or R2.
- **Submission intake:** Receives exercise submissions, validates structure, enqueues for evaluation.

### Evaluator Service

Separate Worker (or Durable Object per submission) handling:
- **Rubric engine:** Each exercise has a rubric defined as structured JSON — dimensions, weights, pass thresholds, example good/bad answers.
- **AI Gateway integration:** Sends learner submission + rubric to AI Gateway. Provider-agnostic (Claude, GPT, Gemini — routed by cost/capability).
- **Scoring pipeline:** Parse model response → extract per-dimension scores → store in D1 → return to learner.
- **Retry and fallback:** If primary model fails, route to secondary via AI Gateway. Never lose a submission.

### Per-Learner Tutor Agent (Durable Object)

One Durable Object instance per enrolled learner:
- **Persistent context:** Knows the learner's progress, scores, weak areas, and recent submissions.
- **Contextual help:** "Why did my specification fail?" → tutor reads the rubric feedback and explains in the context of what the learner wrote.
- **Not a chatbot.** Scoped to course content and the learner's own work. Does not generate code for them. Does not answer questions outside the curriculum.
- **Hibernation:** Durable Object hibernates when inactive. Wakes on request. Cost only when active.

### Sandbox Orchestrator (Containers — Tier 3 only)

Manages Cloudflare Container lifecycle for CT-7 and CT-9:
- **Provisioning:** Spin up container from VibeSDK fork image on demand.
- **Session binding:** Container bound to learner session via Durable Object coordination.
- **Time limits:** Max session duration (configurable, e.g. 30 minutes). Hard kill after limit.
- **Cleanup:** Container destroyed on session end. Artefacts (generated code, build logs) persisted to R2 before teardown.
- **Concurrency cap:** Max N concurrent containers per learner (suggest 1). Platform-wide cap tied to billing.

---

## Data Model (D1)

### Core Tables

```
learners
  id              TEXT PK DEFAULT (hex(randomblob(16)))
  email           TEXT UNIQUE NOT NULL
  display_name    TEXT
  auth_provider   TEXT NOT NULL
  auth_subject    TEXT NOT NULL
  enrolled_at     TEXT DEFAULT (datetime('now'))
  last_active_at  TEXT

progress
  learner_id      TEXT FK → learners.id
  module_id       TEXT NOT NULL
  exercise_id     TEXT NOT NULL
  status          TEXT NOT NULL  -- not_started | in_progress | submitted | scored
  score_json      TEXT           -- per-dimension scores as JSON
  attempts        INTEGER DEFAULT 0
  first_submitted TEXT
  last_submitted  TEXT
  PRIMARY KEY (learner_id, module_id, exercise_id)

submissions
  id              TEXT PK DEFAULT (hex(randomblob(16)))
  learner_id      TEXT FK → learners.id
  module_id       TEXT NOT NULL
  exercise_id     TEXT NOT NULL
  content_json    TEXT NOT NULL   -- the submission payload
  rubric_version  TEXT NOT NULL
  score_json      TEXT            -- null until evaluated
  evaluator_model TEXT            -- which model scored it
  submitted_at    TEXT DEFAULT (datetime('now'))
  scored_at       TEXT

container_sessions
  id              TEXT PK DEFAULT (hex(randomblob(16)))
  learner_id      TEXT FK → learners.id
  container_id    TEXT
  exercise_id     TEXT NOT NULL
  started_at      TEXT DEFAULT (datetime('now'))
  ended_at        TEXT
  artefact_r2_key TEXT           -- R2 path to persisted build output
```

### Indexes

```
CREATE INDEX idx_progress_learner ON progress(learner_id);
CREATE INDEX idx_submissions_learner ON submissions(learner_id, module_id);
CREATE INDEX idx_container_sessions_learner ON container_sessions(learner_id);
```

---

## Cost Model

| Content type | Infra cost per exercise | Inference cost per exercise | Frequency |
|-------------|------------------------|---------------------------|-----------|
| CT-1 Narrative | ~$0 (CDN) | $0 | Every section |
| CT-2 Code sandbox | ~$0 (client-side) | $0–0.02 (optional eval) | ~15 exercises |
| CT-3 Database sandbox | ~$0 (WASM) | $0–0.02 | ~3 exercises |
| CT-4 Diagnostic | ~$0 (static page) | $0.02–0.05 | ~5 exercises |
| CT-5 Multi-output | ~$0 | $0.10–0.50 (N calls) | ~3 exercises |
| CT-6 Structured authoring | ~$0 | $0.03–0.10 | ~15 exercises |
| CT-7 Agent-assisted build | $0.10–1.00 (Container) | $0.50–2.00 | ~3 exercises |
| CT-8 App review | ~$0 (shared app) | $0.03–0.10 | ~5 exercises |
| CT-9 Simulation | ~$0 | $0.20–1.00 | ~2 exercises |
| CT-10 Dashboard | ~$0 (static) | $0.02–0.05 | ~2 exercises |
| CT-11 Case study | ~$0 | $0.02–0.05 | ~3 exercises |

**Estimated total inference cost per learner completing the full course:** $3–8, heavily dependent on CT-7 usage.

**Fixed infrastructure:** Workers Paid ($5/mo), D1 (included), AI Gateway (included), Containers (usage-based). Platform becomes cost-effective at ~50+ concurrent learners.

---

## Security Boundaries

- **Learner isolation:** D1 queries always scoped by `learner_id`. No endpoint returns another learner's data.
- **Container isolation:** Each container is a separate Cloudflare Container instance. No shared filesystem.
- **Evaluator integrity:** Rubrics stored server-side, never sent to the client. Learners cannot see rubric details or manipulate scoring.
- **Submission immutability:** Once submitted, `submissions` rows are append-only. Rescoring creates a new row, doesn't mutate.
- **AI Gateway as chokepoint:** All inference routed through AI Gateway. Per-learner rate limits enforced there. No direct model API access from client.

---

## What This Architecture Does NOT Cover (Yet)

- **Payment/billing.** Out of scope for baseline. Stripe integration is a future layer.
- **Cohort/classroom features.** This is a single-learner self-paced architecture. Instructor dashboards, group exercises, and cohort management are future work.
- **Certificate issuance.** The rubric engine can determine pass/fail. Issuing a verifiable credential is a separate system.
- **Content authoring CMS.** Exercise definitions are JSON files in the codebase. A CMS for non-technical content authors is future work.
- **Mobile app.** SPA is responsive but there is no native app. PWA is a low-cost future option.
