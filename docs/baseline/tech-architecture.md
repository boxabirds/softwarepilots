# Technical Architecture — Software Pilotry Platform

**Baseline v0.2 — March 2026 (MVP scope)**

---

## Design Constraints

1. **All Cloudflare.** Workers, Pages, D1, Durable Objects, R2, AI Gateway. No AWS/GCP/Azure dependencies.
2. **Per-learner isolation.** Every learner gets their own state, their own agent context, and their own sandboxed execution. No cross-contamination.
3. **Two execution tiers.** Client-side sandboxes (Pyodide, sql.js, Sandpack) for Modules 1–4 at zero marginal cost. Bring-your-own-tools for Module 6 agent-assisted builds. No platform-hosted containers in MVP.
4. **Cost-proportional.** A learner reading narrative content costs near zero. AI evaluation costs scale with submissions. The architecture scales cost with activity, not enrolment.
5. **Evaluator-native.** AI-evaluated exercises are the core feedback loop, not an add-on. The evaluator is a first-class service with structured rubrics, not a chatbot wrapper.
6. **Linear mastery progression.** Each module is gated — learners must demonstrate competence before unlocking the next module. The platform enforces the sequence the curriculum requires.

---

## MVP Module Scope

The MVP covers ~12–15 hours across six modules:

| Module | Title | Hours (est.) |
|--------|-------|-------------|
| 1 | The New Landscape | 2 |
| 2 | The Machine Beneath | 4 |
| 3 | The Probabilistic Machine | 4 |
| 4 | Specification (4.1–4.3 only) | 2.5 |
| 6 | Building with Agents | 3 |
| 8 | Verification, Acceptance, and Sustainable Practice | 3 |

Modules 5 (Autonomy Spectrum), 7 (Users, Data, Dual Interface), and 9 (Responsibility, standalone) are deferred to the full course. Module 9's wellbeing core (sustainable practice argument, personal charter exercise) is folded into Module 8.

---

## System Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Cloudflare Pages                      │
│              React SPA — course shell, routing           │
│         Client-side sandboxes (Pyodide, sql.js,          │
│         Sandpack) for Tier 1 exercises                   │
└──────────────┬──────────────────────────────┬────────────┘
               │                              │
               ▼                              ▼
┌──────────────────────┐       ┌──────────────────────────┐
│   Course API Worker  │       │   Evaluator Worker       │
│   Auth, progress,    │       │   Rubric engine,         │
│   mastery gates,     │       │   AI Gateway calls,      │
│   content delivery   │       │   submission scoring     │
└──────┬───────────────┘       └──────┬───────────────────┘
       │                              │
       ▼                              ▼
┌──────────────────────┐       ┌──────────────────────────┐
│   D1 Database        │       │   AI Gateway             │
│   Learner state,     │       │   Rate limiting,         │
│   progress, scores,  │       │   cost control,          │
│   submissions,       │       │   provider routing,      │
│   self-assessments   │       │   two-model strategy     │
└──────────────────────┘       └──────────────────────────┘
       │
       ▼
┌──────────────────────┐
│   Durable Objects    │
│   Per-learner tutor  │
│   agent (persistent  │
│   memory + context,  │
│   active during all  │
│   scored exercises)  │
└──────────────────────┘

