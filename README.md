# Software Pilots

Agent-tutored Socratic learning platform for software practitioners. Learners are guided through curriculum tracks by an AI tutor that probes understanding through questions, scenarios, and direct instruction - never lecturing unless the learner is stuck.

Built on Cloudflare Workers, D1, Pages, and Gemini.

## Architecture

```
packages/
  web/        React + Vite frontend (Cloudflare Pages)
  api/        Hono API worker (Cloudflare Workers + D1)
  evaluator/  Code evaluation worker (Cloudflare Workers)
  shared/     Shared types, curriculum data, learning maps
```

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

### Staging

```bash
bash scripts/deploy-staging.sh
```

Deploys to:
- Web: https://softwarepilots-web-staging.pages.dev
- API: https://softwarepilots-api-staging.julian-harris.workers.dev

### Production

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

## Curriculum Tracks

| Track | Audience |
|-------|----------|
| Level 1 | New graduates with CS foundations but limited production experience |
| Level 10 | Veterans with deep production experience transitioning to AI oversight |
| Level 20 | Senior leaders responsible for organisational AI adoption |

Each track has tailored modules, tutor guidance, and simulation scenarios.

## Project Structure

```
scripts/
  setup-local.sh          Local dev setup
  deploy-staging.sh       Deploy to staging
  deploy-production.sh    Deploy to production
  seed-curriculum.ts      Seed curriculum data into D1
  seed-prompts.ts         Seed tutor prompts into D1
  change-prompt.sh        Update a prompt in D1
  copy-prompts-to-prod.sh Copy prompts staging -> production
  generate-learning-maps.ts  Generate learning maps from curriculum
  start-fake-github.ts    Local OAuth mock server

packages/web/
  src/pages/              Page components (Dashboard, SocraticSession, etc.)
  src/components/         Shared UI components
  src/hooks/              Custom React hooks
  functions/api/          Cloudflare Pages Function (API proxy)

packages/api/
  src/routes/             API route handlers
  src/middleware/          Session validation
  src/db/migrations/      D1 schema migrations
  src/lib/                Shared utilities (Gemini, curriculum store, etc.)

packages/shared/
  src/curricula/          Curriculum content per track
  src/simulation/         Simulation scenario definitions
```

## Commit Conventions

Every commit should reference its Ceetrix story:

```bash
git notes --ref=stories add -m "stories: 72" HEAD
git push origin refs/notes/stories
```

The post-commit hook reminds you if a tag is missing.
