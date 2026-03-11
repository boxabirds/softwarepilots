# Content Strategy — Software Pilotry Foundation Course (MVP)

**Baseline v0.2 — March 2026**

This document maps every module and exercise in the MVP curriculum to the content types defined in [tech-architecture.md](./tech-architecture.md). Content types are CT-1, CT-2, CT-6, and CT-7.

---

## Content Type Quick Reference

| Code | Name | Execution | Cost |
|------|------|-----------|------|
| CT-1 | Narrative | Static (Pages CDN) | ~$0 |
| CT-2 | Interactive sandbox | Client-side (Pyodide / Sandpack / sql.js / AI Gateway) | ~$0 (multi-output variant: moderate) |
| CT-6 | Structured authoring | Editor + inline tutor (cheaper model) + AI evaluator (frontier model) | Low-moderate |
| CT-7 | Agent-assisted build | Learner's own tools + AI evaluator | Low |

**All scored exercises include:**
- **Inline tutor** — active during the exercise, providing real-time paragraph-level or step-level feedback via cheaper model
- **Self-assessment checkpoint** — before seeing scores, learner predicts their performance and identifies weakest dimension

---

## MVP Module Sequence

Mastery gates enforce linear progression. Retrieval sprints at module boundaries revisit earlier concepts.

```
Module 1 → Module 2 → [retrieval sprint: M1] → Module 3 → [retrieval sprint: M2] →
Module 4 → [retrieval sprint: M2, M3] → Module 6 → [retrieval sprint: M3, M4] →
Module 8 → Final Project
```

---

## Module 1: The New Landscape (2 hours)

**Primary content types:** CT-1, CT-6

| Section | Content | Type | Detail |
|---------|---------|------|--------|
| 1.0 | The barrier collapsed / Three roles / Accountability / Vibe coding / Stopping | CT-1 | Narrative with embedded diagrams. Three-role model visual. Vibe coding spectrum illustration. |
| Ex 1.1 | Three AI-generated software failure case studies | CT-1 + CT-6 | Pre-written case studies (composite from real incidents). Learner answers structured questions: who had the problem, who generated the code, who was accountable, what went wrong. AI evaluator scores against rubric for role identification and causal analysis. |
| Ex 1.2 | Write a 200-word problem description in your own domain | CT-6 | Template: problem statement only, no solution. Evaluator rubric dimensions: problem clarity (is the problem distinct from any solution?), stakeholder identification, absence of solution bias. |

**Content authoring notes:**
- Case studies for Ex 1.1 need to be researched and composited. Source candidates: healthcare data breach from AI-generated app, financial calculation error in AI-built tool, accessibility failure in agent-generated UI. Each ~500 words.
- The "three roles" diagram needs to clearly show domain expert / AI agent / software pilot as distinct but overlapping.

---

## Module 2: The Machine Beneath (4 hours)

**Primary content types:** CT-1, CT-2

| Section | Content | Type | Detail |
|---------|---------|------|--------|
| 2.1 | The Compiler Moment (centrepiece) | CT-2 (Python/Pyodide) | **Pyodide instance.** Single editable Python file with 5 lines: variable assignment, arithmetic, string building, conditional, `print`. Console panel visible. Exercise flow: (a) run the code, read the output; (b) modify one line, predict the output before running; (c) get it wrong; (d) learn. The tutor asks for prediction before revealing result — the prediction/reality gap is the learning moment. |
| 2.2 | The Request Lifecycle | CT-1 + CT-2 (diagnostic) | Narrative: DNS → TCP → TLS → HTTP → response → render as a continuous story. Then a **diagnostic exercise**: open Chrome DevTools Network tab on a provided page. Platform serves a page with one broken resource (404). Learner must identify: which request failed, what status code, what the likely cause is. Submit structured report. |
| 2.3 | Data Has Structure | CT-2 (sql.js) | **sql.js sandbox.** Pre-loaded SQLite database (e.g. a `patients` table with name, date_of_birth, appointment_date). Three guided queries: (a) SELECT to retrieve records; (b) INSERT a valid row; (c) INSERT violating a NOT NULL or type constraint. The constraint fails. Learner sees the error. They write: what happened, why, and what rule was violated. |
| 2.4 | The Diagnostic Cockpit: Chrome DevTools | CT-2 (diagnostic) | **Broken web page exercise.** Sandpack preview of an agent-generated page with three deliberate errors: (a) JavaScript error visible in Console (e.g. `undefined is not a function`); (b) failed network request visible in Network tab (404 for an image); (c) CSS issue visible in Elements (e.g. `display: none` hiding a required element). Learner submits structured report identifying all three. AI evaluator scores against the error manifest. Note: learners *inspect* JavaScript here — they don't write it. The diagnostic skill is reading error messages regardless of language. |

