# Content Strategy — Software Pilotry Foundation Course

**Baseline v0.1 — March 2026**

This document maps every module and exercise in the curriculum to the content types defined in [tech-architecture.md](./tech-architecture.md). Content types are referenced as CT-1 through CT-11.

---

## Content Type Quick Reference

| Code | Name | Execution | Cost |
|------|------|-----------|------|
| CT-1 | Narrative | Static (Pages CDN) | ~$0 |
| CT-2 | Constrained code sandbox | Sandpack (client-side) | ~$0 |
| CT-3 | Database sandbox | sql.js WASM (client-side) | ~$0 |
| CT-4 | Diagnostic exercise | Broken page + DevTools | ~$0 |
| CT-5 | Multi-output comparison | AI Gateway × N | Moderate |
| CT-6 | Structured authoring | Editor + AI evaluator | Low |
| CT-7 | Agent-assisted build | Containers / learner tools | High |
| CT-8 | App review | Shared pre-built app | ~$0 |
| CT-9 | Simulation exercise | AI personas × scenarios | Moderate-high |
| CT-10 | Dashboard interpretation | Static synthetic dashboard | ~$0 |
| CT-11 | Case study analysis | Narrative + structured response | Low |

---

## Module 1: The New Landscape (2 hours)

**Primary content types:** CT-1, CT-11, CT-6

| Section | Content | Type | Detail |
|---------|---------|------|--------|
| 1.0 | The barrier collapsed / Three roles / Accountability / Vibe coding / Stopping | CT-1 | Narrative with embedded diagrams. Three-role model visual. Vibe coding spectrum illustration. |
| Ex 1.1 | Three AI-generated software failure case studies | CT-11 | Pre-written case studies (composite from real incidents). Learner answers: who had the problem, who generated the code, who was accountable, what went wrong. AI evaluator scores against rubric for role identification and causal analysis. |
| Ex 1.2 | Write a 200-word problem description in your own domain | CT-6 | Template: problem statement only, no solution. Evaluator rubric dimensions: problem clarity (is the problem distinct from any solution?), stakeholder identification, absence of solution bias. |

**Content authoring notes:**
- Case studies for Ex 1.1 need to be researched and composited. Source candidates: healthcare data breach from AI-generated app, financial calculation error in AI-built tool, accessibility failure in agent-generated UI. Each ~500 words.
- The "three roles" diagram needs to clearly show domain expert / AI agent / software pilot as distinct but overlapping.

---

## Module 2: The Machine Beneath (4 hours)

**Primary content types:** CT-1, CT-2, CT-3, CT-4

| Section | Content | Type | Detail |
|---------|---------|------|--------|
| 2.1 | The Compiler Moment (centrepiece) | CT-2 | **Sandpack instance.** Single editable `main.js` with 5 lines: variable assignment, arithmetic, string concatenation, conditional, `console.log`. Console panel visible. All other files locked/hidden. Template: `vanilla`. Exercise flow: (a) run the code, read the output; (b) modify one line, predict the output before running; (c) get it wrong; (d) learn. Evaluator asks for prediction before revealing result — the prediction/reality gap is the learning moment. |
| 2.2 | The Request Lifecycle | CT-1 + CT-4 | Narrative: DNS → TCP → TLS → HTTP → response → render as a continuous story. Then a **diagnostic exercise**: open Chrome DevTools Network tab on a provided page. Platform serves a page with one broken resource (404). Learner must identify: which request failed, what status code, what the likely cause is. Submit structured report. |
| 2.3 | Data Has Structure | CT-3 | **sql.js sandbox.** Pre-loaded SQLite database (e.g. a `patients` table with name, date_of_birth, appointment_date). Three guided queries: (a) SELECT to retrieve records; (b) INSERT a valid row; (c) INSERT violating a NOT NULL or type constraint. The constraint fails. Learner sees the error. They write: what happened, why, and what rule was violated. |
| 2.4 | The Diagnostic Cockpit: Chrome DevTools | CT-4 | **Broken web page exercise.** Sandpack preview of an agent-generated page with three deliberate errors: (a) JavaScript error visible in Console (e.g. `undefined is not a function`); (b) failed network request visible in Network tab (404 for an image); (c) CSS issue visible in Elements (e.g. `display: none` hiding a required element). Learner submits a structured report identifying all three. AI evaluator scores against the error manifest: 3 errors, must find ≥2 to pass. |

