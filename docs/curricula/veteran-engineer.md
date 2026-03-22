# Software Pilotry Curriculum: 10-Year Software Engineering Veteran

> **Starting position:** Deep production experience. Has built, broken, and fixed real systems. Strong mental models for how software fails. Risk: resists the paradigm shift — either dismisses agents as toys or over-indexes on doing everything themselves. The hardest lesson is letting go of the craft identity tied to writing code manually.

---

## Module 1: The Machine Beneath - Reframed for Oversight [Durability: A - Foundation/permanent]

The veteran already understands systems. The shift is from *building* them to *overseeing their generation*.

**Accountability context:** You have spent a decade being accountable for code you wrote. Now you are accountable for code you did not write but chose to ship. This is a harder form of accountability - it requires trusting your evaluation more than the agent's confidence, and it means your professional reputation rests on your judgment about someone else's output. The knowledge you have about how systems break is no longer just engineering skill - it is the foundation of your accountability as a pilot. Every production incident you have survived has calibrated your instincts, and those instincts are now your primary tool for preventing agent-generated failures.

### 1.1 From Builder to Evaluator

You've spent a decade building the instinct that tells you "this code smells wrong." That instinct is the most valuable thing you bring to pilotry — but you need to retrain how you apply it.

**The review mindset shift:**
When you review a colleague's PR, you have shared context. You know the codebase, you know their skill level, you know what they were trying to do and can infer their reasoning. Agent output has none of this. The agent has no persistent understanding of your architecture, no awareness of past decisions, and no model of "what we tried before and why it didn't work."

This means your review must be more thorough, not less. With a human colleague, you can skim the straightforward parts because you trust their judgment on routine decisions. With agent output, routine decisions are exactly where hidden problems live — because the agent's "routine" is based on statistical patterns from millions of codebases, not the specific conventions and constraints of yours.

**Agent bugs vs. human bugs — they're categorically different:**

*Bugs humans write:*
- Typos and off-by-one errors
- Misunderstanding requirements (but the code structure usually reveals the misunderstanding)
- Copy-paste errors where the developer forgot to update a value
- Gradual design drift as features were added over time

*Bugs agents write:*
- Structurally plausible but semantically wrong logic (e.g., a sort comparator that looks correct but has wrong sign convention)
- Using APIs that don't exist, or using real APIs with incorrect parameter ordering
- Ignoring system constraints the agent wasn't told about (connection limits, rate limits, memory bounds)
- Over-engineering: abstraction layers, design patterns, and configuration that nobody asked for and that obscure the actual logic
- Confident incorrectness: the code reads like a senior developer wrote it, but it has the correctness of a first attempt with no testing
- Subtle data model mismatches: the agent's mental model of your data doesn't match reality, so transformations are wrong even though they look right

The veteran's advantage is recognizing these patterns. The veteran's risk is assuming agent output has the same bug distribution as human output and reviewing accordingly.

**Exercise — Bug Taxonomy Building:**
Over two weeks, log every bug you find in agent-generated code. Categorize each one. After two weeks, you'll have a personal taxonomy of agent failure modes specific to your technology stack. This taxonomy is your most valuable review tool — it tells you exactly where to look.

### 1.2 Architecture as Specification

You've spent years developing architectural intuition — the sense of what belongs where, what should be separated, what invariants must hold. Agents don't have this intuition. They have pattern matching across millions of repositories, which produces plausible-looking architectures that violate your specific constraints.

**Encoding architectural decisions — constraints, not suggestions:**

When you tell an agent "we use a hexagonal architecture," the agent will produce code that looks hexagonal — ports and adapters, dependency inversion, the right folder structure. But it will also introduce a shortcut where the HTTP handler directly accesses the database because that was the fastest path to completing the feature, and the agent doesn't *understand* hexagonal architecture, it just *reproduces* it. You specified the pattern. The agent reproduced the surface. The invariant was violated.

The fix: don't specify architectural patterns by name. Specify the constraints they produce:
- "All database access must go through the Repository interface. No function outside the `repository/` package may import `database/sql`."
- "HTTP handlers must only call service-layer functions. They may not contain business logic."
- "All external API calls must go through the Gateway interface so they can be mocked in tests."

These are verifiable constraints. You can grep for violations. The pattern name tells the agent what it should aim for; the constraints tell it what it must not violate.

