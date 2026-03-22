# Software Pilotry Curriculum: Level 0 - Foundations

> **Starting position:** No production experience. May be a student, career changer, or early-stage learner. Like a medical student who is not yet accountable for patient outcomes but is building the foundational knowledge that accountability will eventually rest on. Risk: skips straight to agent interaction without understanding what software systems actually are, producing someone who can prompt but cannot evaluate.

**Accountability framing:** At L0, you are not yet accountable for production software. That is the point. A medical student observes surgeries before performing them. A pilot trainee studies aerodynamics before flying. You are building the vocabulary, observation skills, and diagnostic instincts that will make real accountability possible at higher levels. Every concept here exists because it is a prerequisite for the judgment you will need when agent-generated code has real consequences.

---

## Module 1: Systems Vocabulary [Durability: A - Foundation/permanent]

Before you can oversee software generation, you need to speak the language of the systems that software runs on. This module builds that vocabulary from first principles.

**Accountability context:** You cannot be accountable for something you cannot name. Every term in this section is a concept you will eventually need to evaluate in agent-generated output. Learning these terms is not memorization - it is building the mental model that makes oversight possible.

### 1.1 What Is a Server?

A server is a computer that waits for requests and sends responses. That is the entire concept. Everything else is detail.

**The physical reality:**
A server is a machine in a data center - a room full of computers connected to the internet with redundant power and cooling. When you visit a website, your browser sends a request over the internet to one of these machines, which processes it and sends back a response. The time between request and response is latency, and it matters because users leave when things are slow.

**Virtual servers and containers:**
Modern servers are usually not physical machines - they are virtual machines or containers running on shared physical hardware. A virtual machine pretends to be a complete computer. A container is lighter - it shares the host operating system but isolates the application. When you hear "deploy to the cloud," this is what it means: your code runs in a container on a virtual machine on a physical server in a data center.

**Why this matters for pilotry:**
Agents generate code that runs on servers. The agent does not think about the server - it generates code that assumes infinite memory, instant network, and zero concurrent users. Understanding what a server actually is helps you spot those assumptions.

### 1.2 What Is a Database?

A database stores data so that it survives restarts, is queryable, and can handle multiple users accessing it simultaneously.

**Relational databases (SQL):**
Data organized into tables with rows and columns. Tables relate to each other through foreign keys. You query them with SQL - a language for asking questions about structured data. PostgreSQL, MySQL, and SQLite are common examples.

**Key concepts:**
- **Schema:** The structure definition - what tables exist, what columns they have, what types the columns are. The schema is a contract: data that violates the schema is rejected.
- **Transactions:** A group of operations that either all succeed or all fail. Transferring money between accounts requires a transaction - debit one account AND credit another, never just one.
- **Indexes:** Data structures that make queries fast. Without an index, the database reads every row to find what you need. With an index, it jumps directly to the right rows. Agents frequently forget to add indexes for queries they generate.

**Non-relational databases (NoSQL):**
Data stored as documents (MongoDB), key-value pairs (Redis), or other structures that do not fit neatly into tables. Useful when your data does not have a fixed structure or when you need very fast reads.

### 1.3 What Is an API?

An API (Application Programming Interface) is a contract between two pieces of software. It defines: what requests you can make, what format they must be in, and what responses you will get back.

**REST APIs:**
The most common web API style. Uses HTTP methods (GET to read, POST to create, PUT to update, DELETE to remove) with URLs that identify resources. Example: `GET /users/123` returns user 123. `POST /users` creates a new user. The response is usually JSON - a structured text format.

**Why APIs matter for pilotry:**
APIs are boundaries. Every boundary is a place where things can go wrong - wrong format, missing fields, unexpected errors, authentication failures. Agents generate API code frequently, and the boundary behavior is where they make the most mistakes.

### 1.4 What Is Deployment?

Deployment is the process of getting your code from your machine to a server where users can access it.

**The deployment pipeline:**
Code goes through stages: development (your machine) to staging (a test server that mimics production) to production (the real server users hit). Each stage has checks - tests that must pass, reviews that must be completed, security scans that must be clean.

**Infrastructure as code:**
Modern deployments are defined in configuration files (Terraform, CloudFormation, Kubernetes manifests). The infrastructure is not set up manually - it is specified in code and created automatically. This means infrastructure can have bugs too, and agents generate infrastructure code with the same confidence-without-understanding they apply to application code.

