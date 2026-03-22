# Design Review: Progress Tracking in Socratic Tutoring

> **Date:** 2026-03-22
> **Question:** What gaps, if any, are present in the design of this Socratic tutoring process given the arbitrary nature of what "progress" even means for an arbitrary text brief?
> **Reviewers (simulated):** Andrej Karpathy, Donald Knuth, John Carmack
> **Format:** Roundtable discussion with access to full codebase

---

## 1. Opening: The System As It Stands

**Carmack:** Let me make sure I understand the architecture. The learner chats with a Gemini-powered tutor. After every exchange, the tutor's response is parsed for tool calls. One of those tools is `session_complete`, and if the LLM calls it, the section is marked done. There's also a secondary signal - `surface_key_insight` with `learner_readiness: "articulated"`. That's the entire completion model.

**Karpathy:** Right. And concept tracking is a side channel - the tutor can optionally call `track_concepts` to report which concepts the learner demonstrated and at what level. But concept mastery has zero bearing on whether the section is marked complete. Completion is pure LLM discretion.

**Knuth:** So we have a system where the definition of "done" is "whenever the oracle says so." The oracle being a language model with a system prompt, a conversation history, and a key_intuition it's supposed to guide toward. There's no formal specification of what mastery looks like, no rubric, no threshold.

**Carmack:** The key_intuition field is interesting though. Each section has one, like "Compiles and passes tests is the *starting point*, not the end." The tutor's job is to get the learner to articulate that insight. When the learner says it back in their own words, the tutor fires `surface_key_insight` with `learner_readiness: "articulated"`. That's actually a well-defined completion criterion - it's just not enforced by anything except the LLM's judgment.

---

## 2. The Core Problem: No Intermediate Representation

**Karpathy:** The fundamental gap I see is there's no intermediate representation between the raw curriculum text and the LLM's decision. You have:

- Input: markdown brief with sections, key_intuitions, bold-header concepts
- Process: LLM reads it, tutors the learner, decides when they're done
- Output: binary status (in_progress/completed) plus some concept levels

What's missing is a **formal learning map** - a structured representation of what "understanding this section" actually means. Right now the LLM is doing two jobs simultaneously: teaching AND evaluating. Those should be separable.

**Knuth:** This is the classic problem of conflating the process with the measure. In algorithm analysis, we don't say "the algorithm is efficient because it feels fast." We define time complexity, prove bounds, measure against them. Here, the tutor is both the executor and the judge, with no external standard to judge against.

**Carmack:** But that's also the strength of the design - it's adaptive. A formal rubric would be rigid. The LLM can adjust to the learner's pace and communication style. The question is whether we can get the adaptivity AND have verifiable progress claims.

---

## 3. Proposal: Offline Discovery Pass

**Karpathy:** Here's what I'd propose. Before any learner interaction, run an offline "discovery" pass on each curriculum section. Feed the section markdown, key_intuition, and extracted concepts to a model with a structured extraction prompt:

"Given this section content, produce:
1. **Prerequisite knowledge** - what must the learner already know
2. **Core claims** - 3-7 factual or conceptual claims this section makes (each independently verifiable)
3. **Key misconceptions** - common wrong beliefs the learner might hold
4. **Demonstration criteria** - for each core claim, what would the learner say or do to demonstrate understanding
5. **Key intuition decomposition** - break the key_intuition into 2-4 sub-insights that build toward it"

This produces a **section learning map**. It's generated once, cached, and becomes the ground truth for what "progress through this section" means.

**Knuth:** I like the formality. You're essentially compiling the curriculum into a verifiable specification before runtime. The analogy is literate programming - you write the explanation and the code together, but they serve different purposes. Here, the section content is the "explanation" and the learning map is the "code" - the executable specification of what understanding looks like.

**Carmack:** The implementation is straightforward too. You'd store this as a JSON artifact per section. The tutor's system prompt gets the learning map in addition to the section content. The progress tracker checks demonstrated claims against the map rather than relying solely on `session_complete`.

---

## 4. Multi-Pass Architecture

**Karpathy:** Let me sketch the full multi-pass system:

**Pass 0: Curriculum Compilation (offline, run once per curriculum update)**
- Input: section markdown + key_intuition + concepts
- Output: SectionLearningMap per section
- Model: high-capability model (Opus-class), temperature 0
- Cached in shared package alongside curriculum data

**Pass 1: Tutoring (real-time, per exchange)**
- Same as current system, but system prompt now includes the SectionLearningMap
- Tutor knows the specific claims, misconceptions, and demonstration criteria
- Tutor's job is teaching, not defining what "done" means

