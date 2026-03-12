# Is Your Team Ready for the Post-Code Era?

## A Workshop for Senior Tech and Product Leaders

Draft — March 2026
Julian Harris, Great Creations London Ltd
Software Pilotry Initiative

## Workshop Overview

Duration: 2.5 hours (half-day with breaks)
Audience: Engineering leads, VPs of Engineering, senior PMs, CTOs
Group size: 8–16 (larger groups split into tables of 4)
Format: Structured audit — claim, individual assessment, table discussion, report-out
Prerequisite: Each participant brings one recent feature their team shipped using AI tools

## Learning Objectives

After the workshop, participants will be able to:

1. Diagnose their team's readiness gap across five dimensions, applied to specific features they are shipping.
2. Distinguish velocity from delivery — articulate why generating more code is not the same as shipping better software faster, and identify where their pipeline creates paradoxical slowdowns.
3. Evaluate specification quality against a concrete standard: testable criteria, edge cases, failure modes, constraints, measurable thresholds.
4. Design a verification strategy that does not depend on code review, using principles of independent validation, holdout scenarios, and semantic triangulation.
5. Make a first-order decision about where on the autonomy spectrum their team should operate, and what prerequisites must be in place before moving further.
6. Identify the single highest-leverage intervention for their team and commit to it specifically enough to be followed up in two weeks.

## Desired Organisational End State

The workshop is not about reaching a specific maturity level. It is about deliberate choice. The desired end state is a team that has:

- Decoupled its quality assurance from code inspection
- Made specification a first-class deliverable with its own review process and ownership
- Established verification that is structurally independent from code generation
- Balanced its delivery pipeline so downstream capacity matches upstream generation speed
- Built structural resistance to uncritical acceptance of AI output
- Named and empowered the person who makes ship/no-ship decisions with visibility into verification evidence
- Consciously chosen its position on the autonomy spectrum based on risk profile, not inertia

---

# Pre-Read Materials

Sent to participants 48 hours before the workshop. Total reading time: approximately 10 minutes.

## Pre-Read 1: The StrongDM Case

In July 2025, three engineers at StrongDM — a security infrastructure company — formed a new AI team. Their charter contained two rules: no human writes code, and no human reviews code. By February 2026, they published the first public account of their "Software Factory": a non-interactive development system where specifications and scenarios drive coding agents that write, test, and converge code without human review.

Key discoveries:

**Specification as control plane.** The Attractor repo — the core of their factory — contains approximately 6,000–7,000 lines of specification and zero lines of code. The spec is the product; the code is a build artifact.

**Agents game tests.** Their agents quickly learned that `return true` passes any narrowly written test. Traditional unit tests stored alongside code are vulnerable to gaming. StrongDM's fix: treat test scenarios like machine learning holdout sets — stored outside the codebase where agents can't see them.

**Satisfaction testing.** Instead of asking "does this function return the right value?" they ask "if a real person used this software in all the ways a real person might, how often would it actually do what they needed?" Success is probabilistic, not boolean.

**Digital Twin Universe.** They built behavioural clones of third-party services — Okta, Jira, Slack, Google Docs — as self-contained binaries that replicate APIs, edge cases, and observable behaviours. Testing at volumes exceeding production limits, no rate limits, no API costs. Previously economically unfeasible; agentic development reversed the cost equation.

**The accountability question.** StrongDM builds security software — access management controlling who can touch what across enterprise systems. Stanford Law raised the question two days after their announcement: when no human has read the code, who is accountable for what it does? StrongDM is being acquired by Delinea (identity security). Whether the acquirer maintains "no human review" for security products once they own the compliance risk is the live test.

Source: factory.strongdm.ai, Simon Willison's analysis (7 Feb 2026), Stanford Law CodeX analysis (8 Feb 2026)

## Pre-Read 2: The Delivery Data

**Faros.ai data** (10,000+ developers, 1,255 teams): Teams with high AI adoption complete 21% more tasks and merge 98% more pull requests. PR review time increases 91%. Developers report that reviewing AI-generated code requires more effort than reviewing human-written code — the code is syntactically competent but lacks shared context and intent.

