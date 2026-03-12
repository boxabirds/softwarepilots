# Workshop Preparation Materials

## Is Your Team Ready for the Post-Code Era?

Companion to `workshop-post-code-era.md`. This file contains briefs for generating visual aids, the scoring template spec, and the follow-up plan.

---

# Part 1: Facilitation Deck Brief

Brief for generating visual aids using Remotion, Keynote, or any slide-generation tool. Each section describes one visual asset with its content, layout intent, and data requirements. These are not decorative slides — they are functional facilitation tools that the workshop cannot run without.

## Slide 1: The Spectrum (Opening)

**Purpose:** Anchor the whole session. Participants place themselves on this spectrum and return to it at the end.

**Layout:** Horizontal spectrum bar, left-to-right.

**Content:**

| Position | Label | Description |
|----------|-------|-------------|
| Left (Pole A) | Traditional + AI Assist | Copilot/Cursor bolted on. Same review, same pipeline. More code, overwhelmed reviews. |
| Centre | The Messy Middle | Most teams. Some AI, unclear results. |
| Right (Pole B) | Software Factory | StrongDM model. No human code, no human review. Spec and scenario driven. |

**Interactive element:** Five numbered positions (1–5) along the spectrum. In-person: participants place sticky dots. Remote: live poll (Mentimeter, Slido, or Miro voting). Facilitator captures the spread as a histogram.

**Visual notes:** Keep it stark. Two poles with clear labels. Avoid gradient — the point is that most people cluster at 1–2 and think 5 is fiction. The visual tension between where they are and where StrongDM already is does the work.

**Revisit:** At the close, show the same spectrum with the question: "Has your placement changed? Should it?"

## Slide 2: The Delivery Data (Opening)

**Purpose:** Establish the paradox before the dimensions. This is the "why are we here" data.

**Layout:** Three headline numbers, large type, with sourcing below each.

**Content:**

| Metric | Value | Source |
|--------|-------|--------|
| More tasks completed (high AI adoption teams) | +21% | Faros.ai, 10K+ devs, 1,255 teams |
| More PRs merged | +98% | Faros.ai |
| PR review time increase | +91% | Faros.ai |

**Below:** Single contrasting line: "Experienced developers 19% slower overall with AI tools. — METR randomised trial"

**Visual notes:** The first three numbers should feel positive (green or neutral). The METR number should feel jarring — red or contrasting colour. The point is cognitive dissonance: more output, slower delivery.

## Slide 3: Braess's Paradox Diagram (Dimension 3)

**Purpose:** Make the paradox intuitive. The facilitator notes include a verbal explanation; this diagram makes it visual.

**Layout:** Network diagram, two states.

**State 1: Without shortcut (before AI tools)**

```
        Route 1
    A -------- M -------- B
    |                     |
    Route 2               |
    A -------- N -------- B

    Route 1: T/100 congestion + 45 min fixed = 65 min (50 drivers)
    Route 2: 45 min fixed + T/100 congestion = 65 min (50 drivers)
    Everyone: 65 minutes
```

**State 2: With shortcut (AI tools added)**

```
        Route 1
    A -------- M -------- B
    |          |          |
    |     shortcut (0)    |
    |          |          |
    A -------- N -------- B

    All 100 drivers: A→M (congestion) → shortcut → N→B (congestion)
    100/100 + 0 + 100/100 = 80 minutes
    Everyone: 80 minutes. 15 minutes WORSE.
```

**Annotation:** "AI tools are the shortcut. Before: generation and review were loosely coupled. After: every developer floods the fast segment (generation), overloading the shared downstream segment (review)."

**Visual notes:** Keep the network diagram simple — four nodes, five edges. Animate if possible: show State 1 equilibrium, then add the shortcut, then show all traffic rerouting and the collective time increasing. Colour the congestion-sensitive segments differently from fixed-time segments.

## Slide 4: Cognitive Surrender Data (Dimension 4)

**Purpose:** Make the Shaw & Nave findings visceral.

**Layout:** Before/after comparison with a perception gap callout.

**Content:**

| Condition | Accuracy Effect |
|-----------|-----------------|
| AI correct | +25 percentage points |
| AI wrong | -15 percentage points |
| Participants believed AI helped even when it made them wrong | 4 out of 5 followed faulty AI answers |

**Callout box:** "The better the AI usually is, the harder it is to catch when it's wrong."

**Below:** "Two factors helped resist: performance incentives (a reason to care) + real-time feedback (visibility into outcomes). — Shaw & Nave (2026), N=1,372, 9,593 trials"

**Visual notes:** Emphasise the asymmetry. The gain from correct AI is less than double the loss from incorrect AI, but people follow incorrect AI anyway. This is the structural problem.

## Slide 5: The Five Dimensions Overview (Synthesis)

**Purpose:** Reference slide for the synthesis section. Shows all five dimensions in a single view.