**Key vocabulary:**
- **CI/CD:** Continuous Integration / Continuous Deployment. Automated pipelines that test, build, and deploy code.
- **Environment variables:** Configuration values that differ between environments (development vs. production). Database passwords, API keys, and feature flags live here.
- **Rollback:** Reverting to the previous version when a deployment causes problems. The ability to roll back quickly is the difference between a 5-minute incident and a 5-hour one.

---

## Module 2: Reading Dashboards and Logs [Durability: B - Systems/annual review]

Observation comes before action. Before you can diagnose problems, you need to read the instruments.

**Accountability context:** In higher-level curricula, you will be responsible for verifying that agent-generated code behaves correctly in production. That verification starts with knowing how to read the signals systems emit. Dashboards and logs are the instruments of software pilotry - like vital signs monitors in medicine or cockpit instruments in aviation.

### 2.1 What Logs Tell You

A log is a timestamped record of what happened. Every server, database, and application produces logs. Reading them is the most fundamental diagnostic skill.

**Log anatomy:**
```
2024-03-15T14:23:07.123Z [INFO] Request received: GET /api/users/456 - 200 OK - 23ms
2024-03-15T14:23:07.456Z [WARN] Cache miss for key: user_456, falling back to database
2024-03-15T14:23:08.789Z [ERROR] Database connection timeout after 5000ms - pool exhausted
```

Each line has: timestamp (when), level (severity), message (what happened), and context (relevant details).

**Log levels and what they mean:**
- **DEBUG:** Detailed information for developers. Usually disabled in production because the volume is too high.
- **INFO:** Normal operations. "Request received," "user logged in," "job completed." The heartbeat of the system.
- **WARN:** Something unexpected happened but the system handled it. "Cache miss," "retry succeeded on second attempt." Warning signs that may indicate a developing problem.
- **ERROR:** Something failed. "Database timeout," "external API returned 500," "file not found." Requires investigation.
- **FATAL/CRITICAL:** The system cannot continue. "Out of memory," "configuration file missing," "cannot bind to port." The system is down or about to be.

**What to look for:**
- Patterns: is the same error repeating? How fast is it repeating?
- Timing: did errors start at a specific time? What changed at that time? (A deployment? A traffic spike?)
- Correlation: are errors in one service related to errors in another?

### 2.2 What Dashboards Show You

A dashboard is a visual summary of system health. Where logs show individual events, dashboards show trends and aggregates.

**The four golden signals:**
These are the metrics that matter most for any service:
1. **Latency:** How long requests take. Watch p50 (median), p95 (most users), and p99 (worst case). A system with low p50 but high p99 has a tail-latency problem - most users are fine, but some have terrible experiences.
2. **Traffic:** How many requests per second. Establishes the baseline. Unusual traffic (too high or too low) is always worth investigating.
3. **Errors:** What percentage of requests fail. A sudden spike means something broke. A gradual increase means something is degrading.
4. **Saturation:** How full are your resources? CPU usage, memory usage, disk usage, connection pool usage. When any resource hits its limit, everything depending on it degrades.

**Reading a dashboard:**
Look for: sudden changes (something broke), gradual trends (something is degrading), correlations (error rate went up when traffic went up - capacity issue), and baselines (what does "normal" look like for this system?).

### 2.3 Structured Observation Practice

**Exercise - Log Reading:**
Given a set of application logs from a failing system, answer:
1. When did the problem start?
2. What was the first error?
3. Are subsequent errors caused by the first error, or are they independent?
4. What would you check next?

**Exercise - Dashboard Interpretation:**
Given a monitoring dashboard showing the four golden signals over 24 hours:
1. Identify the time when the incident started
2. Which signal changed first?
3. What is your hypothesis for the root cause based on which signals are affected?
4. What additional data would you need to confirm your hypothesis?

These exercises build the diagnostic instinct: observe before acting, form hypotheses before intervening, gather evidence before concluding.

---

## Module 3: Accountability in Practice [Durability: A - Foundation/permanent]

At L0, accountability is about building the habits that will scale. You are forming the reflexes that make oversight possible.

### 3.1 Diagnostic Reasoning Introduction

The most important principle in pilotry - and in medicine, aviation, and every other high-stakes domain - is: observe before you act.

**The diagnostic loop:**
1. **Observe:** What is actually happening? Not what you think is happening - what the evidence shows.
2. **Hypothesize:** What could cause this? Generate multiple hypotheses, not just the first one that comes to mind.
3. **Test:** What evidence would confirm or rule out each hypothesis? Gather that evidence.
4. **Act:** Based on evidence, take the smallest action that addresses the most likely cause.
5. **Verify:** Did the action fix the problem? Check the evidence again, not just the symptoms.