**Content authoring notes:**
- The compiler moment Pyodide config is the single most important piece of content in the entire course. The five lines must be carefully chosen: simple enough for a non-programmer, surprising enough that the prediction step produces genuine "aha" moments. Candidate lines:
  ```python
  price = 10
  tax = price * 0.2
  label = "Total: " + str(price + tax)
  cheap = price < 5
  print(label, "| Cheap?", cheap)
  ```
  The `str()` call is a better teaching moment than JavaScript's silent coercion — removing it produces a TypeError, which is the compiler moment landing exactly as intended: the machine is precise and literal.
- The broken page for Ex 2.4 should look like a plausible agent-generated app (e.g. a simple dashboard). Errors should be discoverable but not obvious without DevTools.
- sql.js database file (~10KB) stored in R2, fetched on exercise load.

---

## Retrieval Sprint: Module 1

**Gate:** Must complete before entering Module 3.
**Format:** 3–5 quick-recall questions, self-checked, no AI evaluation. ~10 minutes.
**Sample questions:**
- Name the three roles in the software pilotry model and describe each in one sentence.
- A user reports that an AI-generated app leaked patient data. Who is accountable and why?
- What distinguishes vibe coding from pilotry? When is vibe coding appropriate?

---

## Module 3: The Probabilistic Machine (4 hours)

**Primary content types:** CT-1, CT-2, CT-6

| Section | Content | Type | Detail |
|---------|---------|------|--------|
| 3.1 | The Stochastic Moment (centrepiece) | CT-2 (multi-output) | **Multi-output comparison.** Learner writes a one-paragraph specification (e.g. "a function that validates an email address and returns true or false"). Platform submits it 5 times via AI Gateway with identical parameters. 5 responses displayed side by side. Learner writes analysis: what was the same, what differed, which differences matter, which don't. AI evaluator scores the analysis. |
| 3.2 | How Language Models Actually Work | CT-1 | Narrative: token prediction, temperature, context windows, training cutoff, hallucination, jagged frontier, cognitive surrender (Shaw & Nave, 2026 — Tri-System Theory, System 3 as artificial cognition, N=1,372 experimental evidence that people adopt AI outputs without scrutiny, accuracy drops 15pp when AI errs). Diagrams: temperature slider visualisation, context window as a sliding window over text. |
| 3.3 | Memory, State, and the Illusion of Continuity | CT-6 | **Three-session exercise.** Learner works with an agent across three simulated sessions on the same project (platform manages context). In session two, they introduce a deliberate requirement change contradicting session one. In session three, they ask for a requirements summary. Learner documents what the agent got right, wrong, and invented. Evaluated on observation quality. Implementation: Durable Object manages the three-session context, injecting contradictions at prescribed points. |
| 3.4 | Model Selection as a Pilotry Skill | CT-1 | Narrative: frontier vs. edge vs. specialised models. Decision framework table (task complexity, data sensitivity, latency, cost). No exercise — conceptual framework, reinforced in later modules. |

**Content authoring notes:**
- For the stochastic moment, the spec prompt must be carefully constrained — simple enough that 5 outputs are comparable, complex enough that meaningful differences emerge. Email validation is a strong candidate because there's genuine ambiguity in what "valid" means.
- The three-session exercise (3.3) is the most technically complex content type variant. It requires a Durable Object to maintain multi-session state and inject contradictions. Build it as a reusable "multi-session agent exercise" component.

---

## Retrieval Sprint: Module 2

**Gate:** Must complete before entering Module 4.
**Format:** 3–5 quick-recall questions, self-checked. ~10 minutes.
**Sample questions:**
- A page loads but shows no data. You open the Network tab and see a request with status 500. What does that mean? Where is the problem?
- What is the difference between a 401 and a 403 status code?
- You try to insert a row into a database and get a constraint violation. What does that tell you?

---

## Module 4: Specification — The Pilot's Primary Skill (2.5 hours, MVP scope)

**Primary content types:** CT-1, CT-6, CT-2