**Layout:** Radar chart or five-row table. Radar chart is more visual; table is more precise. Provide both as options.

**Radar chart version:** Five axes radiating from centre. Each axis labelled with the dimension name. Axes scaled 1–5. No data plotted — this is the blank template participants score against.

**Table version:** (Same as the scoring rubric in the workshop agenda, reproduced here for the slide.)

| Dimension | 1 (no practice) | 3 (emerging) | 5 (systematic) |
|-----------|-----------------|--------------|-----------------|
| Specification rigour | Specs vague or skipped | Some testable criteria | Specs are primary deliverable, independently verified |
| Verification independence | Agent-generated tests only | Some manual verification | Structurally independent validation |
| Delivery system balance | Same pipeline, more code | Aware of bottleneck | Downstream investment matches generation speed |
| Cognitive surrender resistance | No structural safeguards | Some review discipline | Process incentivises challenge, provides quality feedback |
| Accountability clarity | Unclear who decides | Named decision-maker | Decision-maker has authority, visibility, evidence |

## Slide 6: One Action Template (Close)

**Purpose:** Structure the commitment at the end. Each participant fills this in.

**Layout:** Fill-in-the-blank card.

**Content:**

```
The dimension with the biggest gap on my team:
_________________________________

One specific action I will take before [date two weeks from today]:
_________________________________

How I will know it worked:
_________________________________

My name: _____________
```

**Visual notes:** This should look like a physical card — something people can photograph, screenshot, or take with them. In-person: print as A5 cards. Remote: editable text field in Miro.

---

# Part 2: Miro Board / Scoring Template Spec

## Board Structure

One Miro board (or FigJam, Mural equivalent) with the following frames. Create the board before the session and share the link in the calendar invite.

### Frame 1: Spectrum Poll

**Content:** The same spectrum from Slide 1, rendered as a horizontal bar with positions 1–5.

**Interaction:** Sticky note or voting dot per participant. Colour-coded if multiple tables (Table 1 = blue, Table 2 = green, etc.).

**Result:** A visible distribution showing where the group places itself. Facilitator photographs this at the start and returns to it at the end.

### Frame 2: Report-Out Board (Dimensions 1–5)

**Content:** Five columns, one per dimension. Column header = dimension name.

**Interaction:** After each dimension's report-out, one person per table adds a sticky with their table's key finding. By the end, each column has 2–4 findings.

**Layout:**

```
| Spec Rigour | Verification | Delivery Balance | Cognitive Surrender | Accountability |
|-------------|--------------|------------------|---------------------|----------------|
| [sticky]    | [sticky]     | [sticky]         | [sticky]            | [sticky]       |
| [sticky]    | [sticky]     | [sticky]         | [sticky]            | [sticky]       |
```

### Frame 3: Individual Scoring

**Content:** One copy of the five-dimension rubric table (from Slide 5) per participant. Pre-populate with participant names if registration is complete; otherwise, blank copies they can claim.

**Interaction:** Each participant scores 1–5 on each dimension. This is private — participants choose whether to share. The table discussion is about comparing, not about public scoring.

**Alternative:** If privacy matters (large group, mixed seniority), use a Google Form or Typeform that collects scores anonymously and displays aggregate results in real time. Facilitator shows the aggregate radar chart.

### Frame 4: Action Commitments

**Content:** One copy of the action card template (from Slide 6) per participant.

**Interaction:** Filled in during the final five minutes. Remains visible after the session for follow-up.

## Pre-Session Checklist

- [ ] Board created with all four frames
- [ ] Board link shared in calendar invite
- [ ] Test that participants can add sticky notes without needing a Miro account (set permissions to "anyone with the link can edit")
- [ ] Facilitator laptop connected to projector/screen share and logged into the board
- [ ] Timer visible (phone timer on screen, or Miro timer plugin)
- [ ] Pre-read email sent 48 hours before with the two pre-read pieces from the workshop doc (lines 42–71 of workshop-post-code-era.md)

---

# Part 3: Follow-Up Plan

## The Business Case for Follow-Up

The workshop creates awareness. The follow-up creates change. Without follow-up, the median outcome is: participants feel energised for 48 hours, take no action, and return to their previous patterns. The 1:1 follow-up is where the real signal emerges — which dimensions actually matter to this audience, and which commitments survive contact with reality.

The follow-up is also the sales funnel for the spec coaching skill and deeper engagement. Participants who took action and saw results are the early adopters for tooling. Participants who didn't take action reveal the actual barriers.

## Timing