**METR randomised trial**: Experienced developers became 19% slower overall with AI tools on familiar projects.

**The question this workshop answers:** Your team is somewhere between "business as usual with Copilot bolted on" and StrongDM's dark factory. Where should you be — and what needs to change to get there?

---

# Workshop Agenda

## Opening: The Spectrum (15 min)

Facilitator presents the two poles:

**Pole A** — Traditional development with AI assist. Developers use Copilot/Cursor to write code faster. Code review, testing, and deployment processes unchanged. Result: more code generated, review pipeline overwhelmed, net velocity unclear or negative.

**Pole B** — StrongDM's software factory. No human-written code, no human-reviewed code. Specification and scenario design are the entire human contribution. Code treated as opaque output validated by behaviour, not inspection.

Quick poll: each participant places their team on the spectrum (1–5 scale). Facilitator captures the spread.

## Dimension 1: Specification Rigour (25 min)

### The Claim (5 min)

When code is cheap to produce, clarity of intent becomes the scarce resource. Specification is no longer a handoff document — it's the primary productive artifact.

Evidence of convergence: StrongDM's Attractor repo (spec-only, no code). AWS built Kiro (IDE that generates specs before code, using EARS notation). GitHub open-sourced Spec Kit (71K+ stars, four-phase spec-driven workflow). ThoughtWorks put spec-driven development on the Technology Radar. JUXT's semantic triangulation concept — code, tests, and specification as three independent angles on the same intent; where any two diverge, there's a hidden assumption.

The spec completeness question: most specs cover the happy path. Few cover edge cases, failure modes, security constraints, performance budgets, accessibility requirements, or what the system must NOT do. Agents optimise for the happy path unless explicitly constrained. If you don't specify that passwords must be hashed, the agent might store them in plaintext.

### The Audit (5 min, individual)

Each participant answers for the feature they brought:

1. How much time did your team spend on specification vs. prompting/building? (Rough ratio)
2. Is the spec detailed enough that a different agent or team could build the same thing independently?
3. Could you verify the output against the spec without reading the code?
4. Does the spec have testable acceptance criteria with measurable thresholds and failure cases — or does it say things like "the system should be fast"?

### Table Discussion (10 min)

Share answers. Look for patterns: where does specification discipline break down? Is it a skills problem, a process problem, or an incentives problem?

### Report Out (5 min)

One finding per table.

## Dimension 2: Verification Independence (25 min)

### The Claim (5 min)

If the agent writes the code AND the tests, it can write tests that pass broken implementations. This is the fundamental verification problem of AI-generated software. Code review — the traditional last human checkpoint — is collapsing under volume.

StrongDM's answer: satisfaction testing with scenarios stored outside the codebase as holdout sets, validated by a separate evaluator. JUXT's semantic triangulation: spec, code, and tests as three independent angles — code and tests can confirm each other's shared assumptions without either catching a flaw in the underlying intent. The specification is the independent witness.

Ankit Jain's analysis (Latent Space, 2026): "Human-written code died in 2025. Code reviews will die in 2026." Verification must move upstream to specification and downstream to independent acceptance testing.

### The Audit (5 min, individual)

1. Who or what generates your tests? Same agent session as the code? Same codebase?
2. Could the agent game your test suite? (Has it?)
3. Do you have any validation that is structurally independent from the build process?
4. When your CI goes green, what is your actual confidence level that the feature works — and what is that confidence based on?

### Table Discussion (10 min)

Has anyone experienced an AI agent writing tests that pass broken code? What verification practices have you added since adopting AI tools? What would satisfaction testing look like for your product?

### Report Out (5 min)

## Break (10 min)

## Dimension 3: Delivery System Balance (25 min)

### The Claim (5 min)

Braess's Paradox: in a network where agents independently choose their own routes, adding capacity can make overall performance actively worse — not just neutral, negative. The mechanism: independent agents change their behaviour in response to new capacity, and the compound effect creates congestion that didn't previously exist.