┌──────────────────────┐
│   R2 Object Storage  │
│   Submission assets,  │
│   learner artefacts  │
└──────────────────────┘
```

---

## Content Type Taxonomy

Every exercise in the curriculum maps to one of four content types. Each type has a defined execution environment, input/output contract, and evaluation method.

### CT-1: Narrative

**What it is:** Explanatory text, diagrams, embedded video, conceptual frameworks.
**Execution:** None — static content rendered in the SPA.
**Evaluation:** None, or lightweight comprehension check (multiple choice, self-assessed).
**Cost per learner:** Near zero (Pages CDN).
**Used in:** All modules for conceptual sections.

### CT-2: Interactive Sandbox

**What it is:** Learner interacts with a controlled environment — editing code, inspecting broken pages, comparing outputs, or querying a database. Some files locked/hidden. Output visible.
**Execution:** Client-side via one of several runtimes, selected per exercise:

| Variant | Runtime | Used for |
|---------|---------|----------|
| Code editing (Python) | Pyodide (CPython via WASM) | Module 2.1 compiler moment |
| Code editing (JS) | Sandpack (client-side bundler) | Module 2.4 broken page construction |
| Database | sql.js (SQLite via WASM) | Module 2.3 data structure exercises |
| Diagnostic | Sandpack or hosted static page | Module 2.2, 2.4 DevTools exercises |
| Multi-output comparison | AI Gateway × N | Module 3.1 stochastic moment |

All variants except multi-output comparison have zero server cost. Multi-output comparison requires N inference calls via AI Gateway (configurable, default 5).

**Input:** Pre-configured file set or database with editable regions marked. For multi-output comparison: learner-authored specification text.
**Output:** Console output, rendered preview, query results, error messages, or side-by-side comparison of N agent responses.
**Evaluation:** Automated assertion (did the output match?), self-checked, or AI evaluator compares output to expected behaviour.
**Cost per learner:** Zero marginal for client-side variants. Moderate for multi-output comparison (N inference calls).
**Used in:** Module 2 (compiler moment, request lifecycle, data structure, DevTools), Module 3 (stochastic moment).

### CT-6: Structured Authoring

**What it is:** Learner writes a document to a structured template — problem definition, acceptance criteria, edge cases, risk assessment, go/no-go justification, personal practice charter. The document has defined sections and evaluation dimensions.
**Execution:** Rich text editor in the SPA with section scaffolding. Saved to D1.
**Inline tutor:** The per-learner tutor agent is active during all CT-6 exercises, providing paragraph-level feedback in real time using a cheaper/faster model. The tutor has access to the rubric dimensions and prompts the learner with questions ("What's the measurable threshold?" "What's the failure case?") as they write.
**Self-assessment:** Before final submission, the learner predicts their score and identifies their weakest dimension. Stored in `self_assessment_json`.
**Input:** Template with section headers and guidance prompts. Context from prior exercises (e.g. "use the dental booking system from 4.1").
**Output:** Structured document stored as JSON in D1.
**Evaluation:** AI evaluator (frontier model) scores each section against a rubric. Per-dimension scores (e.g. "testability: 7/10, edge case coverage: 5/10") with specific feedback. Self-assessment calibration gap shown alongside.
**Cost per learner:** Multiple inline tutor calls (cheaper model) during authoring + one evaluator inference call (frontier model) per submission. Low-moderate.
**Used in:** Module 1 (problem description, case study analysis), Module 4 (all specification exercises), Module 6 (hiring brief), Module 8 (go/no-go justification, sustainable practice charter).

### CT-7: Agent-Assisted Build (Bring Your Own Tools)

**What it is:** Learner uses their own AI agent (Claude Code, Cursor, Windsurf, or similar) to build a working application from their specification. The platform evaluates the submitted result, not the process.
**Execution:** Learner builds in their own environment. Submits a URL or uploads a bundle for evaluation.
**Input:** Learner's specification (from CT-6).
**Output:** Running application (external URL or uploaded bundle).
**Evaluation:** Multi-dimensional: (a) does the app satisfy the learner's own acceptance criteria? (b) security scan (hardcoded secrets, missing auth, SQL injection patterns), (c) AI evaluator reviews code quality and specification adherence.
**Self-assessment:** Before seeing evaluation results, learner predicts which acceptance criteria pass and which fail.
**Cost per learner:** One evaluator inference call per submission. No platform compute — the learner provides the agent environment.
**Used in:** Module 6 (build cycle), final project.

---

## Core Services

### Course API Worker

Single Worker handling:
- **Authentication:** GitHub OAuth (initial), extensible to email/password.
- **Learner progress:** Module completion, exercise scores, weak-area tracking. All in D1.
- **Mastery gates:** Prerequisite check before unlocking each module. Module 4 requires passing Modules 2 and 3. Module 6 requires passing Module 4. Module 8 requires passing Module 6. Gate logic enforced server-side — the SPA requests unlock status, the Worker checks `progress` rows.
- **Retrieval sprints:** At each module boundary, the Worker serves a retrieval sprint — 3–5 quick-recall questions from earlier modules. Self-checked, no AI evaluation. Must complete before unlocking the next module.
- **Content routing:** Serves exercise configurations (which files, which template, which rubric) as JSON. Actual content lives in the SPA bundle or R2.
- **Submission intake:** Receives exercise submissions with self-assessment predictions, validates structure, enqueues for evaluation.

### Evaluator Service

Separate Worker handling:
- **Rubric engine:** Each exercise has a rubric defined as structured JSON — dimensions, weights, pass thresholds, example good/bad answers.
- **Two-model strategy via AI Gateway:** Inline tutor calls use a cheaper/faster model (e.g. Haiku-class) for speed and cost. Final evaluation uses a frontier model (e.g. Sonnet/Opus-class) for accuracy. Both routed through AI Gateway for rate limiting and cost control.
- **Scoring pipeline:** Parse model response → extract per-dimension scores → store in D1 → compute self-assessment calibration gap → return to learner.
- **Calibration monitoring:** Compare evaluator scores against calibration corpus (10–15 expert-scored submissions per exercise from volunteer practitioners). Flag exercises where evaluator-expert agreement drops below threshold.
- **Retry and fallback:** If primary model fails, route to secondary via AI Gateway. Never lose a submission.

### Per-Learner Tutor Agent (Durable Object)

One Durable Object instance per enrolled learner:
- **Persistent context:** Knows the learner's progress, scores, weak areas, self-assessment calibration history, and recent submissions.
- **Active during all scored exercises.** The tutor is a co-present guide, not a post-hoc explainer. During CT-6 exercises, it provides paragraph-level feedback using the cheaper model. During CT-2 exercises, it asks diagnostic questions ("What do you expect to see in the console?" "Why did that query fail?").
- **Rubric-aware prompting:** The tutor has access to rubric dimensions for the current exercise. Its inline feedback aligns with how the submission will ultimately be scored, creating consistency between guidance and evaluation.
- **Post-evaluation help:** "Why did my specification fail?" → tutor reads the rubric feedback and explains in the context of what the learner wrote.
- **Not a chatbot.** Scoped to course content and the learner's own work. Does not generate code for them. Does not answer questions outside the curriculum.
- **Hibernation:** Durable Object hibernates when inactive. Wakes on request. Cost only when active.

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
  id                    TEXT PK DEFAULT (hex(randomblob(16)))
  learner_id            TEXT FK → learners.id
  module_id             TEXT NOT NULL
  exercise_id           TEXT NOT NULL
  content_json          TEXT NOT NULL   -- the submission payload
  self_assessment_json  TEXT            -- predicted scores + weakest dimension, before seeing results
  rubric_version        TEXT NOT NULL
  score_json            TEXT            -- null until evaluated
  evaluator_model       TEXT            -- which model scored it
  calibration_gap_json  TEXT            -- computed difference between self-assessment and actual scores
  submitted_at          TEXT DEFAULT (datetime('now'))
  scored_at             TEXT

retrieval_sprints
  learner_id      TEXT FK → learners.id
  gate_module_id  TEXT NOT NULL        -- the module this sprint gates entry to
  responses_json  TEXT NOT NULL        -- learner's answers
  completed_at    TEXT DEFAULT (datetime('now'))
  PRIMARY KEY (learner_id, gate_module_id)
```