**Content authoring notes:**
- The compiler moment Sandpack config is the single most important piece of content in the entire course. The five lines must be carefully chosen: simple enough for a non-programmer, surprising enough that the prediction step produces genuine "aha" moments. Candidate lines:
  ```js
  let price = 10;
  let tax = price * 0.2;
  let label = "Total: " + (price + tax);
  let cheap = price < 5;
  console.log(label, "| Cheap?", cheap);
  ```
- The broken page for Ex 2.4 should look like a plausible agent-generated app (e.g. a simple dashboard). Errors should be discoverable but not obvious without DevTools.
- sql.js database file (~10KB) stored in R2, fetched on exercise load.

---

## Module 3: The Probabilistic Machine (4 hours)

**Primary content types:** CT-1, CT-5, CT-2, CT-6

| Section | Content | Type | Detail |
|---------|---------|------|--------|
| 3.1 | The Stochastic Moment (centrepiece) | CT-5 | **Multi-output comparison.** Learner writes a one-paragraph specification (e.g. "a function that validates an email address and returns true or false"). Platform submits it 5 times via AI Gateway with identical parameters. 5 responses displayed side by side. Learner writes analysis: what was the same, what differed, which differences matter, which don't. AI evaluator scores the analysis. |
| 3.2 | How Language Models Actually Work | CT-1 | Narrative: token prediction, temperature, context windows, training cutoff, hallucination, jagged frontier. Diagrams: temperature slider visualisation, context window as a sliding window over text. |
| 3.3 | Memory, State, and the Illusion of Continuity | CT-6 | **Three-session exercise.** Learner works with an agent across three simulated sessions on the same project (platform manages context). In session two, they introduce a deliberate requirement change contradicting session one. In session three, they ask for a requirements summary. Learner documents what the agent got right, wrong, and invented. Evaluated on observation quality. Implementation: Durable Object manages the three-session context, injecting contradictions at prescribed points. |
| 3.4 | Model Selection as a Pilotry Skill | CT-1 | Narrative: frontier vs. edge vs. specialised models. Decision framework table (task complexity, data sensitivity, latency, cost). No exercise — conceptual framework, reinforced in later modules. |

**Content authoring notes:**
- For CT-5 (stochastic moment), the spec prompt must be carefully constrained — simple enough that 5 outputs are comparable, complex enough that meaningful differences emerge. Email validation is a strong candidate because there's genuine ambiguity in what "valid" means.
- The three-session exercise (3.3) is the most technically complex content type. It requires a Durable Object to maintain multi-session state and inject contradictions. This is a custom content type variant of CT-6. Build it as a reusable "multi-session agent exercise" component.

---

## Module 4: Specification — The Pilot's Primary Skill (5 hours)

**Primary content types:** CT-1, CT-6, CT-8

| Section | Content | Type | Detail |
|---------|---------|------|--------|
| 4.1 | Problem Before Solution | CT-6 | Learner is given a vague brief ("I need a booking system for my dental practice"). Must generate 15 clarifying questions before writing any specification. Evaluator rubric: would the questions change the solution? Questions like "How many dentists?" score higher than "What colour should the buttons be?" |
| 4.2 | Testable Acceptance Criteria | CT-6 | Rewrite 5 vague requirements as testable acceptance criteria. Each must include: actor, action, expected outcome, measurable threshold, failure case. Evaluator scores each criterion independently on measurability and completeness. Platform provides the 5 vague requirements as input. |
| 4.3 | Edge Cases and Failure Modes | CT-8 + CT-6 | Given an agent-generated CRUD app (pre-built, shared — CT-8), find and document 5 unhandled edge cases. Then write the specification addenda that would have prevented each. Evaluator scores on edge case severity and specification precision. The app is deliberately built without edge case handling — empty inputs succeed, concurrent edits overwrite, long strings overflow. |
| 4.4 | Decomposition and Sequencing | CT-6 | Given a product brief (e.g. "project management tool for a small construction company"), decompose into 8–12 user stories, sequence by dependency, identify the walking skeleton. Evaluator scores on: vertical slicing, dependency logic, walking skeleton identification. |
| 4.5 | Constraint Specification | CT-6 | For the dental booking system from 4.1, write the constraint specification: authentication, data privacy (patient health records), availability, accessibility. Evaluator scores on completeness and regulatory awareness (GDPR/health data is the critical dimension). |
| 4.6 | Specification for Different Audiences | CT-1 | Narrative: how specification detail varies by agent autonomy level. More autonomous agents need more constraints, less procedural guidance. Reference back to Module 5 (taught out of order — this section previews concepts Module 5 will formalise). |

