# Software Pilots

This repo contains three projects:

1. **Marketing manifesto** (`src/`) - The static site at [softwarepilotry.com](https://softwarepilotry.com) explaining why software pilotry matters
2. **Tutor platform** (`packages/`) - The Socratic learning app at [app.softwarepilotry.com](https://app.softwarepilotry.com) with three active tracks (Level 1, 10, 20)
3. **Dormant tutor** - Level 0 track (complete beginner) exists in the codebase but is hidden from the UI, not ready for release

Built on Cloudflare Workers, D1, Pages, and Gemini.

## How the Tutor Teaches

The tutor uses a Socratic method powered by Gemini's function-calling. Rather than lecturing, it selects from a set of tools based on the learner's input:

| Tool | When it fires | What the learner sees |
|------|--------------|----------------------|
| `socratic_probe` | Default - asks probing questions to deepen understanding | A question that makes them think |
| `evaluate_response` | Learner provides an answer | Feedback on what they got right/wrong, then a follow-up question |
| `present_scenario` | Concept needs a concrete example | A realistic scenario with a question about it |
| `surface_key_insight` | Learner is approaching the section's core idea | A bridging question toward the key intuition |
| `provide_instruction` | Learner asks a factual question, or Socratic questioning has failed after multiple attempts | Direct explanation (amber info card) with what/why/example, followed by a comprehension question |
| `off_topic_detected` | Learner goes off-topic | Gentle redirect back to the section |
| `session_pause` | Learner shows fatigue or asks for a break | Warm acknowledgment with option to resume later |
| `session_complete` | All key claims demonstrated | Summary of what was covered, celebration card |

Gemini chooses the tool; it can also call multiple tools per turn (e.g. `evaluate_response` + `track_concepts` to both respond and record progress).

### Versioned Prompts

All tutor behaviour is controlled by prompts stored in D1 with version history. The key prompts:

- `socratic.persona` - who the tutor is
- `socratic.rules` - when to use each tool, response length limits, scenario consistency rules, "every response must end with a question"
- `tutor_guidance.level-{N}` - per-track coaching (e.g. Level 1 focuses on calibration, Level 20 on organisational patience)

Prompts can be updated without code deploys via `scripts/change-prompt.sh`. Each update creates a new version; old versions are soft-deleted. Changes flow through staging first, then `scripts/copy-prompts-to-prod.sh` promotes to production with a diff review.

### Progress Tracking

Each section has a **learning map** with core claims (e.g. "Can explain why connection pooling prevents resource exhaustion"). The tutor tracks which claims the learner has demonstrated during conversation using the `claim_assessment` side-effect tool. Progress is:

- **Per-section**: accumulated across all sessions for that section
- **Never regresses**: claim levels only upgrade, never downgrade (except via spaced repetition decay)
- **Completion gate**: 70% of core claims at "developing" or higher triggers section completion
- **Spaced repetition**: completed sections decay over time; overdue concepts trigger review sessions

## Architecture

```
src/                Static marketing site (softwarepilotry.com)

packages/
  web/              React + Vite frontend (Cloudflare Pages)
  api/              Hono API worker (Cloudflare Workers + D1)
  evaluator/        Code evaluation worker (Cloudflare Workers)
  shared/           Shared types, curriculum data, learning maps
```

## Curriculum Tracks

| Track | Audience | Status |
|-------|----------|--------|
| Level 0 | Complete beginners, no programming experience | Dormant (hidden from UI) |
| Level 1 | New graduates with CS foundations but limited production experience | Active |
| Level 10 | Veterans with deep production experience transitioning to AI oversight | Active |
| Level 20 | Senior leaders responsible for organisational AI adoption | Active |

Each track has tailored modules, tutor guidance prompts, and simulation scenarios. The first three modules differ per track; the last three (Before You Specify, Verification Checklists, Simulation Readiness) are shared.

## Prerequisites

- [Bun](https://bun.sh) (v1.2+) - the only package manager. Never use npm/yarn/pnpm.
- [Wrangler](https://developers.cloudflare.com/workers/wrangler/) - installed automatically via bun
- A GitHub OAuth App for authentication
- A Gemini API key for the tutor

## Quick Start

```bash
# 1. Clone and install
git clone git@github.com:boxabirds/softwarepilots.git
cd softwarepilots
bun install

# 2. Enable git hooks
git config core.hooksPath scripts/hooks

# 3. Run automated setup (checks deps, applies migrations)
bun run setup

# 4. Start all services
bun run dev:platform
```

This starts:
- **Web**: http://localhost:3000
- **API**: http://localhost:8790
- **Evaluator**: http://localhost:8791

## Environment Variables

### API (`packages/api/.dev.vars`)

```
GITHUB_CLIENT_ID=<from GitHub OAuth App>
GITHUB_CLIENT_SECRET=<from GitHub OAuth App>
JWT_SECRET=<random string, 32+ chars>
```

Create a GitHub OAuth App at https://github.com/settings/applications/new:
- Homepage URL: `http://localhost:3000`
- Callback URL: `http://localhost:3000/api/auth/callback`

For local dev without a real GitHub app, use the fake OAuth server:

```
GITHUB_BASE_URL=http://localhost:9999
GITHUB_API_BASE_URL=http://localhost:9999
```

Then run `bun run scripts/start-fake-github.ts` in a separate terminal. It auto-approves login as `local-dev-pilot`.

### Evaluator (`packages/evaluator/.dev.vars`)

```
GEMINI_API_KEY=<from https://aistudio.google.com/apikey>
```

## Database

D1 (SQLite) via Cloudflare. Migrations live in `packages/api/src/db/migrations/`.

```bash
# Apply migrations locally (done automatically by setup)
cd packages/api && bunx wrangler d1 migrations apply softwarepilots-db --local

# Seed curriculum data
bun run scripts/seed-curriculum.ts --apply

# Seed prompts
bun run scripts/seed-prompts.ts --apply
```

For remote environments:

```bash
# Staging
bun run scripts/seed-curriculum.ts --apply --env staging
bun run scripts/seed-prompts.ts --apply --env staging

# Production
bun run scripts/seed-curriculum.ts --apply --env production
bun run scripts/seed-prompts.ts --apply --env production
```

## Development Commands

| Command | What it does |
|---------|-------------|
| `bun run dev:platform` | Start all services (web + api + evaluator) |
| `bun run web:dev` | Start web frontend only |
| `bun run api:dev` | Start API worker only |
| `bun run evaluator:dev` | Start evaluator worker only |
| `bun run test` | Run all tests |
| `bun run typecheck` | TypeScript check across all packages |

## Testing

```bash
# All tests
bun run test

# Web package only
cd packages/web && bunx vitest run

# API package only
cd packages/api && bun test

# Specific test file
cd packages/web && bunx vitest run src/__tests__/SocraticSession.test.tsx
```

## Deployment

Deploy scripts run migrations automatically before deploying workers.

### Marketing site

```bash
bun run site:deploy
```

Deploys to https://softwarepilotry.com

### App - Staging

```bash
bash scripts/deploy-staging.sh
```

Deploys to:
- Web: https://softwarepilots-web-staging.pages.dev
- API: https://softwarepilots-api-staging.julian-harris.workers.dev

### App - Production

```bash
bash scripts/deploy-production.sh
```

Requires interactive terminal (confirmation prompt). Deploys to:
- Web: https://app.softwarepilotry.com
- API: https://softwarepilots-api.julian-harris.workers.dev

### Prompt Management

Prompts are stored in D1 with versioning. To update a prompt:

```bash
# Update in staging
./scripts/change-prompt.sh --key "socratic.rules" --file content.txt --reason "Why"

# Copy from staging to production (interactive, shows diff)
./scripts/copy-prompts-to-prod.sh socratic.rules
```

## Project Structure

```
src/
  index.html              Marketing manifesto site
  styles/                 Marketing site CSS

scripts/
  setup-local.sh          Local dev setup
  deploy-staging.sh       Deploy app to staging
  deploy-production.sh    Deploy app to production
  seed-curriculum.ts      Seed curriculum data into D1
  seed-prompts.ts         Seed tutor prompts into D1
  change-prompt.sh        Update a prompt in D1
  copy-prompts-to-prod.sh Copy prompts staging -> production
  generate-learning-maps.ts  Generate learning maps from curriculum
  start-fake-github.ts    Local OAuth mock server

packages/web/
  src/pages/              Page components (Dashboard, SocraticSession, etc.)
  src/components/         Shared UI components
  src/hooks/              Custom React hooks (useChatScroll, useTopicCoverage, etc.)
  functions/api/          Cloudflare Pages Function (API proxy)

packages/api/
  src/routes/             API route handlers (socratic-chat, curriculum, auth, etc.)
  src/middleware/          Session validation (JWT cookie)
  src/db/migrations/      D1 schema migrations
  src/lib/                Gemini client, curriculum store, prompt resolution

packages/shared/
  src/curricula/          Curriculum content per track (level-0, new-grad, veteran, senior-leader)
  src/curricula/learning-maps/  Claim-based learning maps per section
  src/simulation/         Simulation scenario definitions
```

## Commit Conventions

Every commit should reference its Ceetrix story:

```bash
git notes --ref=stories add -m "stories: 72" HEAD
git push origin refs/notes/stories
```

The post-commit hook reminds you if a tag is missing.

## Links

- [Manifesto](https://softwarepilotry.com)
- [App](https://app.softwarepilotry.com)
- [Discord](https://discord.gg/3VayBR5mFQ)