**MVP scope:** Sections 4.1–4.3 only. Sections 4.4 (Decomposition), 4.5 (Constraints), and 4.6 (Specification for Different Audiences) are deferred to the full course.

| Section | Content | Type | Detail |
|---------|---------|------|--------|
| 4.1 | Problem Before Solution | CT-6 | Learner is given a vague brief ("I need a booking system for my dental practice"). Must generate 15 clarifying questions before writing any specification. Evaluator rubric: would the questions change the solution? Questions like "How many dentists?" score higher than "What colour should the buttons be?" |
| 4.2 | Testable Acceptance Criteria | CT-6 | Rewrite 5 vague requirements as testable acceptance criteria. Each must include: actor, action, expected outcome, measurable threshold, failure case. Evaluator scores each criterion independently on measurability and completeness. Platform provides the 5 vague requirements as input. Inline tutor prompts: "What's the measurable threshold?" "What happens when this fails?" Semantic triangulation concept introduced: code, tests, and specification as three independent angles on the same intent — where any two diverge, it signals a hidden assumption. |
| 4.3 | Edge Cases and Failure Modes | CT-2 (diagnostic) + CT-6 | Given an agent-generated CRUD app (pre-built, shared), find and document 5 unhandled edge cases. Then write the specification addenda that would have prevented each. Evaluator scores on edge case severity and specification precision. The app is deliberately built without edge case handling — empty inputs succeed, concurrent edits overwrite, long strings overflow. **Embedded callback to Module 2:** learner must use DevTools to discover at least one edge case (e.g. a console error on empty input). |

**Content authoring notes:**
- Module 4 exercises are all CT-6 (structured authoring with AI evaluation). The evaluator rubrics here need the most careful design — specification quality is subjective, so rubrics must be very specific about what "testable" means, what "measurable threshold" means, etc.
- The pre-built CRUD app for 4.3 should be a simple form-based app — contacts list or task manager. Build it once, serve to all learners. Deliberately omit: input validation, concurrent edit handling, input length limits, error states for missing data, and XSS sanitisation.
- The five vague requirements for 4.2 need to span different types: performance ("the system should be fast"), security ("users can log in"), UX ("the interface should be intuitive"), data ("the system should store customer information"), and reliability ("it should always work").

---

## Retrieval Sprint: Modules 2 & 3

**Gate:** Must complete before entering Module 6.
**Format:** 3–5 quick-recall questions, self-checked. ~10 minutes.
**Sample questions:**
- You give the same specification to an AI agent twice and get different code. Why? What does this mean for verification?
- What is cognitive surrender and why is it dangerous for a software pilot?
- An agent claims its code "passes all tests." Why is this insufficient evidence that the software works?

---

## Module 6: Building with Agents (3 hours)

**Primary content types:** CT-1, CT-7, CT-2, CT-6

| Section | Content | Type | Detail |
|---------|---------|------|--------|
| 6.1 | The Build Cycle | CT-1 + CT-7 | Narrative introduces the cycle: spec → prompt → output → review → diagnose → refine → iterate. Then the learner does it: using their own agent tool (Claude Code, Cursor, Windsurf, or similar), build a working app from a specification they wrote in Module 4. Learner submits a URL or uploads a bundle for evaluation. **Embedded callback to Module 4:** the specification they wrote IS the input — they experience the consequences of their own specification quality. |
| 6.2 | Applied Diagnostics | CT-2 (diagnostic) | The app built in 6.1 will have issues. Learner uses DevTools to diagnose: console errors, network failures, environment issues. Structured report submitted. **Embedded callback to Module 2:** this is the DevTools cockpit from 2.4 applied to the learner's own build, not a pre-made broken page. |
| 6.3 | Security Awareness in Practice | CT-2 (diagnostic) + CT-6 | Pre-built agent-generated app with 3 deliberate security flaws: hardcoded API key, unprotected route, unsanitised user input. Learner finds all three, describes in plain language, writes the constraint spec that would have prevented each. |
| 6.4 | Knowing Your Limits | CT-6 | Given a project brief, assess against the 7 warning signs. Write a hiring brief for a software pilot: what expertise is needed, what success looks like. Evaluator scores on honest self-assessment and brief quality. |