**Content authoring notes:**
- Module 4 is the longest and most important. Six exercises, all CT-6 (structured authoring with AI evaluation). The evaluator rubrics here need the most careful design — specification quality is subjective, so rubrics must be very specific about what "testable" means, what "measurable threshold" means, etc.
- The pre-built CRUD app for 4.3 (CT-8) should be a simple form-based app — contacts list or task manager. Build it once, serve to all learners. Deliberately omit: input validation, concurrent edit handling, input length limits, error states for missing data, and XSS sanitisation.
- The five vague requirements for 4.2 need to span different types: performance ("the system should be fast"), security ("users can log in"), UX ("the interface should be intuitive"), data ("the system should store customer information"), and reliability ("it should always work").

---

## Module 5: The Autonomy Spectrum (3 hours)

**Primary content types:** CT-1, CT-11

| Section | Content | Type | Detail |
|---------|---------|------|--------|
| 5.1 | The Spectrum | CT-1 | Narrative: five-level taxonomy from structured workflow to self-modifying system. Interactive visual: a slider or stepped diagram showing how failure modes change at each level. Pilot role evolution: operator → supervisor → director → governor. |
| 5.2 | Multi-Agent Coordination | CT-1 | Narrative: promise and risk of agent swarms. Groupthink hallucination, circular validation, architectural incoherence. Air traffic control analogy. |
| 5.3 | Agentic Agency | CT-1 | Narrative: what self-direction actually means. The trajectory (12-month view). |
| Ex 5.1 | Agent risk classification | CT-11 | Three agent tool descriptions provided (one workflow, one semi-autonomous, one swarm). Learner classifies each on the spectrum, identifies failure modes, writes a risk assessment for using each on a patient-facing healthcare app. Evaluator scores on: correct classification, failure mode identification, risk reasoning. |

**Content authoring notes:**
- The three agent descriptions for Ex 5.1 should be anonymised but recognisable composites. E.g. Description A reads like a CI/CD pipeline with AI steps, B reads like Claude Code, C reads like a multi-agent review team. Learners should be able to classify even without knowing the specific tools.
- The autonomy spectrum visual should be interactive — hover/tap reveals failure modes at each level. Implementable as a Sandpack embed with a simple React component, or as vanilla HTML/CSS/JS within the SPA.

---

## Module 6: Building with Agents (4 hours)

**Primary content types:** CT-1, CT-7, CT-4, CT-8, CT-6

| Section | Content | Type | Detail |
|---------|---------|------|--------|
| 6.1 | The Build Cycle | CT-1 + CT-7 | Narrative introduces the cycle: spec → prompt → output → review → diagnose → refine → iterate. Then the learner does it: using either the platform-hosted agent environment (Container + VibeSDK fork) or their own tools, build a working app from a specification they wrote in Module 4. **This is the first CT-7 exercise.** |
| 6.2 | Applied Diagnostics | CT-4 | The app built in 6.1 will have issues. Learner uses DevTools to diagnose: console errors, network failures, environment issues. Structured report submitted. This is CT-4 applied to the learner's own build, not a pre-made broken page. |
| 6.3 | Security Awareness in Practice | CT-8 + CT-6 | Pre-built agent-generated app with 3 deliberate security flaws: hardcoded API key, unprotected route, unsanitised user input. Learner finds all three, describes in plain language, writes the constraint spec that would have prevented each. |
| 6.4 | Knowing Your Limits | CT-6 | Given a project brief, assess against the 7 warning signs. Write a hiring brief for a software pilot: what expertise is needed, what success looks like. Evaluator scores on honest self-assessment and brief quality. |

