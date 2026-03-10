# Software Pilotry Foundation Course

## Curriculum v0.2 — Three-Layer Architecture

**Draft — March 9, 2026**
**Originated by Julian Harris, Great Creations London Ltd**

---

## Design Principles

This curriculum is designed for **non-technical domain professionals** — doctors, lawyers, engineers, educators, business managers — who want to build software with AI agents or work effectively alongside software pilots.

**Evergreen by design.** The course teaches principles and mental models, not specific tools. Exercises use current tools to illustrate stable concepts, and exercises are swapped as the landscape moves. No module depends on a specific agent, model, or framework surviving unchanged.

**Aimed 12 months ahead.** The curriculum assumes a world where language models run on edge devices, agents have persistent memory, multi-agent coordination is routine, and the web exposes interfaces for both humans and agents. Where current reality hasn't caught up, the course teaches the principle and flags the trajectory.

**Three layers.** Content is organised by durability:

- **Layer 1 — Pilotry-Native** (the spine): Knowledge that exists nowhere else. The probabilistic nature of AI systems, specification as a discipline, agent autonomy and failure modes, agentic UX, verification methodology. This is the product.
- **Layer 2 — Applied Foundations** (supporting): Conventional software knowledge taught through a pilotry lens. HTTP, databases, security, observability — taught not as ends in themselves but as diagnostic instruments for the pilot.
- **Layer 3 — Reference Labs** (companion): Standalone exercises on specific technologies (Docker, email, canvas, specific agent tools). Not required for certification. Maintained as living documentation. Swapped freely as tools change.

**Wellbeing by design.** AI agents never sleep, never tire, and never say "that's enough for today." The pilot is the only one who stops. This course treats sustainable practice not as a wellness afterthought but as a structural requirement — like security by design, but for the human in the loop. Fatigue degrades specification quality, verification rigour, and judgment. A pilot who cannot stop is a pilot who will eventually ship something dangerous. Duty limits exist in aviation for a reason. The same principle applies here.

**Two pedagogical anchors.** The **compiler moment** (Module 2) teaches that software is precise and literal. The **stochastic moment** (Module 3) teaches that AI agents are neither. Everything else builds on these two truths held in tension.

---

## Course Overview

**Audience:** Non-technical domain professionals, business managers, entrepreneurs
**Format:** Self-paced online, with AI-evaluated exercises and optional human pilot review
**Total hours:** 29–36 hours (core path), plus optional reference labs
**Certification:** Software Pilotry Foundation Certificate

| Module | Title | Hours | Layer | Core concept |
|--------|-------|-------|-------|-------------|
| 1 | The New Landscape | 2 | L1 | Why the world changed, the three roles, why this course exists |
| 2 | The Machine Beneath | 4 | L2 | The compiler moment — software is precise, literal, layered |
| 3 | The Probabilistic Machine | 4 | L1 | The stochastic moment — AI agents are confident, variable, and wrong |
| 4 | Specification: The Pilot's Primary Skill | 5 | L1 | Defining what to build with enough precision to get good outcomes |
| 5 | The Autonomy Spectrum | 3 | L1 | From workflows to swarms — understanding agent architectures and failure modes |
| 6 | Building with Agents | 4 | L1/L2 | Hands-on agent-assisted building, using diagnostic instruments |
| 7 | Users, Data, and the Dual Interface | 4 | L1 | UX for humans and agents, simulation, analytics, observability |
| 8 | Verification and Acceptance | 3 | L1 | The pilot's sign-off — how to know it's right |
| 9 | Responsibility, Risk, and Sustainable Practice | 3 | L1 | Accountability, wellbeing, regulation, the movement |
| **Final project** | **Build, Verify, Launch** | **—** | **All** | **Full cycle: specification → build → verify → launch assessment** |

---

## Module 1: The New Landscape

**Hours:** 2
**Layer:** Pilotry-Native
**Concept:** Orientation — what changed, why it matters, what this course prepares you for

### Learning Outcomes

1. Describe the three roles in the new software landscape: domain expert (the person with the problem), AI agent (the builder), and software pilot (the accountable practitioner)
2. Explain why "vibe coding" is sufficient for personal projects but dangerous for professional ones
3. Articulate the accountability gap — who is responsible when AI-generated software causes harm
4. Identify which of the three roles they currently occupy and which they are preparing for

### Content

**The barrier collapsed.** AI coding agents can generate working applications from natural language. This unlocks hundreds of millions of domain professionals who had problems software could solve but couldn't build solutions. The technical barrier is gone. The complexity spectrum has not changed.

**Three roles, not two.** The public conversation frames this as "AI replaces developers." The reality is three roles: the domain expert who knows the problem, the agent that generates code, and the pilot who takes responsibility for whether the software actually works, is secure, and does what it should. These roles can overlap — a domain expert can learn enough pilotry to handle simple projects — but they are distinct.

**The accountability question.** AI agents cannot be sued, fired, or held professionally responsible. When generated software causes harm — data breach, financial loss, safety incident — someone must own the outcome. The pilot is the answer. This is not theoretical: it is the central organising principle of this entire course.

**Vibe coding's proper place.** Karpathy's "vibe coding" describes a real and valuable mode of working — surrendering to the AI, not examining the code, using the tool for personal exploration and prototyping. This is legitimate for personal projects. It is negligent for anything with users, data, or consequences. The distinction matters.