### Indexes

```
CREATE INDEX idx_progress_learner ON progress(learner_id);
CREATE INDEX idx_submissions_learner ON submissions(learner_id, module_id);
CREATE INDEX idx_submissions_calibration ON submissions(module_id, exercise_id) WHERE self_assessment_json IS NOT NULL;
```

---

## Cost Model

| Content type | Infra cost per exercise | Inference cost per exercise | MVP frequency |
|-------------|------------------------|---------------------------|---------------|
| CT-1 Narrative | ~$0 (CDN) | $0 | Every section |
| CT-2 Interactive sandbox (client-side variants) | ~$0 (WASM/client) | $0–0.02 (optional eval) | ~8 exercises |
| CT-2 Interactive sandbox (multi-output) | ~$0 | $0.10–0.50 (N calls) | ~2 exercises |
| CT-6 Structured authoring | ~$0 | $0.05–0.20 (inline tutor + eval) | ~8 exercises |
| CT-7 Agent-assisted build (BYOT) | $0 (learner's infra) | $0.10–0.50 (eval only) | ~2 exercises |
| Retrieval sprints | ~$0 | $0 (self-checked) | ~5 sprints |

**Estimated total inference cost per learner completing the MVP:** $2–5, dominated by CT-6 inline tutoring and final evaluations.

**Fixed infrastructure:** Workers Paid ($5/mo), D1 (included), AI Gateway (included). Platform becomes cost-effective at ~50+ concurrent learners.

---

## Security Boundaries

- **Learner isolation:** D1 queries always scoped by `learner_id`. No endpoint returns another learner's data.
- **Evaluator integrity:** Rubrics stored server-side, never sent to the client. Learners cannot see rubric details or manipulate scoring.
- **Submission immutability:** Once submitted, `submissions` rows are append-only. Rescoring creates a new row, doesn't mutate.
- **AI Gateway as chokepoint:** All inference routed through AI Gateway. Per-learner rate limits enforced there. No direct model API access from client.
- **Self-assessment integrity:** Self-assessment predictions are submitted and stored before the evaluation call is made. The learner cannot revise their prediction after seeing the score.

---

## What This Architecture Does NOT Cover (Yet)

- **Platform-hosted agent environments.** Cloudflare Containers with a VibeSDK fork for learners who don't have their own agent tools. Deferred until MVP validates demand and the bring-your-own-tools path reveals friction.
- **Payment/billing.** Out of scope for MVP. Stripe integration is a future layer.
- **Cohort/classroom features.** This is a single-learner self-paced architecture. Instructor dashboards, group exercises, and cohort management are future work.
- **Certificate issuance.** The rubric engine can determine pass/fail. Issuing a verifiable credential is a separate system.
- **Content authoring CMS.** Exercise definitions are JSON files in the codebase. A CMS for non-technical content authors is future work.
- **Mobile app.** SPA is responsive but there is no native app. PWA is a low-cost future option.
- **Full course modules.** Module 5 (Autonomy Spectrum), Module 7 (Users, Data, Dual Interface), Module 9 standalone (Regulation, Future of Pilotry), Module 4 sections 4.4–4.6, and the full final project are designed in the curriculum but not built in the MVP.
- **Simulation exercises (CT-9).** AI-driven synthetic user testing against live applications. Deferred to Module 7 in the full course.
- **Dashboard interpretation exercises (CT-10).** Static analytics dashboards with synthetic data. Deferred to Module 7 in the full course.