Applied to software: making code generation faster does not make delivery faster if every generated PR still passes through the same review, testing, and deployment pipeline. Before AI tools, code generation and review were loosely coupled — one developer's writing speed didn't much affect another's review load. AI tools act like Braess's shortcut: every developer now floods the fast segment (generation), overloading the shared downstream segment (review) in ways that weren't possible when generation was slower. No individual developer has an incentive to generate less code. The collective result is worse for everyone.

The Faros.ai numbers illustrate this precisely: 21% more tasks, 98% more PRs, 91% longer review times. The METR result — 19% slower overall — suggests the paradox is already in play.

### The Audit (5 min, individual)

1. What is your PR review backlog trend over the past six months?
2. How has median time-to-review changed since adopting AI tools?
3. Where is the actual bottleneck in your delivery pipeline right now? Is it where you're investing?
4. If your team generates 3x more code next quarter, what breaks first?

### Table Discussion (10 min)

The StrongDM question: what would it take to eliminate human code review on your team? What would you need to build or buy first? Is the answer "impossible" or "possible but we haven't invested in the prerequisites"?

### Report Out (5 min)

## Dimension 4: Cognitive Surrender Resistance (20 min)

### The Claim (5 min)

Shaw & Nave (2026) extended Kahneman's dual-process model with System 3: artificial cognition. "Cognitive surrender" is the tendency to adopt AI outputs without critical scrutiny — distinct from cognitive offloading, which is strategic delegation. Across three preregistered experiments (N=1,372; 9,593 trials): accuracy rose 25 percentage points when AI was correct and fell 15 points when it erred. Participants with higher trust in AI and lower need for cognition showed greater surrender.

The better the AI usually is, the harder it is to catch when it's wrong. This is not an individual discipline problem — it's a structural design problem. Two factors helped people resist in the research: performance incentives (a reason to care about accuracy) and real-time feedback (visibility into how they were doing).

### The Audit (5 min, individual)

1. When was the last time someone on your team rejected a substantial piece of AI-generated output and rebuilt it differently?
2. Do your reviews distinguish between "this looks right" and "I have independently verified this is right"?
3. What structural incentive exists to challenge AI output — versus the velocity pressure to accept it?
4. How would you know if your team's defect rate from AI-generated code was increasing?

### Table Discussion (5 min)

What does "performance incentive + real-time feedback" look like translated into an engineering team's workflow? What would you change this month?

### Report Out (5 min)

## Dimension 5: Accountability Clarity (15 min)

### The Claim (5 min)

When AI-generated code causes harm, existing liability frameworks are untested. Product liability law theoretically covers the deploying party, but no court has adjudicated AI-generated code harm. AI tool providers disclaim all liability via EULAs. Stanford Law's analysis of StrongDM asked: when no human has read the code, who is accountable for what it does?

The pilot model: the person who makes the ship/no-ship decision owns the outcome. That requires: (a) the authority to say no, (b) visibility into what verification was done, (c) enough understanding to make the decision meaningful.

### The Audit (5 min, individual)

1. For your last production incident involving AI-generated code: who owned the decision to ship?
2. Did they know it was AI-generated? Did they have visibility into what verification had been done?
3. If a regulator or customer asked "who approved this code and on what basis," do you have a clear answer?
4. Does anyone on your team have explicit authority to block a ship based on insufficient verification?

### Table Discussion (5 min)

Brief share. This one surfaces uncomfortable gaps quickly.

## Synthesis: Your Team's Readiness Map (20 min)

### Individual Scoring (5 min)

Each participant scores their team 1–5 on each dimension:

| Dimension | 1 (no practice) | 3 (emerging) | 5 (systematic) |
|-----------|-----------------|--------------|-----------------|
| Specification rigour | Specs are vague or skipped | Some testable criteria | Specs are the primary deliverable with independent verification |
| Verification independence | Agent-generated tests only | Some manual verification | Structurally independent validation (holdout scenarios, separate evaluators) |
| Delivery system balance | Same pipeline, more code | Aware of the bottleneck | Investment in downstream capacity proportional to generation speed |
| Cognitive surrender resistance | No structural safeguards | Some review discipline | Process structurally incentivises challenge and provides quality feedback |
| Accountability clarity | Unclear who decides | Named decision-maker | Decision-maker has authority, visibility, and verification evidence |

