# Plan: Prompt Management for Software Pilots

> **Note:** Story numbers (43-46) were provisional at time of writing. If other stories have been created since 2026-03-22, re-number these accordingly and verify no conflicts with existing Ceetrix story IDs before creating.

## Context

The Software Pilots platform has 7 LLM-facing prompts scattered across 5 files. When tutor behavior needs tuning (e.g. "always acknowledge the learner's previous message"), it requires a code change and redeploy. Prompt management externalizes the editable text segments to D1 so they can be iterated on via the admin UI without deploys.

The prompt-manager at `/Users/julian/expts/prompt-manager` provides reference patterns (versioned storage, hierarchical key resolution, admin CRUD) but won't be used as a dependency - its patterns will be adapted directly into the monorepo.

## Key Design Decision: Template Segments, Not Whole Prompts

Software Pilots' prompts are compositional - assembled from 10+ pieces with runtime data. We externalize the **editable text segments** and keep the composition logic in code. Tool definitions (JSON schemas) stay in code because they're tightly coupled to the response parser.

## Prompt Inventory: What to Externalize

| Key | Source File | Description |
|-----|-----------|-------------|
| `socratic.rules` | `socratic-chat.ts:358-376` | Behavioral rules block (15+ rules, most frequently edited) |
| `socratic.persona` | `socratic-chat.ts:346` | Opening role declaration |
| `exercise.role` | `chat.ts:252-258` | Exercise tutor role bullets |
| `exercise.tool_instruction` | `chat.ts:298-300` | "You MUST call..." instruction |
| `evaluator.system` | `evaluator/.../prompt-builder.ts:39-61` | Scoring instructions + JSON schema |
| `narrative.instructions` | `narrative.ts:43-46` | Progress narrative generation instructions |
| `summarization.instructions` | `context-assembly.ts:122-130` | Conversation compression prompt |
| `tutor_guidance.level-0` | `shared/.../level-0.ts` | Profile-specific pedagogical strategy |
| `tutor_guidance.level-1` | `shared/.../new-grad.ts` | " |
| `tutor_guidance.level-10` | `shared/.../veteran.ts` | " |
| `tutor_guidance.level-20` | `shared/.../senior-leader.ts` | " |

**Keep in code:** Tool definitions, dynamic context assembly, section concepts injection, code diffs.

## Template Variables

Externalized prompts use `{{variable}}` placeholders resolved at runtime. Example:

```
You are a Socratic tutor for "{{section_title}}" in the {{profile}} software pilotry curriculum.
```

A simple `resolveTemplate(template, vars)` function handles substitution. No template engine needed.

## Implementation

### Phase 1: Infrastructure

**Migration `0008_prompts.sql`** - Add to existing `softwarepilots-db`:
- `prompts` table: id, key, content, version, deleted, created_at, created_by, reason
- Unique constraint on (key, version)

**New files in `packages/api/src/lib/prompts/`:**
- `core.ts` - `getPrompt()`, `savePrompt()`, `listPrompts()`, `getPromptHistory()` (adapted from prompt-manager patterns)
- `defaults.ts` - Current prompt text registered as hardcoded fallbacks
- `resolve.ts` - `resolveTemplate()` with `{{key}}` substitution
- `types.ts` - Prompt, GetPromptResult, SaveOptions

**Admin API** - Add to `packages/api/src/routes/admin.ts` (inherits bearer auth):
- `GET /api/admin/prompts` - list all
- `GET /api/admin/prompts/:key` - get by key (`?history=true`)
- `POST /api/admin/prompts` - create
- `PUT /api/admin/prompts/:key` - update (creates new version)

**Admin UI** - New "Prompts" tab in `packages/web/src/pages/Admin.tsx`:
- Prompt list with key, content preview, version, last updated
- Prompt detail: edit content, version history, required "reason" field
- Display expected `{{variables}}` for each prompt key
- Uses existing `adminFetch` helper

### Phase 2: Wire Up Builders

Modify each builder function to accept prompt text as parameters instead of hardcoding. At each call site, fetch from `getPrompt()` which falls back to `defaults.ts`. No behavior change - assembled prompts identical to current output.

