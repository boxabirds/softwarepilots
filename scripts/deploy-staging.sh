#!/usr/bin/env bash
set -euo pipefail

# Deploy all services to staging
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API_DIR="$REPO_ROOT/packages/api"
EVALUATOR_DIR="$REPO_ROOT/packages/evaluator"
WEB_DIR="$REPO_ROOT/packages/web"

echo "=== Deploying to STAGING ==="

# 1. Deploy evaluator worker
echo ""
echo "--- Deploying evaluator worker ---"
cd "$EVALUATOR_DIR"
bunx wrangler deploy --env staging

# 2. Apply DB migrations
echo ""
echo "--- Applying D1 migrations (staging) ---"
cd "$API_DIR"
bunx wrangler d1 migrations apply softwarepilots-db-staging --env staging --remote

# 3. Deploy API worker
echo ""
echo "--- Deploying API worker ---"
bunx wrangler deploy --env staging

# 4. Build and deploy web app
echo ""
echo "--- Building web app ---"
cd "$WEB_DIR"
bun run build

echo ""
echo "--- Deploying web app (staging) ---"
cp wrangler.toml wrangler.bak
cp wrangler.staging.toml wrangler.toml
bunx wrangler pages deploy dist --project-name=softwarepilots-web-staging --commit-dirty=true
cp wrangler.bak wrangler.toml
rm wrangler.bak

echo ""
echo "=== Staging deployment complete ==="
echo "  Web:       https://softwarepilots-web-staging.pages.dev"
echo "  API:       https://softwarepilots-api-staging.julian-harris.workers.dev"
echo "  Evaluator: https://softwarepilots-evaluator-staging.julian-harris.workers.dev"