### Table Discussion (10 min)

Compare maps. Where do scores cluster? Where are the biggest gaps? If you could change one thing on Monday morning, which dimension gives the highest leverage?

### Full Group: One Action Per Person (5 min)

Each participant states one concrete action they will take. Not "improve our specification process" — something like "add testable acceptance criteria to next sprint's top three stories and measure whether it changes the build outcome."

## Close (5 min)

The five dimensions aren't a maturity model to climb sequentially. They're a diagnostic. Run the audit quarterly. The gaps will shift as AI adoption deepens and tools change. The goal isn't Level 5 on all dimensions — it's knowing where you are and whether that's appropriate for the risk you're carrying.

---

# Facilitator Notes

**Room setup:** Tables of 4, shared whiteboard or Miro board for report-outs.

**Timing discipline:** The audit questions are designed to take exactly 5 minutes. If participants want more time, they're overthinking — the point is gut-level honest assessment, not precision scoring.

**The feature they brought:** This is essential. Every audit question becomes concrete when applied to a real, recent feature. Abstract self-assessment produces flattering scores. "Apply this to the thing you shipped last week" produces honest ones.

**Common failure mode:** Tables spend discussion time agreeing about how bad things are instead of identifying what to change. Push from diagnosis to action: "OK, your review process is overwhelmed — what specifically would you do differently?"

**The Braess's Paradox explanation:** If it comes up, the short version: adding a shortcut to a road network can make everyone slower, because every driver rationally takes the shortcut, overloading a segment that was previously uncongested. The mechanism is coupling — the shortcut linked two parts of the network that were previously independent. Before AI tools, generation and review were loosely coupled. AI tools are the shortcut. The full version with numbers: two routes from A to B, each with one congestion-sensitive and one fixed-time segment. Without the shortcut, drivers split evenly, 65 minutes each. With a zero-cost shortcut, all drivers use both congestion-sensitive segments, 80 minutes each. 15 minutes worse, and no individual can improve by switching back.

**Follow-up:** Offer a 1:1 thirty-minute session two weeks later to review what they actually changed and what they learned. This is where the real value lands — and where you learn which dimensions matter most to this audience.

---

# Appendix A: Case Study — StrongDM Software Factory

## Timeline

- July 2025: Three-person AI team formed (Jay Taylor, Navan Chauhan, Justin McCarthy/CTO). Charter written in the first hour: no hand-coded software, no human code review.
- Late 2024 catalyst: Claude 3.5 Sonnet (October 2024 revision) — long-horizon agentic coding workflows began to compound correctness rather than error.
- October 2025: Simon Willison visits; working demos of agent harness, Digital Twin Universe, satisfaction testing framework already operational.
- November 2025 inflection: Claude Opus 4.5 and GPT 5.2 turn the corner on reliable instruction-following for complex coding tasks.
- February 2026: Public announcement of Software Factory methodology. Attractor and CXDB open-sourced.
- March 5, 2026: Acquisition by Delinea (identity security) completed.

## Key Concepts

**Software Factory:** Non-interactive development where specs and scenarios drive agents that write code, run harnesses, and converge without human review.

**Attractor:** The non-interactive coding agent at the heart of their factory. The repo contains three markdown files — approximately 6,000–7,000 lines of specification — and zero code. The README says: feed these specs into your coding agent of choice.

**Digital Twin Universe (DTU):** Behavioural clones of third-party services (Okta, Jira, Slack, Google Docs) as self-contained Go binaries. Replicate APIs, edge cases, observable behaviours. Test at volumes exceeding production. No rate limits or API costs. "Creating a high fidelity clone of a significant SaaS application was always possible, but never economically feasible."

**Satisfaction testing:** Probabilistic validation where LLMs judge whether observed trajectories through scenarios satisfy user expectations. Scenarios stored outside the codebase (holdout sets). The question is not "does it pass?" but "did the software do what the user needed?"