**Content authoring notes:**
- **Bring-your-own-tools is the only path for MVP.** Learner builds in their preferred agent environment. Platform evaluates the submitted artefact. Both paths converge at evaluation: the platform scores the output against the learner's own specification from Module 4.
- The security flaw app for 6.3: build a simple Node/Express app. Hardcode an API key in a client-side script tag. Leave one route unprotected behind no auth check. Pass a form field directly into a SQL query string. Serve from Pages as a shared static app.

---

## Retrieval Sprint: Modules 3 & 4

**Gate:** Must complete before entering Module 8.
**Format:** 3–5 quick-recall questions, self-checked. ~10 minutes.
**Sample questions:**
- Write one testable acceptance criterion for: "The system should handle errors gracefully." Include actor, action, threshold, and failure case.
- You built an app with an AI agent and it works. What are three reasons you should NOT trust it?
- What is the difference between an edge case and a failure mode?

---

## Module 8: Verification, Acceptance, and Sustainable Practice (3 hours)

**Primary content types:** CT-1, CT-2, CT-6

This module combines the original Module 8 (Verification and Acceptance) with the wellbeing core from Module 9 (Sustainable Practice). The regulation and accountability landscape from Module 9 is deferred to the full course.

| Section | Content | Type | Detail |
|---------|---------|------|--------|
| 8.1 | The Verification Problem | CT-1 | Narrative: why agent-generated tests are insufficient — the agent writes tests that pass its own broken code. The collapse of code review as motivation: traditional review is buckling under AI-generated volume (Latent Space/Faros.ai data — 98% more PRs, 91% longer reviews, developers report AI code harder to review than human code). Verification must move upstream to specification and downstream to independent acceptance testing. Five verification strategies: specification-driven review, independent test generation, edge case probing, adversarial testing, user simulation. Braess's Paradox: making coding faster can slow overall delivery by shifting bottlenecks downstream (METR trial: experienced devs 19% slower with AI tools). |
| 8.2 | The Pre-Launch Checklist | CT-1 + CT-6 | Narrative presents the checklist (functionality, security, performance, accessibility, observability, legal/compliance, pilot fitness). Learner applies it to their Module 6 build. Structured submission covering each checklist section. |
| 8.3 | Sustainable Practice and Pilot Fitness | CT-1 + CT-6 | Narrative: the new pressure (AI removes natural friction that limited overwork), the infinite capacity illusion, what fatigue does to pilotry (vague specifications, unchallenged agent output, skipped verification), cognitive surrender amplified by fatigue (Shaw & Nave), the FAA Part 117 precedent (duty limits exist because self-regulation fails). **Personal practice charter exercise:** learner defines weekly hour limit, mandatory rest periods, session stop rule, go/no-go delay rule. Evaluator scores on concreteness, honesty, and enforceability — not on the specific numbers. |
| 8.4 | The Go/No-Go Decision | CT-6 | **Provided:** a completed verification report for a pre-built app (some items pass, some fail — realistic mixed results). Learner makes the call: ship or don't ship. Writes 300-word justification covering: what passed, what failed, risk of shipping with known issues, mitigation plan, recommendation. The pre-launch checklist includes pilot fitness: "Am I rested enough to be making this decision?" Evaluator scores on reasoning quality, risk awareness, and honesty about tradeoffs. |

**Content authoring notes:**
- The verification report for 8.4 needs to be realistic and genuinely ambiguous — not obvious pass or fail. Design it so reasonable people could disagree. E.g.: all functionality works, one security issue (low severity), performance is borderline, accessibility has one WCAG AA failure, no logging configured. The "right" answer isn't ship or don't ship — it's the quality of the reasoning.
- The pre-launch checklist should be a reusable component (CT-6 template) that learners also use in the final project. Build it once as a structured form with yes/no/na per item plus evidence text fields.
- The sustainable practice charter (8.3) is unusual — the evaluator isn't checking for a "right answer" but for quality of self-reflection. The rubric needs to reward specificity ("I will not work with agents past 8pm on weekdays" > "I will try to take breaks") and self-awareness ("I know I'm susceptible to the one-more-thing cycle because I've done it" > generic pledges).

---

## Final Project: Build, Verify, Launch

**Hours:** Variable (estimated 4–6 hours for MVP scope)
**Primary content types:** CT-6, CT-7, CT-2

The final project is a full pilotry cycle. It chains multiple content types into a single assessed workflow.