**Pass 2: Assessment (real-time, after each exchange)**
- Separate model call (or structured extraction from the tutor response)
- Input: the exchange, the SectionLearningMap, the learner's cumulative claim coverage
- Output: which claims were demonstrated, at what level, any misconceptions surfaced
- This is the evaluator - independent from the tutor

**Pass 3: Progress Synthesis (periodic or on-demand)**
- Input: all claim assessments for a section
- Output: section-level progress (percentage of claims demonstrated, weakest areas, readiness for completion)
- Deterministic logic, no LLM needed

**Carmack:** Pass 2 is the critical addition. Right now the tutor is both teacher and grader. Separating them means the grader can be more conservative - it doesn't have the social pressure of being in a conversation. The tutor might think "close enough, they get it" but the assessor checks against the claim list objectively.

**Knuth:** And Pass 0 gives you something the current system entirely lacks: a **fixed point**. The SectionLearningMap doesn't change during the conversation. It's the invariant against which progress is measured. Without it, "progress" is defined by whatever the LLM happens to think in that moment, which is non-deterministic and non-reproducible.

---

## 5. What the Learning Map Solves

**Karpathy:** Let me enumerate the specific gaps this addresses:

### Gap 1: No mastery threshold
**Current:** Completion is binary - the LLM says done or not. A learner could be marked complete with "emerging" understanding on every concept.

**With learning map:** Completion requires N of M core claims demonstrated at "developing" or higher. The threshold is configurable per section or curriculum level.

### Gap 2: Concept extraction is fragile
**Current:** Concepts are extracted from bold markdown headers via regex. False positives (bold text that isn't a concept) and false negatives (concepts not in bold) are common.

**With learning map:** Concepts are explicitly enumerated in Pass 0 by a model that understands the content semantically. The regex extraction becomes a fallback, not the primary source.

### Gap 3: No distinction between "covered" and "understood"
**Current:** `track_concepts` reports concepts the tutor thinks the learner demonstrated. But "demonstrated" is subjective - did the learner parrot back the concept, or genuinely reason about it?

**With learning map:** Demonstration criteria are explicit. "The learner can explain why a race condition produces non-deterministic output" is verifiable. "The learner mentioned race conditions" is not. The criteria distinguish surface mention from genuine understanding.

### Gap 4: Tutor can't see what's missing
**Current:** The tutor sees the full section markdown and the key_intuition, but doesn't have a structured checklist of what the learner hasn't covered yet. It relies on the LLM's implicit tracking.

**With learning map:** The system prompt includes "Claims not yet demonstrated: [list]". The tutor explicitly knows what ground remains to cover.

### Gap 5: Progress is not comparable across learners
**Current:** If two learners both complete section 1.1, their "completed" status means entirely different things depending on which tutor conversations they had.

**With learning map:** Both learners' progress is measured against the same claim list. Completion means the same set of claims were demonstrated.

### Gap 6: No regression detection
**Current:** Once a section is completed, status never regresses. But the learner might forget concepts - the spaced-repetition system tracks this at the concept level, but section-level status doesn't reflect it.

**With learning map:** Section readiness can be re-evaluated. If enough claims' concept dependencies are overdue for review, the section status could downgrade to "needs review" without losing the completion record.

---

## 6. The Assessor Problem

**Carmack:** I want to dig into Pass 2 because that's where the real engineering challenge is. You're proposing a separate model call after every exchange to evaluate claim coverage. That doubles your Gemini calls.

**Karpathy:** True. Three mitigations:

1. **Batch assessment.** Don't assess after every exchange. Assess after every N exchanges, or when the tutor calls a tool that suggests potential progress (evaluate_response, surface_key_insight, session_complete). Most exchanges are socratic_probe - just questions - so no progress to assess.

2. **Structured extraction from existing response.** Instead of a separate model call, extend the tutor's tool set. Add an `assess_claims` tool that the tutor calls alongside its other tools. The tutor already calls `track_concepts` - this is the same pattern but with claims instead of concepts.

3. **Async assessment.** The assessment doesn't need to be synchronous. Fire it off like the current fire-and-forget progress update. The learner's experience isn't affected.

**Carmack:** Option 2 is cleanest. You already have the `track_concepts` side-effect tool pattern. Add a `claim_assessment` side-effect tool:

```
claim_assessment:
  claims_demonstrated: ["claim-id-1", "claim-id-3"]
  claim_levels: ["solid", "developing"]
  misconceptions_surfaced: ["thinks-race-conditions-only-in-multithreaded"]
```

The tutor calls this alongside its reply tool. No extra model call.

**Knuth:** But now you've re-introduced the conflation problem. The tutor is again both teaching and evaluating. The whole point was to separate them.

**Karpathy:** Fair. The compromise is: the tutor self-reports claims via the tool (cheap, synchronous), but a periodic independent assessment (Pass 2) audits the tutor's self-reports. Think of it as continuous self-assessment with periodic external audit. The audit catches cases where the tutor was too generous.

**Carmack:** That's pragmatic. Ship with tutor self-assessment via `claim_assessment` tool. Add the independent auditor later when you have data showing the tutor over-credits. Don't build the expensive thing until you've measured the cheap thing.

---

## 7. The Completion Model

**Knuth:** Let me formalize the completion model with the learning map:

```
Section status is a function of:
  - claims_demonstrated: Map<ClaimId, {level, timestamp, exchange_id}>
  - claims_total: from SectionLearningMap
  - key_intuition_articulated: boolean
  - minimum_level: configurable per curriculum (default: "developing")

Completion criteria:
  1. key_intuition_articulated = true
  2. |claims_demonstrated where level >= minimum_level| >= threshold * |claims_total|
  3. No active misconceptions flagged without resolution

Where threshold defaults to 0.7 (configurable).

Progress percentage:
  claims_at_or_above_minimum / claims_total
```

This gives you:
- A progress bar (not just binary status)
- A formal completion criterion
- A meaningful "in_progress" state (30% of claims demonstrated vs 80%)
- A reason to return to a section (misconceptions, decayed concepts)

**Carmack:** And critically, the tutor's `session_complete` call becomes a *recommendation*, not the final word. The system checks: "tutor says complete, but only 3 of 7 claims are at developing or higher - override to in_progress, prompt tutor to continue."

**Karpathy:** That's a guardrail against premature completion. The tutor can still end a session (learner is tired, time's up), but the section status reflects actual claim coverage, not just the tutor's optimism.