**Content authoring notes:**
- **CT-7 is the critical path.** This is where the platform either delivers or doesn't. Two options must work:
  - **Platform-hosted:** VibeSDK fork in a Container. Learner pastes their spec from Module 4 into the build UI. Agent generates the app. Learner reviews against their own acceptance criteria. Iterates.
  - **Bring-your-own-tools:** Learner builds in Claude Code, Cursor, Windsurf, etc. Uploads a zip or provides a URL. Platform evaluates the submitted artefact.
- Both paths converge at evaluation: the platform scores the output against the learner's own specification from Module 4. This is a unique evaluation pattern — the rubric is partially generated by the learner themselves.
- The security flaw app for 6.3 (CT-8): build a simple Node/Express app. Hardcode an API key in a client-side script tag. Leave one route unprotected behind no auth check. Pass a form field directly into a SQL query string. Serve from a shared Container or Pages.

---

## Module 7: Users, Data, and the Dual Interface (4 hours)

**Primary content types:** CT-1, CT-9, CT-10, CT-6

| Section | Content | Type | Detail |
|---------|---------|------|--------|
| 7.1 | The Dual Interface | CT-1 | Narrative: every interface consumed by humans and agents. Semantic structure, API-first design, machine-readable metadata, accessibility as dual-use investment. |
| 7.2 | Agentic UX Patterns | CT-1 | Narrative: confidence communication, override design, automation complacency, progressive disclosure, error recovery. Illustrated with annotated screenshots/mockups of good and bad patterns. |
| 7.3 | Simulation and Synthetic Testing | CT-9 | **Simulation exercise.** For a given application (the app from Module 6, or a provided one), learner defines 3 user personas with distinct needs (e.g. tech-savvy power user, elderly first-time user, user with visual impairment). Writes 3 scenarios per persona. Platform runs the personas as synthetic tests via AI. Learner interprets results. Evaluator scores persona quality, scenario coverage, and interpretation. |
| 7.4 | Observability: Your Black Box Recorder | CT-1 + CT-4 | Narrative: logging, tracing, telemetry. Then a diagnostic exercise: two identical-looking apps, one with logging and one without. Both broken. Learner attempts to diagnose both. The point: the one without logs is a brick wall. Structured report. |
| 7.5 | Reading Data: Analytics as a Pilotry Skill | CT-10 | **Dashboard interpretation.** Simulated SaaS dashboard with synthetic data. Five questions: conversion rate, onboarding drop-off point, performance trend, error-prone segment, next investigation. AI evaluator scores against known answers. |

**Content authoring notes:**
- The simulation exercise (7.3) is technically ambitious. The platform needs to: (a) accept persona + scenario definitions, (b) generate synthetic user behaviour via AI against a target app, (c) report pass/fail per scenario. This is a specialised CT-9 implementation. Consider a simpler v1 where the "simulation" is the AI evaluator reasoning about what would happen, rather than actually interacting with the app.
- The analytics dashboard (7.5) should be a static React component with realistic-looking charts (recharts or similar). Data is pre-computed and baked in — no live data connection. Design it to look like a real Mixpanel/Amplitude dashboard. Synthetic data for a hypothetical SaaS: ~6 months of data, clear trends, one anomaly, one underperforming segment.
- The observability exercise (7.4) requires two versions of the same app: one that writes structured logs, one that doesn't. Both have the same bug. Serve both from Pages. When the learner tries to diagnose the no-logs version, they hit a wall. That's the lesson.

---

## Module 8: Verification and Acceptance (3 hours)

**Primary content types:** CT-1, CT-8, CT-6