| Step | Curriculum reference | Type | Detail |
|------|---------------------|------|--------|
| 1. Problem definition | Module 1, 4 | CT-6 | Learner identifies a real problem in their domain. Writes the problem statement only. |
| 2. Specification | Module 4 | CT-6 | Specification with acceptance criteria and edge cases (MVP scope: 4.1–4.3 skills). This becomes the rubric input for later steps. |
| 3. Agent-assisted build | Module 6 | CT-7 | Build the application using own agent tools. Submit URL or bundle. |
| 4. Diagnostic cycle | Module 2, 6 | CT-2 (diagnostic) | Diagnose and resolve ≥3 issues using DevTools and agent iteration. Document each: symptom, diagnosis method, resolution. |
| 5. Verification | Module 8 | CT-6 | Complete the pre-launch checklist against their own app. Document all test results. Include pilot fitness check. |
| 6. Go/no-go decision | Module 8 | CT-6 | Written justification: ship or don't ship, with reasoning. |
| 7. Complexity assessment | Module 6 | CT-6 | Honest assessment: does this project need a professional pilot? If so, what expertise and why? |

**Evaluation:** Each step scored independently against its rubric. Overall score weighted per the curriculum rubric:

| Dimension | Weight | Steps assessed |
|-----------|--------|---------------|
| Problem clarity | 15% | Step 1 |
| Specification quality | 25% | Step 2 |
| Build execution | 15% | Steps 3, 4 |
| Verification rigour | 25% | Steps 5, 6 |
| Judgment and accountability | 20% | Steps 6, 7 |

**Content authoring notes:**
- The final project is learner-directed — they choose the problem domain. This means the evaluator cannot use a fixed answer key. Instead, the evaluator assesses structural quality: are acceptance criteria actually testable? Are edge cases plausible? Is the go/no-go reasoning sound? This is a harder evaluation problem than fixed-answer exercises.
- Consider offering 3–5 "starter briefs" for learners who don't have a domain problem in mind. E.g.: booking system for a yoga studio, inventory tracker for a food truck, patient intake form for a physiotherapy clinic, event RSVP system for a community group, invoice generator for a freelancer.

---

## Content Production Pipeline

### Per exercise, the content team produces:

1. **Exercise definition** (JSON): content type, variant, template files, rubric ID, prerequisites, time estimate.
2. **Rubric** (JSON): dimensions, weights, pass threshold per dimension, 10–15 expert-scored sample submissions (from volunteer practitioners) for evaluator calibration.
3. **Tutor prompt template:** The system prompt for the inline tutor, including rubric dimensions and example prompts. Must be tested for helpfulness without giving away answers.
4. **Assets:** Pyodide/Sandpack file configs, pre-built apps (for diagnostic exercises), database seed files, retrieval sprint question sets.
5. **Evaluator prompt template:** The system prompt sent to AI Gateway (frontier model) along with the rubric and learner submission. Must be tested against calibration corpus before going live.
6. **Self-assessment template:** The prediction prompt shown before scoring — which dimensions to predict on, how to frame the weakest-dimension question.

### Estimated content volume (MVP):

| Content piece | Count |
|--------------|-------|
| Narrative sections | ~15 |
| Scored exercise definitions | ~12 |
| Evaluator rubrics | ~12 |
| Tutor prompt templates | ~12 |
| Calibration submissions (10–15 per exercise) | ~150 |
| Pyodide/Sandpack configurations | ~5 |
| Pre-built apps (shared, for diagnostic/review) | 2 |
| Database seed files | 1 |
| Retrieval sprint question sets | 5 |
| Starter briefs (final project) | 3–5 |

---

## Deferred to Full Course

The following content is designed in the curriculum but not built in the MVP:

| Content | Source |
|---------|--------|
| Module 4.4–4.6 (Decomposition, Constraints, Audience Adaptation) | Curriculum v0.2 |
| Module 5 (The Autonomy Spectrum) | Curriculum v0.2 |
| Module 7 (Users, Data, Dual Interface) | Curriculum v0.2 |
| Module 9 standalone (Regulation, Accountability, Future of Pilotry) | Curriculum v0.2 |
| Reference Labs R1–R10 | Curriculum v0.2 |
| Platform-hosted agent environment (Containers + VibeSDK fork) | Tech Architecture v0.1 |
| Simulation exercises (CT-9: synthetic user testing) | Tech Architecture v0.1 |
| Dashboard interpretation exercises (CT-10) | Tech Architecture v0.1 |
| Extended final project (persona definition, instrumentation plan) | Curriculum v0.2 |