**Why this matters for agent oversight:**
When agent-generated code does not work, the instinct is to tell the agent "fix it." This skips steps 1-3 and jumps straight to action - and the action is performed by the same system that created the problem. Diagnostic reasoning means: before you ask the agent to fix anything, understand what is wrong and why. Then you can give the agent a precise correction rather than a vague "fix it" that leads to fixation loops.

**The medical analogy:**
A medical student does not prescribe medication on their first day. They learn anatomy, physiology, and pathology. They observe experienced doctors. They learn to read test results and imaging. Only after this foundation do they begin making clinical decisions, always supervised. Software pilotry follows the same progression: understand systems, observe behavior, learn to read the instruments, then begin making decisions about agent-generated output.

### 3.2 K8sGames Graduation Criteria

K8sGames are simulation exercises that test your foundational knowledge in controlled environments. These are your concrete learning objectives for L0 graduation.

**Graduation requirements:**

1. **Systems vocabulary fluency:** Given a system architecture diagram, correctly identify and explain the role of each component (server, database, cache, load balancer, message queue, CDN).

2. **Log interpretation:** Given a set of production logs containing an incident, correctly identify the root cause within 15 minutes without external hints.

3. **Dashboard reading:** Given a monitoring dashboard showing degraded performance, correctly identify which golden signal changed first and propose a plausible hypothesis.

4. **API contract understanding:** Given an API specification, identify three things that could go wrong at the boundary (missing validation, error handling gaps, authentication issues).

5. **Deployment pipeline literacy:** Describe the stages of a CI/CD pipeline and explain what each stage catches that previous stages do not.

6. **Security awareness baseline:** Given a simple web application, identify at least three security concerns (not fixes - just the concerns). This tests threat awareness, not remediation ability.

7. **Diagnostic reasoning demonstration:** Given a broken system scenario, demonstrate the observe-hypothesize-test-act-verify loop rather than jumping to solutions.

8. **Agent limitation awareness:** Explain three categories of problems where agents produce unreliable output, and describe what makes each category difficult for statistical pattern matching.

---

## Before You Specify [Durability: B - Systems/annual review]

At L0, you are not yet writing production specifications. But you are building the thinking habits that make good specifications possible. This section introduces design thinking basics that you will use at every level.

### The Five Questions

Before you ask an agent to build anything - even a learning exercise - answer these questions:

1. **What does it do?** Describe the behavior in one sentence. If you cannot do this, you do not understand what you want.
2. **What data does it use?** List every piece of data: where it comes from, what type it is, what constraints it has.
3. **What can go wrong?** List at least three failure modes. If you cannot think of three, you have not thought hard enough.
4. **Who uses it?** A person? Another service? Both? This determines the interface.
5. **How do you know it works?** Define "done" before you start. What would you check to verify it is correct?

These five questions are the seed of every specification you will write. At L0, they are a thinking exercise. At higher levels, they become the skeleton of your specification documents.

### Design Thinking Basics

**Constraint-first thinking:**
Do not start with what you want. Start with what you cannot have. Constraints are more useful than goals because they eliminate options. "Fast" is meaningless. "Responds in under 200ms with 100 concurrent users on a single 2-CPU container" is a constraint you can test against.

**Boundaries before internals:**
Define what goes in and what comes out before you think about how it works inside. The boundary is the contract. If the boundary is wrong, the internals do not matter.

**Failure before success:**
Think about how the system fails before you think about how it succeeds. Success paths are obvious. Failure paths are where bugs live.

---

## Standard Verification Checklist [Durability: A - Foundation/permanent]

Every piece of agent-generated code must pass these eight checks. These form the standard tier of verification and apply universally, regardless of the code's purpose or risk level.

### The Eight Standard Checks

1. **Does it compile/run without errors?** The absolute minimum. If it does not, stop here.
2. **Does it do what was specified?** Trace the main behavior against the specification. Not "does it look right" - does it actually do the thing?
3. **Are there hardcoded secrets?** API keys, passwords, tokens, connection strings. Agents embed these routinely.
4. **Are dependencies necessary and current?** Every dependency the agent added - do you need it? Is it maintained? Does it have known vulnerabilities?
5. **Are errors handled, not swallowed?** Look for empty catch blocks, generic error handlers that log and continue, or missing error handling entirely.
6. **Is input validated?** Every value that comes from outside the code (user input, API responses, file contents) - is it checked before use?
7. **Are resources cleaned up?** Database connections, file handles, network sockets - are they closed in all paths, including error paths?
8. **Do the tests test the right things?** If there are tests, do they verify the specification or just exercise the code? A test that passes when the code is wrong is worse than no test.