| Section | Content | Type | Detail |
|---------|---------|------|--------|
| 8.1 | The Verification Problem | CT-1 | Narrative: why agent-generated tests are insufficient. The agent writes tests that pass its own broken code. Five verification strategies: specification-driven review, independent test generation, edge case probing, adversarial testing, user simulation. |
| 8.2 | The Pre-Launch Checklist | CT-1 + CT-6 | Narrative presents the checklist (functionality, security, performance, accessibility, observability, legal/compliance, pilot fitness). Learner applies it to their Module 6 build. Structured submission covering each checklist section. |
| 8.3 | The Go/No-Go Decision | CT-8 + CT-6 | **Provided:** a completed verification report for a pre-built app (some items pass, some fail — realistic mixed results). Learner makes the call: ship or don't ship. Writes 300-word justification covering: what passed, what failed, risk of shipping with known issues, mitigation plan, recommendation. Evaluator scores on reasoning quality, risk awareness, and honesty about tradeoffs. |

**Content authoring notes:**
- The verification report for 8.3 needs to be realistic and genuinely ambiguous — not obvious pass or fail. Design it so reasonable people could disagree. E.g.: all functionality works, one security issue (low severity), performance is borderline, accessibility has one WCAG AA failure, no logging configured. The "right" answer isn't ship or don't ship — it's the quality of the reasoning.
- The pre-launch checklist should be a reusable component (CT-6 template) that learners also use in the final project. Build it once as a structured form with yes/no/na per item plus evidence text fields.

---

## Module 9: Responsibility, Risk, and Sustainable Practice (3 hours)

**Primary content types:** CT-1, CT-6

| Section | Content | Type | Detail |
|---------|---------|------|--------|
| 9.1 | The Accountability Landscape | CT-1 | Narrative: product liability, EULA disclaimers, no professional licensing for software, no case law on AI-generated code harm. |
| 9.2 | Your Responsibilities as the Deploying Party | CT-1 | Narrative: GDPR, CCPA, accessibility law, consumer protection, duty of care. Jurisdiction-dependent, so taught as awareness ("these exist, know when to get legal advice"). |
| 9.3 | Sustainable Pilotry | CT-1 + CT-6 | Narrative: the new pressure, infinite capacity illusion, what fatigue does to pilotry, FAA Part 117 precedent. Then the **personal practice charter exercise**: learner defines weekly hour limit, mandatory rest periods, session stop rule, go/no-go delay rule. Evaluator scores on: concreteness (are the limits specific?), honesty (are they realistic?), enforceability (how would you actually stick to this?). |
| 9.4 | The Future of Pilotry | CT-1 | Narrative: trajectory of agent capabilities, the evolving pilot role, the manifesto, the call to action. |

**Content authoring notes:**
- The sustainable practice charter (9.3) is unusual — the evaluator isn't checking for a "right answer" but for quality of self-reflection. The rubric needs to reward specificity ("I will not work with agents past 8pm on weekdays" > "I will try to take breaks") and self-awareness ("I know I'm susceptible to the one-more-thing cycle because I've done it" > generic pledges).
- Module 9 is the lightest on interactive content. That's appropriate — it's reflective and conceptual. Don't over-engineer it.

---

## Final Project: Build, Verify, Launch (6–10 hours)

**Primary content types:** CT-6, CT-7, CT-4, CT-9, CT-8

The final project is a full pilotry cycle. It chains multiple content types into a single assessed workflow.

| Step | Curriculum reference | Type | Detail |
|------|---------------------|------|--------|
| 1. Problem definition | Module 1, 4 | CT-6 | Learner identifies a real problem in their domain. Writes the problem statement only. |
| 2. Specification | Module 4 | CT-6 | Full specification: acceptance criteria, edge cases, constraints, decomposition. This becomes the rubric input for later steps. |
| 3. Agent-assisted build | Module 6 | CT-7 | Build the application. Platform-hosted or bring-your-own-tools. |
| 4. Diagnostic cycle | Module 2, 3, 6 | CT-4 | Diagnose and resolve ≥3 issues using DevTools and agent iteration. Document each: symptom, diagnosis method, resolution. |
| 5. User and data assessment | Module 7 | CT-6 + CT-9 | Define personas, describe instrumentation plan, identify post-launch metrics. Optional: run synthetic test. |
| 6. Verification | Module 8 | CT-6 + CT-8 | Complete the pre-launch checklist against their own app. Document all test results. |
| 7. Go/no-go decision | Module 8 | CT-6 | Written justification: ship or don't ship, with reasoning. |
| 8. Complexity assessment | Module 6 | CT-6 | Honest assessment: does this project need a professional pilot? If so, what expertise and why? |