Two weeks after the workshop. Not one week (too soon — nothing has changed yet). Not three weeks (too late — the energy is gone and the action either happened or didn't).

Book the 1:1 during the workshop itself — at the end, while people are filling in their action cards. "I'll check in with each of you in two weeks to see what happened. Let's book 30 minutes now." If you wait until after the workshop to schedule, response rates drop by half.

## Format

30 minutes. Video call or in-person. One-on-one, not group.

## Script

### Opening (2 min)

"Two weeks ago you committed to [read back their action card]. What happened?"

Do not soften this. The directness is the value. They've had two weeks. Either they did it or they didn't. Both outcomes are informative.

### What happened (10 min)

**If they took action:**

- "What did you actually do? Walk me through it."
- "What did you learn that surprised you?"
- "Did the team's response match what you expected?"
- "Would you do it again, or would you change the approach?"
- "Which of the five dimensions feels most urgent now — is it the same one as two weeks ago?"

**If they didn't take action:**

Do not judge. Diagnose. The barrier is the information.

- "What got in the way?"
- "Was it a priority problem (other things were more urgent), a clarity problem (you weren't sure what to do first), or a permission problem (you didn't feel you had the authority to change the process)?"
- "If you had taken the action, what do you think would have happened?"
- "Is there a smaller version of the action that would have been feasible?"

### The dimension deep-dive (10 min)

Pick the dimension they scored lowest on (or the one that came up most in their answer). Go deeper:

**Specification rigour:** "Show me the last spec your team wrote. Let's look at it together against the rubric — testable criteria, edge cases, failure modes, constraints, decomposition."

**Verification independence:** "Walk me through what happens when your CI goes green. What are you actually confident about? What aren't you confident about?"

**Delivery system balance:** "What's your current PR review backlog? How long does the median PR sit before first review? Has that number changed in the last month?"

**Cognitive surrender resistance:** "When was the last time someone on your team pushed back on AI output? What happened? Was it rewarded or penalised?"

**Accountability clarity:** "If I asked your team right now who owns the ship decision, would they all give the same answer?"

### Forward commitment (5 min)

- "Based on what you've learned in the last two weeks, what's the one thing you'd change next?"
- "What would success look like in 30 days?"
- "Do you want another check-in, or do you have enough to run with?"

### Close (3 min)

If relevant, introduce the spec coaching skill: "We're building a tool that coaches your team on specification quality in real time — it runs inside Claude Code and gives feedback as they write specs. Based on what you've told me, [specific connection to their gap]. Would you be interested in trying it?"

If not relevant, close with: "Run the five-dimension audit again in a quarter. The gaps will shift. The point isn't to reach Level 5 — it's to know where you are."

## Data Capture

After each 1:1, record:

| Field | Notes |
|-------|-------|
| Participant name | |
| Organisation | |
| Action committed | Verbatim from their action card |
| Action taken? | Yes / Partial / No |
| Barrier (if not taken) | Priority / Clarity / Permission / Other |
| Dimension of most concern | Which of the five? |
| Key insight | One sentence — what did you learn from this conversation? |
| Spec coaching interest | Yes / Maybe / No |
| Follow-up requested | Yes / No |

## Aggregate Analysis

After all 1:1s are complete:

- **Action completion rate.** What percentage actually did what they committed to? Below 30% = the workshop isn't converting to action. Diagnose the action card design.
- **Barrier distribution.** Are the barriers mostly priority (the workshop isn't creating urgency), clarity (the workshop isn't being specific enough), or permission (the participants aren't senior enough to change process)?
- **Dimension clustering.** Which dimension comes up most? This tells you where to focus content development and tooling. If everyone says "verification independence," that's where the spec coaching skill should launch first.
- **Spec coaching pipeline.** How many expressed interest? This is your early adopter list.

## Follow-Up Email Template

Sent 24 hours after the 1:1:

> Subject: Your post-code readiness action — follow-up
>
> [Name],
>
> Thanks for the conversation yesterday. Here's what I took away:
>
> **Your action:** [what they did or plan to do]
> **The gap you're focused on:** [dimension]
> **Next step:** [what they committed to in the forward commitment]
>
> [If spec coaching interest:] I'll share access to the spec coaching tool when it's ready for beta — I think it addresses the [specific gap] you described.
>
> The five-dimension audit is designed to be run quarterly. If you'd like a facilitated repeat with your team in Q[X], let me know.
>
> Julian

---

# Part 4: Pre-Session Email Template

Send 48 hours before the workshop. Attach or link the pre-read content from workshop-post-code-era.md lines 42–71.

> Subject: Workshop prep — Is Your Team Ready for the Post-Code Era? (10 min read)
>
> [Name / Group],
>
> Looking forward to [date]. Two things to prepare:
>
> **1. Read these two short pieces (10 minutes total).**
>
> [Attach or link the pre-read document — Pre-Read 1: The StrongDM Case, Pre-Read 2: The Delivery Data]
>
> **2. Bring one recent feature your team shipped using AI tools.**
>
> Pick something from the last 2–4 weeks. It doesn't need to be big or impressive. Every exercise in the workshop applies to this specific feature — the more concrete, the more you'll get out of it.
>
> Think about: How was the feature specified? Who wrote the tests? How was it reviewed? Who decided to ship it?
>
> That's it. See you [date/time].
>
> Julian