### Elevated Verification (+5 for business logic)

When the code implements business rules, pricing, permissions, or data transformations, add:

9. **Are business rules implemented in the correct order?** Discount before tax or tax before discount produces different results. Order matters.
10. **Are edge cases at business boundaries handled?** Zero quantities, negative amounts, empty lists, boundary dates, null optional fields.
11. **Is the logic consistent with existing business rules elsewhere in the system?** Agents do not know your other business rules. Contradictions are common.
12. **Are rounding and precision handled correctly?** Financial calculations with floating-point arithmetic are a classic agent failure.
13. **Is the business logic testable in isolation?** If business logic is tangled with infrastructure code, it cannot be verified independently.

### Critical Verification (+5 for security/financial)

When the code handles authentication, authorization, payments, personal data, or regulatory compliance, add:

14. **Is authentication checked on every protected endpoint?** Not just the ones you think of - every route that should require auth.
15. **Is authorization granular?** Authentication (who you are) is not authorization (what you can do). Are roles and permissions checked?
16. **Is sensitive data encrypted in transit and at rest?** Passwords hashed with bcrypt/argon2, not MD5/SHA. TLS for all external communication.
17. **Are audit trails complete?** Every action on sensitive data should be logged with who, what, when, and from where.
18. **Has the code been tested with adversarial inputs?** SQL injection, XSS, path traversal, oversized payloads, malformed tokens.

---

## Simulation Readiness [Durability: C - Practice/quarterly review]

This section maps L0 learning to simulation scenarios. Each marker indicates readiness for a specific simulation exercise.

### Readiness Markers

**S0.1 - Systems Vocabulary Simulation:**
Prerequisite: Completion of Module 1 (all sections).
Simulation: Given a multi-component system diagram, narrate what happens when a user request flows through the system. Identify each component, explain its role, and describe what happens when each component fails.
Ready when: You can trace a request through 5+ components without reference material and correctly predict failure propagation.

**S0.2 - Log Diagnosis Simulation:**
Prerequisite: Completion of Module 2, sections 2.1 and 2.3.
Simulation: Given a 200-line log excerpt from a production incident, identify the root cause and the cascade of secondary failures.
Ready when: You can distinguish primary failures from secondary symptoms and form a correct hypothesis within 10 minutes.

**S0.3 - Dashboard Triage Simulation:**
Prerequisite: Completion of Module 2, sections 2.2 and 2.3.
Simulation: Given a live-updating dashboard (simulated), detect the onset of an incident, identify the affected signal, and propose investigation steps.
Ready when: You notice the anomaly within 2 minutes of onset and your proposed investigation is on the correct path.

**S0.4 - Diagnostic Reasoning Simulation:**
Prerequisite: Completion of Module 3, section 3.1.
Simulation: Given a broken web application and access to logs, dashboard, and source code, diagnose the issue using the observe-hypothesize-test-act-verify loop. You may not ask an agent for help.
Ready when: You follow the diagnostic loop without skipping steps and reach the correct diagnosis within 20 minutes.

---

## Curriculum Design Notes

**What this curriculum assumes the learner already has:** Basic computer literacy, ability to read simple code examples, motivation to learn software development practices. No production experience required. No CS degree required.

**What this curriculum does NOT cover (and why):** Writing production code, operating agents for real projects, security remediation, system design, or team leadership - these belong to the new-grad, veteran, and senior-leader curricula respectively. MECE boundary: this curriculum covers the *pre-professional* foundation from "person who wants to work with software" to "person ready to begin supervised agent-assisted development."

**Agent-tutor guidance:** The critical intuition to encode is *patience with foundations*. L0 learners want to jump to using agents because agents are exciting and visible. The tutor must consistently redirect to foundational understanding: "Before you ask the agent to build that, can you explain what a database transaction is and why it matters here?" When the learner says "the agent can handle that," the tutor should respond: "In six months, you will be responsible for evaluating whether the agent handled it correctly. What do you need to know to make that evaluation?" The goal is to build the diagnostic instinct before the intervention instinct - observe before you act, understand before you specify.