---

## 8. Implementation Priorities

**Carmack:** If I'm prioritizing this for a small team, here's the order:

**Phase 1: Learning Map Generation (highest value, lowest risk)**
- Add SectionLearningMap type to shared package
- Write the Pass 0 prompt (offline compilation)
- Generate maps for all existing sections
- Store alongside curriculum data
- No changes to the tutor or progress system yet - just generate the data and validate it looks right

**Phase 2: Tutor Awareness (medium value, low risk)**
- Inject the learning map into the tutor's system prompt
- Add "Claims not yet demonstrated" to the progress context
- The tutor now knows the specific checklist - even without formal assessment, this improves tutoring quality

**Phase 3: Claim Assessment (high value, medium risk)**
- Add `claim_assessment` side-effect tool to buildSocraticTools
- Update progress tracking to record claim coverage
- Replace binary completion with threshold-based completion
- Add progress percentage to the dashboard

**Phase 4: Independent Auditor (future, measure first)**
- Periodic separate model call to audit tutor's claim assessments
- Only build if Phase 3 data shows tutor over-credits

**Karpathy:** Agreed on the ordering. Phase 1 is pure data generation with no runtime risk. Phase 2 improves tutor behavior with minimal code change. Phase 3 is the real progress model upgrade. Phase 4 is insurance.

**Knuth:** I'd add a Phase 0: formalize the SectionLearningMap schema and write the invariants it must satisfy. Before you generate any maps, define what a valid map looks like. How many claims minimum? Must every concept appear in at least one claim? Must the key_intuition map to at least one demonstration criterion? Get the specification right before generating instances.

---

## 9. Addressing the "Arbitrary Text Brief" Problem

**Karpathy:** The original question mentions "arbitrary text brief" - what if the curriculum is not pre-authored but dynamically generated or user-provided?

**Carmack:** That's the hardest case. With authored curriculum, Pass 0 runs once and you verify the learning maps manually. With arbitrary briefs, the maps must be generated on-the-fly and trusted without human review.

**Knuth:** The solution is the same architecture but with validation. Generate the learning map, then validate it:
- Does it have 3-7 core claims? (reject if fewer - the brief is too thin)
- Are demonstration criteria actionable? (reject vague ones)
- Does the key_intuition decomposition cover the original intuition? (self-consistency check)

If validation fails, fall back to the current system (LLM discretion only) and flag the section for human review.

**Karpathy:** For truly arbitrary briefs, you could also do a two-step generation:
1. Generate the learning map
2. Feed the map back to the model: "Given this learning map, what's missing? What claims are redundant? Is the key intuition decomposition complete?"

Self-critique is cheap and catches obvious gaps. It's not perfect, but it's better than no validation.

---