**The pilot's most underrated skill: stopping.** AI agents never tire. They are available at 7am on a Sunday. They will happily generate one more feature, refactor one more module, fix one more bug. The pilot is the only participant in this system who has limits — and the only one whose judgment degrades with fatigue. Learning when to stop is as much a pilotry skill as learning when to intervene. This theme runs through the entire course and is addressed directly in Module 9.

### Exercises

- **Exercise 1.1:** Read three short case studies of AI-generated software failures (provided). For each, identify: who had the problem, who generated the code, who was accountable, and what went wrong. (AI-evaluated against rubric)
- **Exercise 1.2:** Write a 200-word description of a problem in your own professional domain that software could solve. Do not describe a solution. Describe only the problem. (Evaluated on problem clarity, absence of solution bias)

---

## Module 2: The Machine Beneath

**Hours:** 4
**Layer:** Applied Foundations (taught through pilotry lens)
**Concept:** The compiler moment — software is precise, literal, and layered

### Learning Outcomes

1. Experience the machine executing instructions — precise, literal, sequential
2. Read a browser's Network tab and identify DNS lookup, TLS handshake, HTTP status codes
3. Explain what a database is, why data has structure, and what happens when structure is violated
4. Describe the concept of "layers beneath" — every abstraction hides complexity that can fail
5. Use Chrome DevTools console and Network tab as diagnostic instruments

### Content

This module establishes the permanent intuition that software is made of precise, literal instructions operating on structured data, transmitted over layered protocols, running in specific environments. The learner does not need to become a programmer. They need to *feel the machine* — to understand at a gut level that when something breaks, there is a specific, discoverable reason, and that AI agents are generating these precise instructions on their behalf.

### Section 2.1 — The Compiler Moment (centrepiece)

**The anchor exercise of the entire course.** The learner writes five lines of JavaScript in a constrained sandbox. A variable assignment, an arithmetic operation, a string concatenation, a conditional, a `console.log`. They run it. They see the output. They modify one line and predict the output before running. They get it wrong. They learn.

This is not a coding lesson. This is the moment they understand that the machine does exactly what it is told, nothing more, nothing less. Julian's own compiler design course memory — vivid 35 years later — is the proof that this approach creates permanent intuition.

**Sandbox:** Sandpack (CodeSandbox) embedded component. Single editable file, console panel visible, all other files locked/hidden.

### Section 2.2 — The Request Lifecycle

What happens when someone types a URL and presses Enter. DNS resolution (the phonebook), TCP connection, TLS handshake (the encrypted tunnel), HTTP request, server processing, HTTP response with status code, browser rendering. Taught as one continuous story, not as separate topics.