**System boundaries and contracts:**
The most important architectural artifact for agent-assisted development is the *interface contract*. When you decompose a system into components and assign each to an agent session, the contracts between components are what prevent chaos. Define them precisely:
- Input types and their validation rules
- Output types and what each field means
- Error types and when they're returned
- Side effects and ordering requirements
- Performance constraints (max latency, max payload size)

Without explicit contracts, each agent session will make different assumptions about the boundary, and the components won't integrate.

**The decomposition problem — when to decompose yourself vs. let the agent do it:**

This is one of the highest-leverage judgment calls in pilotry. The rule of thumb:

*Decompose yourself when:*
- The decomposition depends on knowledge the agent doesn't have (your infra, your team's skills, your performance requirements)
- Getting the decomposition wrong means wasted work across multiple components
- The components have complex interdependencies that require global reasoning

*Let the agent decompose when:*
- The task is self-contained within a well-defined boundary
- The decomposition is a standard pattern (e.g., splitting a CRUD app into model/controller/view)
- You can verify the decomposition quickly before the agent implements it

*How to detect when the agent's decomposition is wrong:*
- It creates more abstractions than there are distinct behaviors
- It splits things that change together (violating cohesion)
- It groups things by technical layer when they should be grouped by domain concept (or vice versa)
- It introduces circular dependencies between components
- It puts the complex logic in the wrong component (usually the one it built first, creating a "god module")

**Exercise — Architecture Constraint Extraction:**
Take a system you know well. Write down every architectural constraint that a new team member would need to know — but that isn't documented. Things like: "we never query the orders table directly from the notification service because of a latency issue we discovered in 2022" or "the payment service retries are handled by the queue, not the application — never add retry logic in the handler." These undocumented constraints are exactly what agents will violate, because they're invisible in the code.

### 1.3 Legacy Systems and Migration

This is where the veteran's experience is irreplaceable. Agents are trained on public repositories, which skew toward greenfield projects. Your production codebase has 10 years of decisions, workarounds, and implicit knowledge that no agent can infer.

**The danger of agents "improving" code they don't understand:**
You ask an agent to add a feature to an existing module. The agent reads the module and notices what it thinks is dead code, an outdated pattern, or an unnecessary check. It "cleans it up" as part of the feature work. That "dead code" was a workaround for a bug in a third-party library that was never updated. That "outdated pattern" is the only way to maintain backwards compatibility with a client that's still on v1. That "unnecessary check" prevents a race condition that only manifests in production.

*The rule:* When an agent modifies existing code, review every line that changed, not just the lines related to your request. Agents are compulsive refactorers — they see patterns they "know how to improve" and they improve them without understanding the context.

**Implicit knowledge inventory:**
Before assigning agent work on a legacy system, enumerate the implicit knowledge:
- Which parts of the codebase have undocumented quirks?
- Which external dependencies have known issues that are worked around in code?
- Which "simple-looking" functions actually handle subtle edge cases?
- What ordering or timing constraints exist between components?
- What data invariants are maintained by convention rather than enforcement?

This inventory becomes part of your agent specification: "Do not modify function X. Do not remove the null check on line Y. The ordering of operations in Z is intentional and must be preserved."

**Strategies for incremental agent-assisted modernization:**

1. **Strangle fig pattern with agent labor:** Have the agent build the new component behind a feature flag while the legacy component continues serving traffic. You verify the new component matches the legacy component's behavior (not just its specification — its actual, quirky, production behavior). Switch over gradually.

2. **Characterization tests first:** Before the agent touches legacy code, have it write tests that capture the current behavior — including the weird behavior. These become your regression safety net. If the agent's changes break a characterization test, you know it's changed behavior, even if the change "looks like a bug fix."

3. **Small, verifiable increments:** Never have an agent rewrite an entire legacy module at once. Break it into changes small enough that you can confidently verify each one. If a change breaks something, you know exactly which small change caused it. Agent-generated code that you can't easily diff and verify is agent-generated code you can't trust.

**Exercise — Legacy Risk Assessment:**
Pick the scariest module in your codebase — the one nobody wants to touch. Map it:
- What does it do? (The obvious behavior)
- What else does it do? (The side effects, the workarounds, the implicit contracts with other modules)
- What breaks if someone changes it without knowing the full picture?
- What would you tell an agent before letting it work here?

That last answer is your specification for safe agent-assisted work on that module.

---

## Module 2: The Probabilistic Machine Above - Beyond the Surface [Durability: B - Systems/annual review]