## 10. Specific Code-Level Recommendations

**Carmack:** Let me get concrete about what changes in the codebase:

### New type: SectionLearningMap
```
Location: packages/shared/src/curricula.ts

SectionLearningMap {
  section_id: string
  prerequisites: string[]
  core_claims: Claim[]
  key_misconceptions: Misconception[]
  key_intuition_decomposition: SubInsight[]
  generated_at: string
  model_used: string
}

Claim {
  id: string                    // "claim-1.1-race-nondeterminism"
  statement: string             // "Race conditions produce non-deterministic output"
  concepts: string[]            // ["race-conditions", "concurrency"]
  demonstration_criteria: string // "Learner explains WHY output varies between runs"
}

SubInsight {
  id: string
  statement: string
  builds_toward: string  // "key_intuition"
  order: number
}
```

### New optional field on SectionMeta
```
learning_map?: SectionLearningMap
```

### New side-effect tool: claim_assessment
```
Location: packages/api/src/routes/socratic-chat.ts (in buildSocraticTools)

claim_assessment (side-effect, not reply):
  claims_demonstrated: string[]    // claim IDs
  claim_levels: string[]           // matching order
  misconceptions_surfaced: string[] // misconception IDs
  misconceptions_resolved: string[] // misconception IDs
```

### Modified: updateSectionProgress
```
Location: packages/api/src/routes/curriculum-progress.ts

- Accept claim assessment data from the parsed response
- Store claims_json alongside concepts_json
- Compute section progress = claims_at_minimum / claims_total
- Override session_complete if claim coverage below threshold
```

### Modified: Dashboard
```
Location: packages/web/src/pages/Dashboard.tsx

- ProgressBadge shows percentage (30%, 70%, 100%) instead of just status
- Module progress shows aggregate claim coverage, not just completed/total
```

---

## 11. Summary of Gaps

**Knuth:** To close, the gaps in order of severity:

1. **No formal definition of what "understanding a section" means.** Fix: SectionLearningMap with enumerated claims and demonstration criteria. (Critical)

2. **Tutor is both teacher and evaluator with no external check.** Fix: claim_assessment tool for self-report, optional independent auditor for verification. (High)

3. **Completion is binary with no intermediate progress.** Fix: threshold-based completion from claim coverage percentage. (High)

4. **No regression model.** Fix: claim coverage decays when underlying concepts are overdue for spaced-repetition review. (Medium)

5. **Concept extraction from markdown is fragile.** Fix: learning map enumerates concepts semantically, regex becomes fallback. (Medium)

6. **Progress is not comparable across learners.** Fix: fixed claim list per section means completion is well-defined. (Medium)

7. **No guardrail against premature completion.** Fix: session_complete becomes a recommendation, overridden if claim coverage is below threshold. (Medium)

8. **Arbitrary briefs have no learning map validation.** Fix: self-critique pass on generated maps with fallback to current system. (Low, future)

**Karpathy:** The single highest-leverage change is Phase 1 - generating the learning maps. Even without changing the progress system, having the maps in the tutor's system prompt will immediately improve tutoring quality. The tutor will know what ground to cover and what to probe for. Everything else builds on that foundation.

**Carmack:** Ship the map generation, validate it looks right, then iterate on the assessment model. Don't try to build the full multi-pass system at once. The current system works - it just can't tell you how well it's working. The map gives you the measuring stick.

---

## Appendix: Current System Inventory

For reference, the current progress tracking touches:

| Component | File | Role |
|-----------|------|------|
| Tutor tools | `packages/api/src/routes/socratic-chat.ts` | 11 Gemini tools including session_complete, track_concepts |
| Progress state machine | `packages/api/src/routes/curriculum-progress.ts` | INSERT/UPDATE curriculum_progress, isCompletionTrigger |
| Spaced repetition | `packages/api/src/lib/spaced-repetition.ts` | Concept assessment intervals, due-for-review detection |
| Curriculum types | `packages/shared/src/curricula.ts` | CurriculumMeta, SectionMeta, concept extraction |
| Curriculum content | `packages/shared/src/curricula/*.ts` | Per-level section data with markdown, key_intuitions |
| Progress API | `packages/api/src/routes/curriculum.ts` | GET progress, GET progress/summary, GET progress/debug |
| Context assembly | `packages/api/src/lib/context-assembly.ts` | Conversation summaries for cross-session awareness |
| Dashboard | `packages/web/src/pages/Dashboard.tsx` | Progress badges, module counts, auto-refresh |
| Progress dashboard | `packages/web/src/pages/ProgressDashboard.tsx` | Detailed progress with narrative, concept review |