- `buildSocraticSystemPrompt()` - Accept `persona` and `rules` params
- `buildTutorSystemPrompt()` - Accept `role` and `toolInstruction` params
- `buildEvaluationPrompt()` - Accept `systemTemplate` param
- `buildNarrativePrompt()` - Accept `instructions` param
- `compressConversation()` - Accept `summarizationPrompt` param

All prompt fetches happen via `Promise.all` before the builder call - no latency penalty.

### Phase 3: Seed and Go Live

Seed D1 with current prompt text. Now edits via admin UI take effect without deploys.

## Files to Create/Modify

| File | Action |
|------|--------|
| `packages/api/src/db/migrations/0008_prompts.sql` | New migration |
| `packages/api/src/lib/prompts/core.ts` | New - CRUD functions |
| `packages/api/src/lib/prompts/defaults.ts` | New - hardcoded fallbacks |
| `packages/api/src/lib/prompts/resolve.ts` | New - template resolution |
| `packages/api/src/lib/prompts/types.ts` | New - types |
| `packages/api/src/routes/admin.ts` | Add prompt CRUD endpoints |
| `packages/web/src/pages/Admin.tsx` | Add Prompts tab |
| `packages/api/src/routes/socratic-chat.ts` | Accept externalized text params |
| `packages/api/src/routes/chat.ts` | Accept externalized text params |
| `packages/api/src/lib/narrative.ts` | Accept externalized text params |
| `packages/api/src/lib/context-assembly.ts` | Accept externalized text params |
| `packages/evaluator/src/scoring/prompt-builder.ts` | Accept externalized text params |

## Stories (grouped by epic)

### Epic: Prompt Management

#### Story 43: Administrators can view and edit prompts without code deploys

The core value delivery - versioned prompt storage, CRUD API, and admin UI tab.

- Migration `0008_prompts.sql`
- Prompt library (`packages/api/src/lib/prompts/` - core, defaults, resolve, types)
- Admin API endpoints (GET/POST/PUT under `/api/admin/prompts`, inherits bearer auth)
- Admin UI "Prompts" tab: list, edit with version history, reason field, `{{variable}}` display
- Integration tests for prompt CRUD + versioning + hierarchical key resolution
- E2E tests for admin prompts tab

#### Story 44: Socratic tutor uses externalized prompts that can be tuned at runtime

Wire the Socratic tutor to fetch `socratic.persona` and `socratic.rules` from D1. Hardcoded defaults ensure zero behavior change until an admin edits a prompt.

- Extract current persona + rules text into `defaults.ts`
- Modify `buildSocraticSystemPrompt()` to accept text params
- Fetch prompts via `getPrompt()` at request time (with `Promise.all`)
- `resolveTemplate()` for `{{section_title}}`, `{{profile}}` etc.
- Integration tests: assembled prompt identical to current output with defaults, different when overridden

#### Story 45: Exercise tutor and evaluator use externalized prompts

Same pattern for the remaining prompt surfaces.

- Exercise tutor: `exercise.role`, `exercise.tool_instruction`
- Evaluator: `evaluator.system`
- Narrative: `narrative.instructions`
- Conversation compression: `summarization.instructions`
- Extract defaults, modify builders, fetch at request time
- Integration tests per builder

#### Story 46: Tutor guidance per profile is editable without curriculum code changes

Externalize the 4 `tutor_guidance` strings from shared curricula to D1.

- Keys: `tutor_guidance.level-0`, `.level-1`, `.level-10`, `.level-20`
- Extract current text into `defaults.ts`
- Modify `buildSocraticSystemPrompt()` to use resolved tutor guidance
- Socratic chat handler fetches alongside other prompts
- Integration tests

### Execution order

43 -> 44 -> 45 (can parallel with 44 after 43 is done) -> 46

Story 43 is the foundation. Stories 44-46 are the progressive wiring - each independently deployable and testable. 44 and 45 can run in parallel since they touch different builder functions.

## Verification

1. With empty prompts table: system behaves identically (defaults used)
2. Edit `socratic.rules` via admin UI -> tutor behavior changes without deploy
3. Version history shows all prior versions with reasons
4. Rolling back (saving a prior version's content) works
5. `bun test` passes across all packages
6. Template variables resolve correctly (no `{{unresolved}}` in output)