**Grown software:** Code that compounds correctness through iteration rather than degrading over time. Not generated once and shipped; grown through cycles of agent-driven refinement against scenario validation.

**Token cost benchmark:** "If you haven't spent at least $1,000 on tokens today per human engineer, your software factory has room for improvement."

## Critical Questions

StrongDM builds security and access management software. The Delinea acquisition is the real-world test: did they buy the methodology or the customer base? Will "no human review" survive enterprise compliance? Corporate acquirers don't tolerate risk the way three-person founding teams do.

---

# Appendix B: Specification Formats Landscape

## EARS (Easy Approach to Requirements Syntax)

Developed by Rolls-Royce for safety-critical systems. Adopted by AWS Kiro as its standard format. Core pattern: WHEN [condition] THE SYSTEM SHALL [expected behaviour].

Five patterns: ubiquitous (the system shall always...), event-driven (when X happens...), state-driven (while in state X...), optional (where feature X is enabled...), unwanted (if condition X, the system shall...).

Key property: testability by construction. Each requirement can be directly translated into a test case. Used in Kiro's three-file structure: requirements.md, design.md, tasks.md.

## GitHub Spec Kit

Open-source CLI toolkit, four-phase workflow: Specify (generate spec from high-level prompt), Plan (technical implementation plan), Tasks (break into reviewable units), Implement (agent executes). Agent-agnostic — works with Copilot, Claude Code, Gemini CLI, Cursor, Windsurf. Produces specifications of approximately 800 lines. 71K+ GitHub stars.

## StrongDM nlspec

Natural language specification at the radical end. 6,000–7,000 lines covering behavioural constraints, interface semantics, system boundaries. Uses pseudocode for data structures, Graphviz DOT for workflow graphs, natural language for behavioural contracts. Designed to be the sole input to a coding agent with no human in the loop.

## OpenSpec

Lighter-weight alternative to Spec Kit. Uses GIVEN/WHEN/THEN scenarios. Produces specifications of approximately 250 lines. Includes `openspec validate --strict` for gap detection.

## Specification Completeness — The Gap

No widely adopted metric for specification completeness exists. EARS gives structural completeness (are requirements well-formed?) but not content completeness (have you missed requirements?). Spec Kit gives process completeness (did you do all four phases?) but not quality assurance.

The practical framework from the Software Pilotry curriculum:

- Are there testable acceptance criteria with measurable thresholds?
- Are edge cases enumerated?
- Are failure modes specified?
- Are constraints covered (security, performance, data handling, accessibility)?
- Is decomposition into independently verifiable increments done?
- Is the spec adapted for the autonomy level of the agent consuming it?

Semantic triangulation (JUXT) adds a structural check: can you independently derive the spec, the code, and the tests from each other? Where any two diverge, there's a gap.

The missing metric: specification coverage — analogous to code coverage, asking what percentage of the spec's acceptance criteria and constraints are independently verifiable. Nobody has built this yet.

---

# Appendix C: Key Research References

**Shaw & Nave (2026), Tri-System Theory / Cognitive Surrender.** Three preregistered experiments (N=1,372; 9,593 trials). Extends Kahneman's dual-process model with System 3 (artificial cognition). Accuracy +25 points when AI correct, -15 points when AI errs. Performance incentives and real-time feedback helped resist surrender.
Paper: https://ssrn.com/abstract_id=6097646
Wharton podcast: https://knowledge.wharton.upenn.edu/podcast/ripple-effect/how-ai-is-reshaping-human-intuition-and-reasoning-gideon-nave-and-steven-shaw/

**Dell'Acqua et al. (2023), BCG × Harvard Business School, "The Jagged Frontier."** AI improves performance inside its capability zone and degrades performance outside it. Consultants using AI on tasks within the frontier saw 40% improvement; those using AI on tasks outside the frontier performed worse than the control group.
Paper: https://www.hbs.edu/ris/Publication%20Files/24-013_d9b45b68-9e74-42d6-a1c6-c72fb70c7571.pdf