**Key concepts the pilot needs:**
- DNS: why "it works for me but not for them" happens, what propagation means
- HTTPS/TLS/SSL: not optional, what the padlock means, what happens without it
- HTTP status codes: 200 (success), 301/302 (redirect), 400 (your fault), 401/403 (not authorised), 404 (not found), 500 (server's fault), 502/503 (infrastructure problem). A pilot who can read a status code can diagnose half of all deployment failures.
- The concept of request/response pairs — every interaction is a question and an answer

**Exercise:** Open Chrome DevTools Network tab on a real website. Watch the page load. Identify the DNS lookup, the TLS negotiation, the status codes. The instructor then breaks a resource (404) and asks the learner to find which request failed and why. They see the red line. They read the status code. Diagnostic instrument established.

### Section 2.3 — Data Has Structure

What is a database. Tables, rows, columns, types. What happens when you try to insert text into a number field. What happens when two people edit the same record simultaneously. What "migrations" means (the structure can change, and that change must be managed). What "backup" means and why it matters.

**Exercise:** A pre-loaded SQLite database in the sandbox. Three guided queries (SELECT, INSERT, attempt to violate a constraint). The constraint fails. The learner sees the error. They now understand that data has rules, and violating those rules breaks things — and that an AI agent will generate database schemas that may or may not enforce the right rules.

### Section 2.4 — The Diagnostic Cockpit: Chrome DevTools

Not taught as a standalone topic — introduced here as the instrument panel they'll use throughout the course. Console tab (read errors), Network tab (watch requests), Elements tab (inspect the page structure). Three tools, practiced in every subsequent module.

**Exercise:** Given a broken web page (agent-generated, with three deliberate errors), use DevTools to find all three. One is a JavaScript error in the console. One is a failed network request. One is a CSS issue visible in Elements. The learner practices reading error messages — the single most valuable diagnostic skill for a non-technical person.

---

## Module 3: The Probabilistic Machine

**Hours:** 4
**Layer:** Pilotry-Native
**Concept:** The stochastic moment — AI agents are confident, variable, and frequently wrong

### Learning Outcomes

1. Experience the variability of AI outputs — same prompt, different results
2. Explain temperature, sampling, and context windows at a conceptual level
3. Identify hallucination, confabulation, and confident wrongness in agent outputs
4. Describe the "jagged frontier" — AI makes you better inside its capability zone and worse outside it
5. Recognise the difference between an agent that understands and an agent that pattern-matches

### Content

This module is the counterweight to Module 2. The compiler moment taught precision and literalness. The stochastic moment teaches that the tool generating those precise instructions is itself imprecise, variable, and overconfident. These two truths — held simultaneously — are the foundation of pilotry.

### Section 3.1 — The Stochastic Moment (centrepiece)

**The second anchor exercise.** The learner gives an identical specification to an AI agent five times. They compare the five outputs side by side. The outputs differ — sometimes subtly (variable names, code structure), sometimes significantly (different architectural approaches, different libraries, different bugs). The learner sees with their own eyes that "it worked once" proves nothing.

**Exercise:** Provide a precise one-paragraph specification for a simple feature (e.g., "a function that validates an email address and returns true or false"). Submit it to the agent five times. Compare outputs. Document: what was the same, what differed, which differences matter, which don't. (AI-evaluated against rubric)

### Section 3.2 — How Language Models Actually Work (Conceptual)

Not the mathematics. The intuition. Language models predict the next token based on patterns in training data. They do not "understand" in the way humans understand. They are extraordinarily good at producing plausible-sounding output, including plausible-sounding output that is wrong. Temperature controls randomness. Context windows limit how much the model can "see" at once. Training data has a cutoff — the model doesn't know what happened yesterday.

**Key concepts:**
- Token prediction — the model is always asking "what word comes next?"
- Temperature — low = predictable/repetitive, high = creative/chaotic
- Context window — the model's "working memory," with hard limits
- Training data cutoff — the model's knowledge has an expiration date
- Hallucination — the model generates plausible but false information with full confidence
- The jagged frontier — AI improves your performance on tasks inside its capability zone and *degrades* your performance on tasks outside it (Dell'Acqua et al., BCG × HBS, 2023)

### Section 3.3 — Memory, State, and the Illusion of Continuity

Agents are gaining persistent memory, project context, and conversation history. But this is not like human memory or database state. It is fuzzy, lossy, and can accumulate contradictions. The pilot needs to understand: what the agent "remembers" versus what it infers versus what it hallucinates from stale or partial context. As models move to edge devices with local memory, this becomes more critical — the agent on your laptop has a different context from the agent in the cloud.

**Exercise:** Work with an agent across three separate sessions on the same project. In session two, introduce a deliberate requirement change that contradicts session one. In session three, ask the agent to summarise the requirements. Document what it gets right, what it gets wrong, and what it invents. (AI-evaluated)

### Section 3.4 — Model Selection as a Pilotry Skill

Not all models are equal. A frontier cloud model (Claude, GPT-4+) is more capable but slower and more expensive. A local edge model (Llama, Phi, Gemma) is faster and private but less capable. A specialised code model may outperform a generalist on certain tasks. The pilot's job includes choosing the right model for the task — just as an aviation pilot matches aircraft to route.

**Key decision framework:**
- Task complexity → model capability requirement
- Data sensitivity → local vs. cloud
- Latency requirement → edge vs. API
- Cost per query → model selection for volume
- The principle: use the cheapest model that's good enough for the task

---

## Module 4: Specification — The Pilot's Primary Skill

**Hours:** 5
**Layer:** Pilotry-Native
**Concept:** Defining what to build with enough precision to get good outcomes from AI agents

### Learning Outcomes

1. Write a problem definition that separates the problem from any specific solution
2. Produce acceptance criteria that are unambiguously testable
3. Enumerate edge cases and failure modes for a given feature
4. Decompose a complex requirement into independently verifiable increments
5. Write constraint specifications (security, performance, data handling, accessibility)
6. Adapt specification detail for different agent autonomy levels

### Content

This is the longest and most important module. Specification is the pilot's primary productive skill — the thing they do every day that directly determines outcome quality. In the AI era, the quality of the specification determines the quality of the output more than any other single factor.

**A note on fatigue and specification.** Specification is cognitively demanding work. It requires sustained attention, precise language, and the discipline to think about what could go wrong rather than racing ahead to build. This is exactly the kind of work that degrades first when you are tired. A specification written at 11pm after six hours of agent-assisted building will contain gaps, ambiguities, and unstated assumptions that a rested mind would catch. The pilot who recognises "I am too tired to specify well" and stops is making a better professional decision than the one who pushes through. This is not a soft skill — it is a quality control measure.

### Section 4.1 — Problem Before Solution

Most people jump straight to "build me an app that does X." The first pilotry discipline is holding yourself at the problem level until you understand what you're solving. Who has this problem? How do they cope today? What does success look like? What does failure cost? What assumptions are you making?

**Exercise:** Given a vague brief ("I need a booking system for my dental practice"), generate 15 clarifying questions before writing any specification. Scored on whether the questions would change the solution. Questions like "How many dentists?" "Do patients book themselves or does reception?" "What happens when someone cancels with less than 24 hours notice?" (AI-evaluated against rubric)

### Section 4.2 — Testable Acceptance Criteria

"The system should be fast" is not a specification. "The search results page loads in under 2 seconds on a 3G connection with 10,000 records" is. "The user can log in" is not a specification. "A registered user can authenticate with email and password, receive a session token, and access protected routes; an unregistered email returns a specific error message; five consecutive failures trigger a 15-minute lockout" is.

**The Ceetrix model:** Every requirement has a verification method. Every verification method has a pass/fail threshold. If you can't describe how you'd test it, you haven't specified it.

**Exercise:** Rewrite five vague requirements as testable acceptance criteria. Each must include: the actor, the action, the expected outcome, the measurable threshold, and the failure case. (AI-evaluated against rubric with specific scoring on measurability and completeness)

### Section 4.3 — Edge Cases and Failure Modes

What happens when the user enters nothing? What happens when they enter ten thousand characters? What happens when two users do the same thing at the same time? What happens when the external API is down? What happens when the data is in a language your system doesn't expect? Agents don't ask these questions unless prompted. The specification must enumerate them.

**Exercise:** Given an agent-generated application (a simple form-based CRUD app), find and document five unhandled edge cases. Then write the specification addenda that would have prevented each one. (Evaluated on edge case severity and specification precision)

### Section 4.4 — Decomposition and Sequencing

Breaking a large problem into independently deliverable increments, each of which provides value and can be verified in isolation. This is the user story discipline adapted for agent delivery, where the "sprint" might be 15 minutes. Smaller, well-defined tasks produce better agent outputs than large, ambiguous ones.

**Concepts:** User stories, vertical slicing (each increment touches all layers), dependency mapping, the "walking skeleton" (smallest possible end-to-end flow first), progressive enhancement.

**Exercise:** Given a product brief for a moderately complex application (e.g., "a project management tool for a small construction company"), decompose it into 8–12 user stories, sequence them by dependency, and identify the walking skeleton. (AI-evaluated)

### Section 4.5 — Constraint Specification

The things the system must NOT do, the non-functional requirements, the boundaries. Security constraints (authentication, authorisation, data encryption at rest and in transit), performance budgets (response time, concurrent users), data handling (retention, deletion, GDPR/privacy obligations), accessibility (WCAG level), regulatory requirements (industry-specific).

**Key principle:** Agents optimise for the happy path unless explicitly constrained. If you don't specify that passwords must be hashed, the agent might store them in plaintext. If you don't specify rate limiting, the agent won't add it. The constraint specification is the guardrail.

**Exercise:** For the dental booking system from 4.1, write the constraint specification covering: authentication, data privacy (patient health records), availability requirements, and accessibility. (Evaluated on completeness and regulatory awareness)

### Section 4.6 — Specification for Different Audiences

A specification for a structured workflow agent (Ceetrix-style, where the agent follows explicit steps) is different from a specification for a semi-autonomous agent (Claude Code-style, where the agent makes tactical decisions) which is different from a brief for a human engineer. Understanding which level of detail is needed for which consumer is itself a pilotry skill.

**Key principle:** More autonomous agents need *more* constraint specification and *less* implementation detail. Less autonomous agents need more procedural guidance. The pilot adjusts the specification style to the tool.

---

## Module 5: The Autonomy Spectrum

**Hours:** 3
**Layer:** Pilotry-Native
**Concept:** Understanding agent architectures, from workflows to swarms, and their distinct failure modes

### Learning Outcomes

1. Place any given agent tool on the autonomy spectrum from structured workflow to self-modifying system
2. Describe the failure modes specific to each level of autonomy
3. Explain multi-agent coordination and its emergent risks
4. Assess the risk profile of a given agent configuration for a given task
5. Describe the trajectory of agent autonomy and what "12 months from now" likely looks like

### Content

### Section 5.1 — The Spectrum

| Level | Description | Example | Primary failure mode |
|-------|------------|---------|---------------------|
| **Structured workflow** | Human defines steps, agent executes within rails | Ceetrix, Magenta-style agents, CI/CD pipelines | Gets stuck, fails silently, follows bad instructions literally |
| **Tool-using agent** | Agent selects tools and sequence, human sets goal | Claude with MCP, Cursor, Windsurf | Hallucinated tool calls, wrong tool selection, context drift |
| **Semi-autonomous agent** | Agent makes architectural decisions, human reviews | Claude Code in autonomous mode, Devin | Confident wrong architecture, scope creep, accumulated technical debt |
| **Multi-agent swarm** | Multiple agents coordinate, specialise, review each other | Agent teams (coder + reviewer + tester) | Groupthink hallucination, circular validation, architectural incoherence |
| **Self-modifying system** | Agent rewrites own prompts, spawns sub-agents, pursues emergent goals | OpenClaw/NanoClaw, Gas Town-style architectures | Goal drift, unintended optimisation, loss of human oversight |

**Key principle:** Each level up the spectrum doesn't just add capability — it adds a qualitatively different category of failure. The risk curve is non-linear. The pilot's role changes at each level: operator → supervisor → director → governor.

### Section 5.2 — Multi-Agent Coordination

Already emerging, will be routine within 12 months. One agent writes code, another reviews it, a third runs tests, a fourth handles deployment. The promise: specialisation and cross-checking. The risk: agents can agree with each other's hallucinations, create circular dependencies, or produce technically correct but architecturally incoherent systems because no single agent holds the full picture.

**The pilot's role in a swarm** is analogous to air traffic control more than to a single pilot: maintaining the overall picture, catching when agents reinforce each other's errors, and intervening when the emergent behaviour diverges from the specification.

### Section 5.3 — Agentic Agency: What Self-Direction Actually Means

The word "agent" is used loosely. True agency means the system can set sub-goals, choose methods, modify its own approach, and operate without step-by-step human guidance. This is powerful and dangerous. The further the agent operates from human checkpoints, the more the specification and constraint system matters — because there may be no human in the loop to catch a wrong turn.

**The trajectory:** In 12 months, most professional work will involve tool-using and semi-autonomous agents. Swarms will be emerging. Self-modifying systems will exist but not yet be trusted for production work. The course prepares learners for the tool-using and semi-autonomous levels while giving them the conceptual framework to evaluate higher-autonomy systems as they arrive.

### Exercise

- **Exercise 5.1:** Given three agent tool descriptions (one workflow-based, one semi-autonomous, one swarm-based), classify each on the spectrum, identify the primary failure modes, and write a one-paragraph risk assessment for using each to build a patient-facing healthcare application. (AI-evaluated)

---

## Module 6: Building with Agents

**Hours:** 4
**Layer:** Pilotry-Native + Applied Foundations
**Concept:** Hands-on agent-assisted building, using all skills and instruments from prior modules

### Learning Outcomes

1. Use an AI coding agent to build a working application from a specification
2. Use Chrome DevTools to diagnose issues in agent-generated code
3. Apply the specification → build → diagnose → refine cycle iteratively
4. Identify when the agent is struggling and adjust approach (simplify task, add context, change model)
5. Recognise the boundary between "I can handle this" and "I need a pilot"

### Content

This is the practicum. Learners bring together everything from Modules 1–5: they write a specification (Module 4), give it to an agent, evaluate the output against their acceptance criteria (Module 4), diagnose problems using DevTools (Module 2), adjust for the agent's probabilistic nature (Module 3), and understand which agent behaviour is expected vs. problematic (Module 5).

### Section 6.1 — The Build Cycle

Specification → Agent prompt → Generated output → Review against acceptance criteria → Diagnose failures → Refine specification or prompt → Iterate. This cycle is the daily rhythm of working with agents. The exercise teaches it through repetition.

**The "one more thing" trap.** This cycle is addictive. The friction between having an idea and seeing it built is now close to zero. The agent is always available. Every idle thought — in the shower, at breakfast, at 7am on a Sunday — becomes an actionable prompt. And because it feels productive, the normal guilt signals don't fire. You're not wasting time. You're shipping. But you are also accumulating fatigue, degrading your judgment, and skipping the reflection that distinguishes good work from fast work. The pilot must learn to recognise this pull and treat it as a professional hazard, not a virtue. The agent will always be there. You are the only one who says stop.

### Section 6.2 — Applied Diagnostics

This is where the Layer 2 foundations from Module 2 pay off. When the agent's application doesn't work:

- **Console errors:** Read the red text. What does it say? JavaScript errors, missing dependencies, null reference exceptions. The learner doesn't need to fix the code — they need to describe the problem clearly enough for the agent to fix it, or clearly enough to explain it to a pilot.
- **Network failures:** 404 (wrong URL), 500 (server crash), CORS errors (security policy blocking the request), timeout (too slow). DevTools Network tab tells you which.
- **Environment issues:** "It works on my machine" — configuration, environment variables, missing services. The concept from Module 2 (the environment is part of the software) becomes practical.

### Section 6.3 — Security Awareness in Practice

Not a comprehensive security course. A focused check: can the learner spot the three most common security problems in agent-generated code?

1. Hardcoded secrets (API keys, passwords in source code)
2. Missing authentication on routes that should be protected
3. User input passed directly to database queries (SQL injection concept)

**Exercise:** Review an agent-generated application and find three deliberate security problems. Describe each in plain language and write the specification constraint that would have prevented it. (AI-evaluated)

### Section 6.4 — Knowing Your Limits

Seven warning signs that a project has exceeded your pilotry skill level and needs a professional software pilot:

1. The application handles financial transactions
2. The application stores health, legal, or other sensitive personal data
3. The application has more than ~100 concurrent users
4. The agent's error messages no longer make sense to you
5. You've been debugging the same issue for more than 2 hours
6. The application needs to integrate with legacy systems
7. The application has regulatory compliance requirements you don't fully understand

**Exercise:** Given a project brief, assess it against the seven warning signs and write a hiring brief for a software pilot, including what expertise is needed and what success looks like. (AI-evaluated)

---

## Module 7: Users, Data, and the Dual Interface

**Hours:** 4
**Layer:** Pilotry-Native
**Concept:** UX for humans and agents, simulation, analytics, observability — the world after launch

### Learning Outcomes

1. Design interfaces that serve both human users and AI agents
2. Describe the concept of simulated user behaviour and synthetic testing
3. Set up basic analytics instrumentation and read a funnel
4. Explain observability (logging, tracing, telemetry) as a pilotry instrument
5. Use data to identify problems before users report them

### Content

### Section 7.1 — The Dual Interface

The web is being rewritten. Every interface is now potentially consumed by both humans and agents. A page needs to be usable by a person and parseable by an agent. This is not just semantic HTML — it is thinking about what information an agent needs to extract, what actions it needs to perform, and how the interface exposes those capabilities. MCP servers are one formalisation of this, but the stable principle is: your application has two audiences, and ignoring either one limits its value.

**Key concepts:** Semantic structure, API-first design, machine-readable metadata, progressive enhancement (works for humans first, enriched for agents), accessibility as a dual-use investment (accessible to screen readers ≈ accessible to agents).

### Section 7.2 — Agentic UX Patterns

Designing for the human-agent collaboration interface:

- **Confidence communication:** How do you show a user that the AI is 90% confident vs. 60% confident? How do you surface uncertainty without creating anxiety?
- **Override design:** Every AI suggestion must be easily overridable. The human must always feel in control.
- **Automation complacency:** The user stops checking because the AI is usually right — until it isn't. Design patterns that maintain healthy verification habits.
- **Progressive disclosure of AI capability:** Don't overwhelm users with everything the agent can do. Reveal capabilities as the user's confidence grows.
- **Error recovery:** When the AI gets it wrong, how does the user get back to a good state? Undo, revert, explain-what-happened patterns.

### Section 7.3 — Simulation and Synthetic Testing

Instead of waiting for real users to find problems, generate synthetic user personas and simulate their journeys through the application. An AI evaluator assesses whether the experience meets the specification for each persona. This is orders of magnitude faster than traditional user testing and catches a different class of problems.

**The pilot's role:** Define the personas (who are the users, what do they want, what might go wrong for them), define the scenarios (happy path, edge cases, accessibility needs, adversarial use), and interpret the results (which failures matter, which are acceptable, what needs to change).

**Exercise:** For a given application, define three user personas with distinct needs and constraints (e.g., a tech-savvy power user, an elderly first-time user, a user with a visual impairment). Write three simulation scenarios per persona. Run them through the agent as synthetic tests. Interpret the results. (AI-evaluated)

### Section 7.4 — Observability: Your Black Box Recorder

Logging, tracing, and telemetry are not just operational tools — they are the pilot's flight data recorder and user research instrument combined.

- **Logging:** What happened, when, and why. Without logs, production problems are invisible. The exercise from the discussion applies here: show two identical apps, one with logging and one without. Break both. The one without logs is a brick wall.
- **Tracing:** Following a single request through multiple services. When things are slow, tracing shows you where.
- **Telemetry/Analytics:** Session recordings, funnel analysis, error rates by user segment, performance by device type. A pilot who can read a dashboard and spot that 40% of users drop off at step three is doing user research.

**Key principle:** Instrument from day one. Adding observability after launch is ten times harder than building it in. Your specification should include observability requirements.

### Section 7.5 — Reading Data: Analytics as a Pilotry Skill

Not data science. Practical data literacy: what to measure, what a cohort is, what a funnel is, what "statistical significance" means in plain terms, what a conversion rate tells you, how to read a time-series chart and spot anomalies, the difference between correlation and causation.

**Exercise:** Given a dashboard for a SaaS application (simulated data), answer five questions: What's the conversion rate from sign-up to first use? Which step in onboarding has the highest drop-off? Is performance getting better or worse over the past month? Which user segment has the most errors? What would you investigate next? (AI-evaluated)

---

## Module 8: Verification and Acceptance

**Hours:** 3
**Layer:** Pilotry-Native
**Concept:** The pilot's sign-off — how to know AI-generated software is correct

### Learning Outcomes

1. Describe why agent-generated tests are insufficient as sole verification
2. Apply at least three independent verification strategies to an agent-generated application
3. Write a pre-launch checklist covering functionality, security, performance, and accessibility
4. Explain the concept of coverage (specification coverage, not just code coverage)
5. Make a go/no-go decision and articulate the reasoning

### Content

### Section 8.1 — The Verification Problem

If the agent writes the code AND the tests, it can write tests that pass its own broken implementation. This is the fundamental verification problem of AI-generated software. The pilot cannot rely on green test suites as proof of correctness.

**Verification strategies:**
- **Specification-driven review:** Walk through every acceptance criterion from Module 4. Does the application satisfy each one? Manually verify, don't just read the agent's claim.
- **Independent test generation:** Have a different agent (or the same agent in a fresh session with no context) generate tests from the specification alone. Compare results.
- **Edge case probing:** Module 4's edge case list becomes a test plan. Try every edge case. Document results.
- **Adversarial testing:** Try to break it. Enter unexpected input. Use it in ways it wasn't designed for. See what happens.
- **User simulation:** Module 7's synthetic personas become verification tools. Does the application work for all persona types?

### Section 8.2 — The Pre-Launch Checklist

A structured checklist the pilot works through before any software goes live:

**Functionality:** Every acceptance criterion verified. Edge cases tested. Error handling works. Data persists correctly across sessions.

**Security:** No hardcoded secrets. Authentication works. Authorisation enforced. Input sanitised. HTTPS configured. Sensitive data encrypted.

**Performance:** Page loads within specified budget. Works on slow connections. Handles expected concurrent users.

**Accessibility:** Keyboard navigable. Screen reader compatible. Sufficient colour contrast. Alt text on images.

**Observability:** Logging configured. Error tracking active. Analytics instrumented. Alerts set for critical failures.

**Legal/Compliance:** Privacy policy present. Data handling matches specification. Cookie consent if required. Industry-specific requirements met.

**Pilot fitness:** Am I rested enough to be making this decision? When did I last take a break of 24 hours or more? Have I been in the "one more thing" cycle? If the answer to that last question is yes, the go/no-go decision waits until tomorrow. A fatigued pilot's sign-off is not a sign-off. Aviation does not allow a pilot to fly after insufficient rest, regardless of how ready the aircraft is. The same principle applies here.

### Section 8.3 — The Go/No-Go Decision

The pilot's final authority. Given the verification results and the checklist, is this software ready to ship? This is not a binary pass/fail — it is a risk assessment. What are the known gaps? What is the severity of each? What is the plan to address them? Can you ship with known issues if they're documented and mitigated?

**Exercise:** Given a completed verification report for an agent-generated application (provided, with some items passing and some failing), make the go/no-go call. Write a 300-word justification covering: what passed, what failed, the risk of shipping with known issues, the mitigation plan, and your recommendation. (AI-evaluated)

---

## Module 9: Responsibility, Risk, and Sustainable Practice

**Hours:** 3
**Layer:** Pilotry-Native
**Concept:** Accountability, wellbeing, regulation, the movement — the pilot as a whole person in a professional system

### Learning Outcomes

1. Describe the current accountability landscape for AI-generated software
2. Explain the legal and ethical responsibilities of the deploying party
3. Recognise the psychological hazards specific to AI-assisted work and apply sustainable practice principles
4. Articulate the case for professional standards and certification in software pilotry
5. Identify the trajectory of AI regulation and what it means for practice

### Content

### Section 9.1 — The Accountability Landscape

The current state: product liability law theoretically covers AI-generated code — the entity that ships is liable. But there is no individual professional licensing for software engineers, AI tool providers disclaim all liability via EULAs, no court has yet adjudicated liability for AI-generated code harm, and the speed of AI code generation outpaces human review capacity.

The pilot model is the upgrade: individual accountability, demonstrated competency, professional standards, recurrent verification — modelled on aviation, medicine, and law.

### Section 9.2 — Your Responsibilities as the Deploying Party

Even without formal certification, anyone who deploys software to users has responsibilities: data protection (GDPR, CCPA, sector-specific), accessibility (legal requirements vary by jurisdiction), consumer protection, and professional duty of care. The course does not make you a lawyer — it makes you aware that these obligations exist and gives you enough knowledge to know when you need legal advice.

### Section 9.3 — Sustainable Pilotry

This section addresses a psychological hazard that has no precedent in conventional software development and no equivalent in any other profession.

**The new pressure.** Traditional overwork had natural friction. You had to sit down, open an IDE, hold the entire system in your head, fight the compiler. The effort itself was a brake. That friction is gone. The agent is always available. Every idle thought becomes an actionable prompt. The gap between "I wonder if..." and "it's built" has collapsed to minutes. And because it feels productive — you are shipping, not scrolling — the usual guilt signals do not fire.

**The infinite capacity illusion.** The agent's capacity is effectively unlimited. It does not get tired. It does not need weekends. It will happily generate code at 3am with the same quality it produces at 10am. This creates an insidious pressure: if the tool can always do more, and you can always direct it to do more, then stopping feels like a choice to leave value on the table. But the tool's tirelessness is irrelevant. The pilot's judgment is the bottleneck, and judgment degrades with fatigue.

**What fatigue does to pilotry.** A tired pilot writes vague specifications and doesn't notice. A tired pilot accepts agent output they would normally challenge. A tired pilot skips verification steps because "it looks fine." A tired pilot ships with known issues because they want to be done. Every failure mode in this course — bad specification, insufficient verification, missed security flaw, poor judgment call — is amplified by fatigue. This is not a wellness platitude. It is a quality and safety issue.

**The aviation precedent.** FAA Part 117 mandates that airline pilots cannot exceed 1,000 flight hours per year or 100 per month. Minimum rest periods between duties are legally enforced. These limits exist not because pilots want to stop flying but because decades of accident investigation proved that fatigued pilots kill people. The regulation exists precisely because the individual cannot be trusted to self-regulate when the work feels important and the capability is available.

**Sustainable practice principles:**
- **Define your duty limits.** Decide in advance how many hours per day and per week you will work with agents. Write it down. Treat it as a professional commitment, not a suggestion.
- **Separate building from deciding.** Never make a go/no-go decision in the same session as a long build cycle. Sleep on it. The pre-launch checklist in Module 8 includes a pilot fitness check for this reason.
- **Recognise the pull.** The "I'll just get the agent to do this one thing" impulse is a signal, not a command. Notice it. Name it. Decide consciously whether to act on it or not.
- **Protect non-work time.** The agent will be there tomorrow. Your relationships, health, and capacity for clear thought will not survive indefinite availability. The pilot who burns out is no use to anyone.
- **Normalise stopping.** In a culture that celebrates hustle and shipping velocity, choosing to stop is a professional act of discipline. It is the pilot saying: my judgment matters more than one more feature.

**Exercise:** Write a personal sustainable practice charter. Define your weekly hour limit, your mandatory rest periods, your rule for when to stop a session, and your rule for when to delay a go/no-go decision. This is not graded on the specific numbers — it is graded on whether the charter is concrete, honest, and enforceable. (AI-evaluated)

### Section 9.4 — The Future of Pilotry

The trajectory: agent capabilities will increase. The need for human oversight will not decrease — it will change shape. The pilot of 2027 will manage agent swarms, evaluate self-modifying systems, and make judgment calls that no amount of AI capability can automate: "Should we build this at all?" "Is this the right problem to solve?" "What are the second-order consequences?"

The Software Pilotry movement. The manifesto. The call to action for programmers (evolve), employers (hire for pilotry), educators (teach pilotry), and domain experts (learn the foundations).

---

## Final Project: Build, Verify, Launch

**Hours:** Variable (estimated 6–10 hours)
**Layer:** All three layers integrated

### Brief

Learners complete a full pilotry cycle on a project in their own professional domain:

1. **Problem definition** (Module 1, 4): Identify a real problem in their domain. Write the problem statement, not the solution.
2. **Specification** (Module 4): Full specification with acceptance criteria, edge cases, constraints, decomposition.
3. **Agent-assisted build** (Module 6): Use their preferred AI coding agent to build the application from the specification.
4. **Diagnostic cycle** (Module 2, 3, 6): Diagnose and resolve at least three issues using DevTools and agent iteration.
5. **User and data assessment** (Module 7): Define personas, describe how they would instrument analytics, identify what they would measure post-launch.
6. **Verification** (Module 8): Complete the pre-launch checklist. Document all test results.
7. **Go/no-go decision** (Module 8): Written justification for shipping or not shipping.
8. **Complexity assessment** (Module 6): Honest assessment of whether this project needs a professional pilot, and if so, what expertise and why.

### Evaluation

- AI evaluator scores against structured rubric (automated, instant feedback)
- Optional: human pilot review at key milestones (premium tier)
- Certification awarded on passing all rubric criteria

### Rubric Dimensions

| Dimension | Weight | What is scored |
|-----------|--------|---------------|
| Problem clarity | 15% | Separation of problem from solution, stakeholder awareness |
| Specification quality | 25% | Testability, edge case coverage, constraint completeness |
| Build execution | 15% | Effective agent use, appropriate iteration, diagnostic skill |
| Verification rigour | 20% | Independence of verification, checklist completion, evidence quality |
| Judgment and accountability | 15% | Go/no-go reasoning, complexity self-assessment, risk awareness |
| Communication | 10% | Clarity of all written deliverables, professional presentation |

---

## Reference Labs (Layer 3)

Not required for certification. Standalone exercises maintained as living documentation. Updated as tools change. Available to learners at any time.

| Lab | Topic | When to use |
|-----|-------|-------------|
| R1 | Docker and containers | When your agent mentions Dockerfile, containers, or deployment environments |
| R2 | Email: SMTP, deliverability, SPF/DKIM | When your project needs to send email |
| R3 | WebSockets and SSE | When your project needs real-time features |
| R4 | Canvas and visual rendering | When your project needs custom drawing or data visualisation |
| R5 | DNS deep dive | When you're setting up a custom domain or debugging DNS issues |
| R6 | Git and version control basics | When you need to manage code history or collaborate |
| R7 | API design and REST conventions | When your project exposes or consumes APIs |
| R8 | Specific agent tool guides | Hands-on guides for current popular agents (updated quarterly) |
| R9 | Deployment platforms | Cloudflare Workers, Vercel, Railway, Fly.io — when and why |
| R10 | Mobile considerations | Responsive design, PWAs, native vs. web tradeoffs |

---

## Platform and Sandbox Architecture

### Early Modules (1–4): Sandpack

- Embedded CodeSandbox Sandpack components in React frontend
- Constrained, guided exercises with locked files and visible console
- Zero server-side compute cost per learner
- Self-hostable bundler (no external dependency)

### Middle Modules (5–6): Sandpack + learner's own agent tools

- Learner begins using Claude/Cursor/their preferred agent alongside the platform
- Platform tracks outcomes via submission review, not process monitoring
- WebContainers (StackBlitz) as optional upgrade for richer execution (licensing TBD)

### Late Modules (7–8) and Final Project: Own tools + VibeSDK evaluation layer

- Learner works entirely in their own environment
- Platform evaluates submitted outputs against rubric
- Cloudflare VibeSDK fork for automated build-and-evaluate pipeline (optional)

### Evaluator Architecture

- Per-learner persistent agent (Cloudflare Durable Objects)
- AI evaluator scores submissions against structured rubrics via AI Gateway
- Tutor agent available for contextual questions ("why did my specification fail?")
- Learner state persisted in D1 (progress, scores, weak areas)
- All inference via Cloudflare AI Gateway (rate limiting, cost control, logging)

---

## Curriculum Maintenance Plan

### Evergreen content (annual review)

All Layer 1 and Layer 2 material. Principles, mental models, exercises. Reviewed annually for accuracy. No tool-specific dependencies.

### Living content (quarterly update)

Layer 3 reference labs. Specific agent tool guides. Model comparison tables. Platform-specific deployment guides. Updated quarterly or when major tool releases occur.

### Deprecation policy

When a reference lab's underlying tool is discontinued or superseded, the lab is archived (not deleted) and a replacement is created. Learners who completed archived labs retain credit.

---

*This curriculum document is the v0.2 canonical reference for the Software Pilotry Foundation Course, superseding the module structure in the MECE v0.1 document. It reflects the three-layer architecture, the 12-month forward-looking design principle, and the expanded treatment of specification, agent autonomy, agentic UX, and verification methodology discussed on March 9, 2026.*