The veteran may have used LLMs but likely hasn't built deep mental models of their behavior. This module builds those models by connecting agent behavior to concepts the veteran already understands.

**Accountability context:** Your accountability now extends to your delegation decisions. When you delegate a task to an agent, you are making a judgment call: "This task is within the agent's reliable capability, and I can verify the output." If that judgment is wrong - if you delegate something the agent cannot handle reliably, or if you cannot adequately verify the result - the failure is yours, not the agent's. This module gives you the understanding of agent behavior needed to make those delegation judgments well. The agent has no accountability. You have all of it.

### 2.1 Agent Orchestration

You know how to decompose systems into services. Multi-agent workflows are the same concept applied to the development process itself — different agents handling different concerns, communicating through defined interfaces.

**Multi-agent workflows — the real patterns:**

*The research-implement-review triangle:*
One agent researches approaches (reads documentation, finds examples, evaluates tradeoffs). A second agent implements based on the research output. A third agent reviews the implementation against the specification. This mirrors the human workflow of "architect designs, developer builds, reviewer checks" — and it works for the same reason: separation of concerns reduces the cognitive load on each agent, improving output quality.

*The specification-implementation-test pipeline:*
You write the specification. An agent generates the implementation. A separate agent (or the same agent in a fresh session with only the specification, not the implementation) generates tests. The key insight: the test-writing agent should not see the implementation, because it will write tests that pass the implementation rather than tests that verify the specification. This is the same principle as independent QA — and it's even more important with agents because an agent that sees the code will sycophantically test what the code does rather than what the code should do.

*When multi-agent workflows fail:*
- When the interface between agents is ambiguous (same as when the interface between services is ambiguous)
- When one agent's output is in the wrong format or abstraction level for the next agent
- When the orchestrator (you) doesn't verify intermediate outputs — garbage propagates through the pipeline
- When the task actually requires holistic understanding that can't be decomposed

**The "macro actions" paradigm:**
Karpathy's concept: mastery in pilotry means thinking in macro actions — delegating entire features, not writing individual functions. For the veteran, this means:

Instead of: "Write a function that validates email addresses"
Think: "Build the complete user registration flow, including: input validation with specific rules for each field, duplicate detection, confirmation email via SendGrid, error handling for all failure modes, and tests that cover the happy path and the three most important error cases."

The shift is from *implementing* to *specifying and verifying at feature scale*. You're still making every important decision — you're just expressing those decisions as specifications rather than code.

**Exercise — Macro Action Sizing:**
Take a feature from your backlog. Decompose it into the largest chunks you'd be comfortable delegating to an agent with a single specification. For each chunk, write: (1) what you'd specify, (2) what you'd need to verify, (3) what could go wrong. If you can't write (3), the chunk is too large — decompose further.

### 2.2 Effective Agent Delegation

You have domain expertise the agent doesn't. The art of delegation is encoding that expertise into your prompts efficiently.

**Encoding the "why":**
When you write code yourself, you make a hundred micro-decisions based on context that's in your head — "I'll use a map here because we'll need O(1) lookups when this scales" or "I'm handling this error explicitly because the third-party API returns 200 with an error body." When you delegate to an agent, these decisions get made by statistical pattern matching instead of your expertise. Unless you encode the "why."

Compare:
- "Store user sessions" → the agent picks whatever storage pattern it's seen most often
- "Store user sessions in Redis with a 30-minute TTL. We use Redis because sessions are read on every request and need sub-millisecond latency. The TTL is 30 minutes because our compliance team requires auto-expiry. If Redis is unavailable, reject the request rather than falling back to a database — we'd rather have a visible outage than a slow, cascading degradation." → the agent implements your actual intent, and you can verify whether it did so

The second prompt takes 60 seconds longer to write and saves hours of review and iteration.

**Context management — what to include, what to omit:**

*Always include:*
- The specification (obviously)
- The data model and its constraints
- Existing interfaces the new code must conform to
- Relevant architectural constraints
- Known edge cases and how to handle them

*Include when relevant:*
- Relevant portions of existing code (not the whole codebase — the specific files the new code interacts with)
- Error examples from production that the new code must handle
- Performance requirements with specific numbers