**Faros.ai (2025–2026), AI adoption data.** 10,000+ developers, 1,255 teams. High AI adoption: +21% tasks completed, +98% PRs merged, +91% PR review time. Developers report AI-generated code harder to review than human-written code.
Report: https://www.faros.ai/blog/ai-software-engineering
Dashboard: https://www.faros.ai/ai-productivity-paradox

**METR Randomised Trial (2025).** Experienced developers 19% slower overall with AI tools on familiar projects. Contradicts self-reported productivity gains.
Blog: https://metr.org/blog/2025-07-10-early-2025-ai-experienced-os-dev-study/
Paper: https://arxiv.org/abs/2507.09089
Update (Feb 2026): https://metr.org/blog/2026-02-24-uplift-update/

**Braess's Paradox (1968).** Adding capacity to a network where agents independently optimise can make collective performance worse. Applied to software delivery: faster code generation overloads shared downstream resources (review, testing, deployment).

**Ankit Jain, Latent Space (March 2026).** "Human-written code died in 2025. Code reviews will die in 2026." Analysis of code review collapse under AI-generated volume.
Article: https://www.latent.space/p/reviews-dead

**Simon Wardley, Rewilding Software Engineering (2026), Chapter 6.** "Experimentation must generate understanding, otherwise the system becomes unsafe." Knight Capital ($440M loss in 45 minutes from behaviour its systems didn't understand) as precedent. "Comprehension is your last line of defence."
Chapter 6: https://medium.com/feenk/rewilding-software-engineering-ca3ad1e612d8
Series index: https://medium.com/feenk/rewilding-software-engineering-083b86c81c43

**StrongDM Software Factory (February 2026).** First public account of "dark factory" level AI development. No human code writing or review. Specification and scenario-driven. Satisfaction testing with holdout sets.
Site: https://factory.strongdm.ai/
Simon Willison analysis (7 Feb 2026): https://simonwillison.net/2026/Feb/7/software-factory/
Attractor repo: https://github.com/strongdm/attractor

**Stanford Law CodeX (8 February 2026).** "Built by Agents, Tested by Agents, Trusted by Whom?" Legal analysis of accountability when no human reviews code.
Article: https://law.stanford.edu/2026/02/08/built-by-agents-tested-by-agents-trusted-by-whom/

**GitHub Spec Kit (September 2025).** Open-source spec-driven development toolkit. 71K+ stars.
Repo: https://github.com/github/spec-kit
Blog: https://github.blog/ai-and-ml/generative-ai/spec-driven-development-with-ai-get-started-with-a-new-open-source-toolkit/

**AWS Kiro (July 2025).** Spec-driven IDE using EARS notation. Three-file structure: requirements, design, tasks.
Site: https://kiro.dev/
Introduction: https://kiro.dev/blog/introducing-kiro/
Docs on specs: https://kiro.dev/docs/specs/

**ThoughtWorks Technology Radar.** Spec-driven development as emerging technique.
Radar entry: https://www.thoughtworks.com/en-us/radar/techniques/spec-driven-development
Analysis: https://www.thoughtworks.com/insights/blog/agile-engineering-practices/spec-driven-development-unpacking-2025-new-engineering-practices

**Dan Shapiro, Five-Level Taxonomy of AI-Assisted Programming (January 2026).** Borrows from NHTSA self-driving framework. Level 5: "The Dark Factory" — humans write specs, agents do everything else.
Blog post: https://www.danshapiro.com/blog/2026/01/the-five-levels-from-spicy-autocomplete-to-the-software-factory/

**Delinea Acquisition of StrongDM.** Announced 15 January 2026. Completed 5 March 2026.
Announcement: https://delinea.com/news/delinea-strongdm-to-unite-redefine-identity-security-for-the-ai-era/
Completion: https://www.globenewswire.com/news-release/2026/03/05/3250113/0/en/Delinea-Completes-StrongDM-Acquisition-to-Secure-AI-Agents-with-Continuous-Identity-Authorization.html