**Evaluation:** Each step scored independently against its rubric. Overall score weighted per the curriculum rubric:

| Dimension | Weight | Steps assessed |
|-----------|--------|---------------|
| Problem clarity | 15% | Step 1 |
| Specification quality | 25% | Step 2 |
| Build execution | 15% | Steps 3, 4 |
| Verification rigour | 20% | Steps 5, 6 |
| Judgment and accountability | 15% | Steps 7, 8 |
| Communication | 10% | All steps (writing quality) |

**Content authoring notes:**
- The final project is learner-directed — they choose the problem domain. This means the evaluator cannot use a fixed answer key. Instead, the evaluator assesses structural quality: are acceptance criteria actually testable? Are edge cases plausible? Is the go/no-go reasoning sound? This is a harder evaluation problem than fixed-answer exercises.
- Consider offering 3–5 "starter briefs" for learners who don't have a domain problem in mind. E.g.: booking system for a yoga studio, inventory tracker for a food truck, patient intake form for a physiotherapy clinic, event RSVP system for a community group, invoice generator for a freelancer.

---

## Content Production Pipeline

### Per exercise, the content team produces:

1. **Exercise definition** (JSON): content type, template files, rubric ID, prerequisites, time estimate.
2. **Rubric** (JSON): dimensions, weights, pass threshold per dimension, example good/bad responses for evaluator calibration.
3. **Assets:** Sandpack file configs, pre-built apps (for CT-8), database seed files (for CT-3), dashboard data (for CT-10), case study text (for CT-11).
4. **Evaluator prompt template:** The system prompt sent to AI Gateway along with the rubric and learner submission. Must be tested against 10+ sample submissions before going live.

### Estimated content volume:

| Content piece | Count |
|--------------|-------|
| Narrative sections | ~30 |
| Exercise definitions | ~25 |
| Evaluator rubrics | ~25 |
| Sandpack configurations | ~8 |
| Pre-built apps (CT-8) | 3–4 |
| Database seed files | 1–2 |
| Case studies | 3 |
| Dashboard mockups | 1–2 |
| Starter briefs (final project) | 3–5 |

---

## Layer 3 Reference Labs — Content Approach

Reference labs are standalone, not part of the scored curriculum. Each is a single exercise combining CT-1 (narrative) with one hands-on content type.

| Lab | Primary CT | Approach |
|-----|-----------|----------|
| R1: Docker and containers | CT-1 + CT-2 | Narrative + Sandpack showing Dockerfile build output (simulated) |
| R2: Email (SMTP, SPF/DKIM) | CT-1 | Narrative only — email infrastructure is conceptual at this level |
| R3: WebSockets and SSE | CT-2 | Sandpack with a simple WebSocket client showing real-time messages |
| R4: Canvas and visual rendering | CT-2 | Sandpack with HTML Canvas drawing exercise |
| R5: DNS deep dive | CT-1 + CT-4 | Narrative + diagnostic exercise using `dig` output (simulated terminal) |
| R6: Git and version control | CT-1 | Narrative with interactive visualisation of branching (static React component) |
| R7: API design and REST | CT-2 | Sandpack with fetch() calls to a mock API |
| R8: Specific agent tool guides | CT-1 | Narrative only — updated quarterly as tools change |
| R9: Deployment platforms | CT-1 | Narrative comparing Cloudflare Workers, Vercel, Railway, Fly.io |
| R10: Mobile considerations | CT-1 | Narrative on responsive design, PWAs, native vs. web |

Reference labs do not require AI evaluation. They are self-paced, self-assessed, and exist to fill knowledge gaps on demand.