*Omit:*
- History of how the system evolved (the agent doesn't care and it wastes context)
- Alternatives you considered and rejected (unless you want the agent to explain why your choice is right)
- Code that the new code doesn't interact with (more context = more noise = worse output)

**Context window management — the practical impact:**
When your conversation with an agent gets long, the earlier context falls out of the window or gets compressed. Symptoms of context degradation:
- The agent contradicts a decision from earlier in the conversation
- The agent re-introduces a pattern you already told it not to use
- The quality of output degrades noticeably compared to the start of the conversation
- The agent "forgets" constraints you specified 20 messages ago

When you see these symptoms, start a new session. Copy in the current specification (updated with decisions made during the conversation) and the current state of the code. Fresh context = better output.

**The art of the follow-up — iterative refinement vs. starting over:**

*Iterate when:* The agent's approach is correct but the details need adjustment. Example: the data model is right but a validation rule is missing.

*Start over when:* The agent's fundamental approach is wrong. Example: it built a polling system when you needed WebSockets. Trying to get the agent to refactor from polling to WebSockets will produce a hybrid mess — it's cheaper to start fresh with a clearer specification.

*How to tell the difference:* If the fix involves adding or adjusting something, iterate. If the fix involves removing and replacing a core component, start over.

**Exercise — Prompt Evolution:**
Take a feature you've already built with an agent. Look at your prompt history. Identify every moment where you had to correct the agent. Now write a single prompt that incorporates all those corrections upfront. This is your evolved specification — and it's dramatically better than your original. Save it. Patterns like this become your personal prompt library for similar tasks.

### 2.3 Failure Mode Mastery

As a veteran, you have the ability to build deeper models of agent failure than a new grad. You know what correct looks like — you just need to learn where the probabilistic machine diverges from it.

**Building intuition for *when* agents will fail:**

Through experience, you'll develop a sense for which tasks agents handle well and which they don't. Here's a starting framework:

*Agents are reliably good at:*
- Standard CRUD operations in popular frameworks
- Boilerplate code (config files, setup, glue code)
- Well-documented API integrations
- Data transformations with clear input/output types
- Generating tests for code they can see
- Explaining code and identifying what it does

*Agents are unreliable at:*
- Business logic with many interacting rules
- Anything requiring understanding of state over time (caching strategies, session management, transaction ordering)
- Code that depends on undocumented system behavior
- Performance-critical code where constant factors matter
- Security-critical code (auth flows, crypto, input sanitization for complex formats)
- Debugging issues that require reasoning about runtime behavior

*Agents consistently fail at:*
- Multi-step reasoning where an error in step 2 compounds through steps 3-10
- Tasks requiring awareness of information outside the context window
- Code that must interact with your specific production environment's quirks
- Anything where "almost right" is worse than "obviously wrong" (financial calculations, medical dosing, legal compliance)

**Complexity thresholds — the nonlinear degradation:**
Agent output quality doesn't degrade linearly with task complexity — it falls off a cliff. A task that's slightly beyond the agent's reliable range doesn't produce slightly wrong output; it produces confidently, structurally wrong output that takes longer to diagnose and fix than writing it from scratch.

The cliff is different for different task types, but the pattern is consistent: there's a complexity level below which agent output is quite good, and above which it's essentially useless. Finding these cliffs for your specific tasks and tech stack is one of the most valuable investments in your pilotry practice.

**Detecting subtle correctness failures:**
The hardest bugs in agent output are the ones that pass all tests but violate business logic. Examples:
- A discount calculation that applies discounts in the wrong order, producing a result that's mathematically valid but commercially wrong
- An event ordering that usually works but produces incorrect state when two events arrive within the same millisecond
- A query that returns correct results for all test data but produces duplicates when a specific combination of nullable foreign keys occurs in production data
- A caching layer that works perfectly in a single-instance deployment but serves stale data behind a load balancer

These bugs have a signature: they work in development, they pass tests, they work in staging, and they fail in production under conditions that are hard to reproduce. The veteran's experience with this class of bug is directly transferable to agent oversight — you know what "subtle correctness failure" feels like, and you can pattern-match for the conditions that produce it.

**Intervention patterns that work:**

*When the agent is in a fixation loop:*
1. Stop immediately — do not provide another "fix this" prompt
2. Copy out the current state of the code
3. Start a new session
4. Provide: the original specification, the current (broken) code, and a clear description of what's wrong and your hypothesis about why
5. If the agent goes down the same path in the new session, the task is beyond the agent's capability — write it yourself

*When the agent's approach is wrong but salvageable:*
1. Identify specifically what's wrong (not "this doesn't work" but "the sort comparator returns wrong values for equal elements")
2. Explain why it's wrong (not "fix the comparator" but "equal elements must return 0, not -1, because downstream code uses stable sort semantics")
3. Provide the correct approach if you know it (not "figure out the right way" but "use `a.localeCompare(b)` instead of the manual comparison")

*When you're not sure if the output is correct:*
Ask the agent to explain its reasoning. Not "is this correct?" (it'll say yes). Instead: "Walk me through the execution path when input X arrives at the same time as input Y." The explanation often reveals gaps in the agent's reasoning that weren't visible in the code.

**Exercise — Cliff Mapping:**
Pick a type of task you frequently delegate (e.g., API endpoints, data migrations, UI components). Start with a simple version and progressively add complexity. At each step, evaluate the agent output quality. Find the complexity level where quality drops. That's your cliff for that task type. Document it. Over time, your cliff map becomes your delegation guide — you know exactly what to delegate and what to handle yourself.

---

## Module 3: Accountability in Practice - At Scale [Durability: A - Foundation/permanent]

The veteran's accountability extends beyond individual features to system-level responsibility.

### 3.1 Specification at System Scale

Writing a spec for a single feature is one thing. Writing specifications for a system of features — where multiple agent sessions produce components that must integrate — is a different discipline.

**Decomposition for agent boundaries:**
When you break a system into components for agent implementation, you're making the same decisions as microservice decomposition — but the consequences of getting it wrong are different. Bad microservice boundaries create operational complexity. Bad agent boundaries create integration bugs.

The principles:
- **Cut along domain boundaries, not technical layers.** "Build the payment domain" is better than "build the database layer" because the agent for the payment domain can make internally consistent decisions. The agent for "the database layer" must guess what the payment domain needs.
- **Define contracts before implementation.** The interface between two agent-generated components should be a TypeScript interface, a protobuf definition, or an OpenAPI spec — something concrete and verifiable. "They communicate via REST" is not a contract.
- **Make dependencies explicit.** If component A depends on component B's behavior, include B's contract in A's specification. Don't assume the agent will figure it out.

**Interface contracts — the specification that matters most:**
Between any two agent-generated components, you need:
```
Interface: PaymentService → OrderService
Direction: PaymentService calls OrderService
Method: POST /orders/{id}/payment-status
Request: { status: "paid" | "failed" | "refunded", transactionId: string, amount: { value: number, currency: string } }
Response: { accepted: boolean, reason?: string }
Error cases:
  - Order not found: 404, OrderService handles idempotency
  - Order already finalized: 409, PaymentService must not retry
  - OrderService unavailable: PaymentService queues and retries with exponential backoff
Latency requirement: < 200ms p99
```

This level of detail at the boundary saves days of integration debugging. Each agent knows exactly what to produce and what to expect.

**Non-functional requirements — the chronic gap:**
Agents under-specify non-functionals because prompts under-specify them and training data skews toward functional tutorials. You must explicitly require:
- **Performance:** "This endpoint must handle 500 requests/second with p99 latency under 100ms." Without this, the agent will produce something that works for 1 request/second.
- **Observability:** "Log every external API call with request/response body, latency, and correlation ID. Emit metrics for: request count, error rate, latency percentiles." Without this, you can't diagnose production issues.
- **Resilience:** "If the downstream service is unavailable, circuit-break after 5 failures in 10 seconds. Return a cached response if available, otherwise a specific error." Without this, one service failure cascades.

### 3.2 Verification Strategy

At volume, you can't manually review every line of agent-generated code. You need a strategy that gives you confidence without requiring infinite time.

**Designing verification pipelines:**
Think of verification as a funnel:

```
Agent output
  ↓ Automated: type checking, linting, formatting (catches ~30% of issues)
  ↓ Automated: unit tests + integration tests (catches ~40% of remaining)
  ↓ Automated: security scanning, dependency audit (catches known vulnerability patterns)
  ↓ Manual: specification conformance review (catches business logic errors)
  ↓ Manual: adversarial review of high-risk components (catches subtle correctness issues)
```

Each layer catches a different class of problem. The automated layers handle the volume; the manual layers handle the judgment. Your job is to design the funnel so that by the time code reaches manual review, the easy problems are already caught and you can focus your expertise on the hard ones.

**Property-based testing — your secret weapon:**
When you haven't traced every path through agent-generated code, property-based tests are invaluable. Instead of testing specific inputs and outputs, you test invariants:
- "For any valid input, the output length must equal the input length" (for a transformation that shouldn't change size)
- "For any sequence of operations, the account balance must never go negative" (for a financial system)
- "For any two items, sort(a, b) and sort(b, a) must produce the same ordering" (for a comparator)

The property-based testing framework generates hundreds of random inputs and checks the invariant. This catches edge cases you'd never think to test — and edge cases are exactly what agents get wrong.

**Continuous verification in production:**
Agent-generated code that passes review and tests can still fail in production. Build monitoring that detects:
- Output distributions that shift (the recommendation engine starts favoring one category)
- Error rates that creep up slowly (a memory leak that takes 3 days to cause problems)
- Performance degradation under specific conditions (the query that's fast with 1000 rows but slow with 100,000)
- Data integrity violations (orphaned records, violated foreign key relationships that the ORM doesn't enforce)

These are the same production monitoring practices you've always used — applied with specific attention to agent-generated failure modes.

**Exercise — Verification Pipeline Design:**
Design a verification pipeline for your team's most common type of agent-generated code. Specify: what automated checks run, what tools you'd use, what manual review criteria apply, what monitoring you'd add. Time yourself designing it. Now estimate how long each piece of code takes to pass through the pipeline. That's your real throughput — not how fast the agent generates code, but how fast you can verify it.

### 3.3 The Identity Shift

This is the section most veterans skip because it feels "soft." It isn't. The identity shift from "I write excellent code" to "I ensure excellent outcomes" is the prerequisite for everything else in this curriculum. Without it, you'll unconsciously resist the paradigm change and be slower than if you'd never tried.

**Why the shift is hard:**
You've spent a decade building an identity around craftsmanship. You write elegant code. You debug tricky problems. You refactor messy systems into clean ones. You know the satisfaction of a well-placed abstraction or a concise function. These skills are real and valuable. And in the agent era, they're no longer the primary way you create value.

This doesn't mean they're useless — your ability to write code is what makes you a credible evaluator of agent-generated code. You can't review what you can't write. But writing is no longer the main event; evaluation is.

**The analog is real pilotry:**
A commercial airline pilot can hand-fly the aircraft. They trained for years to hand-fly. They maintain proficiency through regular hand-flying. But on a commercial flight, the autopilot flies most of the time. The pilot's value isn't in hand-flying — it's in systems management, situation awareness, decision-making, and intervention when the automation fails.

No one says the pilot is "less skilled" because the autopilot handles the routine flight. The pilot's skill is expressed through oversight, judgment, and the ability to take control when it matters. Same for software pilotry.

**Knowing when to take the controls:**
There are moments when you should stop delegating and write the code yourself:
- When you've explained the problem to the agent twice and it still doesn't get it (the problem is outside the agent's reliable capability)
- When the code is security-critical and you need to trace every execution path
- When the code interacts with an undocumented system quirk that you can only express through the code itself
- When the "fix" would take the agent 30 minutes of iteration but you can write it in 5 minutes
- When you need to think through a problem and writing the code IS the thinking

The key is that taking the controls is a *judgment call*, not a default. You're not writing code because you always write code — you're writing code because this specific situation calls for it.

**Mentoring junior pilots:**
The generation entering the workforce now may never develop deep hand-coding skills. They'll interact with agents from day one. Your responsibility as a veteran is to teach them what you know that the agent doesn't:
- How to read code critically, not just whether it "looks right"
- How to reason about systems, not just components
- How to debug by forming and testing hypotheses, not by asking the agent to "fix it"
- How to recognize when the agent is wrong, even when the output is confident and polished

This is the most direct expression of Karpathy's vision: the veteran encodes their unique expertise into the educational process, and the agent acts as the interface that scales that expertise to every learner.

**Staying sharp:**
The temptation is to stop writing code entirely. Resist it. If you lose the ability to write code, you lose the ability to evaluate it. Schedule regular "hand-flying" time:
- Write the occasional feature from scratch, no agent
- Debug production issues by reading code, not by asking the agent "what's wrong"
- Review open source code in your ecosystem to stay current with idioms and patterns
- Participate in code reviews where you must form and defend an opinion about correctness

**Exercise — Identity Mapping:**
Write down the 5 things you're most proud of as an engineer. For each one, identify: is this skill still the primary way I create value, or has it shifted from "how I build" to "how I evaluate and oversee"? For each skill that has shifted, identify how you can express it through pilotry rather than through direct implementation.

### 3.4 Process and Workflow Design

As a veteran, you'll likely be responsible for designing how your team integrates agents into their workflow. This is not a tooling decision — it's a process architecture decision.

**Team workflows for agent-generated output:**

*The "pilot-per-feature" model:*
One engineer (the pilot) owns a feature end-to-end: writes the specification, delegates to agents, reviews output, integrates components, verifies the whole. This is the simplest model and works well for features that don't span many systems.

*The "pilot-pair" model:*
One engineer writes the specification and delegates. A second engineer (who didn't see the agent interaction) reviews the output against the specification. This catches the "sycophancy drift" where the pilot's expectations gradually align with the agent's output rather than the original specification.

*The "spec-review-verify" pipeline:*
Specification reviewed by one engineer, implementation delegated by another, verification done by a third. High overhead, but appropriate for high-risk features (payments, data migration, security).

**Code review protocols — what changes:**
Agent-generated PRs are different from human PRs. Your review process should account for:
- **No author to question:** You can't ask the agent "why did you do it this way?" in the PR conversation. The specification should contain the "why." If it doesn't, that's a specification gap, not a review gap.
- **No incremental trust:** With a human colleague, you build trust over time and review their code less thoroughly. Agent output quality varies by task, not by history. Review effort should be based on task risk, not on how good the agent's last output was.
- **Over-engineering detection:** Agent PRs tend to be larger than necessary because agents over-engineer. A human PR that's too large usually means the feature was too big. An agent PR that's too large usually means the agent added unnecessary abstractions. Train your team to call this out.
- **The "generated by" signal:** Consider requiring that agent-generated PRs be labeled. Not to stigmatize them, but so reviewers know to apply agent-specific review criteria (check for hallucinated APIs, verify edge case handling, check for unnecessary abstractions).

**Incident response when the agent was the author:**
When an incident traces back to agent-generated code, the post-incident review needs to answer different questions:
- Was the specification incomplete, or did the agent deviate from the specification?
- Was the verification process adequate for the risk level of this code?
- Was the failure mode one that a human developer would have caught, or is it a novel class of failure?
- Does the incident suggest a change to the verification pipeline, the specification process, or the risk assessment?

The goal is systemic learning — not "the agent wrote a bug" (it will, frequently) but "our process didn't catch this type of bug, and here's how we fix the process."

**Exercise — Workflow Design:**
Design the agent-assisted workflow for your team. Consider: who writes specifications? Who delegates? Who reviews? What are the checkpoints? What's the escalation path when agent output quality is too low? What's the fallback when the agent can't handle a task? Present this to your team and iterate based on their feedback.

---

## Before You Specify [Durability: B - Systems/annual review]

At the veteran level, specification is system-scale architecture expressed as testable constraints. You are not specifying a function - you are specifying how components interact, what invariants must hold, and what the failure modes are across boundaries.

### System-Scale Specification

Before delegating a feature that spans multiple components or agent sessions:

1. **Define the contracts first.** Every interface between agent-generated components must be specified with types, validation rules, error types, side effects, and performance constraints. The contract is the specification - everything else is implementation detail.
2. **Enumerate the implicit knowledge.** What does your system do that is not documented? What workarounds exist? What ordering constraints are maintained by convention? These must be explicit in the specification because the agent cannot infer them.
3. **Specify the non-functionals.** Performance targets with numbers. Observability requirements (what to log, what metrics to emit). Resilience behavior (what happens when dependencies fail). Agents under-specify all of these unless you over-specify them.
4. **Define the decomposition.** Which components should the agent build together? Which must be built separately with explicit contracts? Bad decomposition creates integration bugs that are harder to fix than implementation bugs.
5. **State the architectural constraints as verifiable rules.** Not "use hexagonal architecture" but "no function outside repository/ may import database/sql." Rules you can grep for are rules you can enforce.

### Specification at the Veteran Level

Your specifications should include:
- **Architecture Decision Records (ADRs)** for any non-obvious choice, so future reviewers understand why
- **Boundary contracts** with enough detail that two independent agent sessions produce compatible components
- **Characterization test requirements** for any legacy code the agent will modify
- **Risk classification** for each component (determines verification depth)

---

## Verification Checklists [Durability: A - Foundation/permanent]

### Standard Verification (8 checks - all agent-generated code)

1. **Does it compile/run without errors?** The absolute minimum.
2. **Does it do what was specified?** Trace the main behavior against the specification.
3. **Are there hardcoded secrets?** API keys, passwords, tokens, connection strings.
4. **Are dependencies necessary and current?** Every agent-added dependency - needed, maintained, vulnerability-free?
5. **Are errors handled, not swallowed?** No empty catch blocks, no generic log-and-continue.
6. **Is input validated?** Every external value checked before use.
7. **Are resources cleaned up?** Connections, handles, sockets closed in all paths.
8. **Do the tests test the right things?** Tests verify the specification, not just exercise the code.

### Elevated Verification (+5 for business logic)

9. **Are business rules in the correct order?** Sequence matters for calculations and transformations.
10. **Are edge cases at business boundaries handled?** Zero, negative, empty, null, maximum.
11. **Is the logic consistent with existing business rules?** Cross-component consistency.
12. **Are rounding and precision correct?** Financial and measurement calculations.
13. **Is business logic testable in isolation?** Separated from infrastructure.

### Critical Verification (+5 for security/financial)

14. **Is authentication checked on every protected endpoint?**
15. **Is authorization granular?** Roles, permissions, resource-level access.
16. **Is sensitive data encrypted in transit and at rest?**
17. **Are audit trails complete?** Who, what, when, from where.
18. **Has the code been tested with adversarial inputs?** Full OWASP top 10 coverage.

### Veteran-Specific Additions

- **Cross-component consistency:** Do the contracts between agent-generated components actually match? Type mismatches at boundaries are the most common integration failure.
- **Legacy compatibility:** Does the new code respect the implicit contracts of existing code it interacts with?
- **Performance under load:** Has the code been profiled under realistic load, not just tested with single requests?

---

## Simulation Readiness [Durability: C - Practice/quarterly review]

### Readiness Markers

**S2.1 - Bug Taxonomy Building:**
Prerequisite: Module 1, section 1.1.
Simulation: Over two weeks of real agent-assisted development, build a categorized taxonomy of agent failure modes specific to your stack.
Ready when: Your taxonomy has 10+ categorized entries with detection strategies for each.

**S2.2 - Architecture Constraint Extraction:**
Prerequisite: Module 1, section 1.2.
Simulation: Take a system you know well and extract every undocumented architectural constraint into a specification-ready format.
Ready when: A new team member (or agent) given your constraint document would not violate any implicit rules.

**S2.3 - Legacy Risk Assessment:**
Prerequisite: Module 1, section 1.3.
Simulation: Map the riskiest module in your codebase - obvious behavior, hidden behavior, implicit contracts, and agent-safe boundaries.
Ready when: Your map is comprehensive enough to serve as an agent specification for safe modification.

**S2.4 - Macro Action Sizing:**
Prerequisite: Module 2, section 2.1.
Simulation: Decompose a real feature into macro-action-sized chunks with specifications, verification plans, and failure predictions for each.
Ready when: Each chunk has a specification precise enough for correct agent implementation and a verification plan that catches the predicted failures.

**S2.5 - Cliff Mapping:**
Prerequisite: Module 2, section 2.3.
Simulation: For three task types you frequently delegate, find the complexity threshold where agent output quality degrades from reliable to unreliable.
Ready when: You have documented cliff points for your primary task types and can predict delegation success before starting.

**S2.6 - Verification Pipeline Design:**
Prerequisite: Module 3, section 3.2.
Simulation: Design and document a complete verification pipeline for your team's most common agent-generated code type.
Ready when: The pipeline has automated and manual stages, risk-calibrated review depth, and measurable throughput targets.

---

## Curriculum Design Notes

**What this curriculum assumes the learner already has:** Deep production experience, strong mental models for system behavior, code review expertise, incident response experience, leadership of technical projects.

**What this curriculum does NOT cover (and why):** Organizational strategy, hiring, and culture change — those belong to the senior leader curriculum. Foundational CS and basic agent interaction — those belong to the new grad curriculum. MECE boundary: this curriculum covers the *experienced IC and tech lead* transition from "person who builds systems" to "person who oversees system generation."

**Agent-tutor guidance:** The critical intuition to encode is *trust calibration under expertise*. Veterans have strong priors and the agent-tutor must challenge both over-skepticism ("I could write this better myself") and over-trust ("the agent handles the implementation details, I'll focus on architecture"). The right calibration is task-dependent and the tutor should force the learner to articulate *why* they trust or distrust specific outputs. When the veteran says "I'd rather do this myself," the tutor should ask: "Is that because the task requires your judgment, or because delegation feels like giving up control?" When the veteran says "the agent can handle this," the tutor should ask: "What's the failure cost if it doesn't, and how will you verify?"
