#!/usr/bin/env bash
set -euo pipefail

if [ ! -t 0 ] || [ ! -t 1 ]; then
  echo "ERROR: This script must be run interactively from a terminal."
  echo ""
  echo "Production deployments require human confirmation."
  exit 1
fi

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API_DIR="$REPO_ROOT/packages/api"
EVALUATOR_DIR="$REPO_ROOT/packages/evaluator"
WEB_DIR="$REPO_ROOT/packages/web"

echo "=== Deploying to PRODUCTION ==="
echo ""
echo "  Web:       https://app.softwarepilotry.com"
echo "  API:       https://softwarepilots-api.julian-harris.workers.dev"
echo "  Evaluator: https://softwarepilots-evaluator.julian-harris.workers.dev"
echo ""
read -p "Continue with production deployment? (y/N) " confirm
if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
  echo "Aborted."
  exit 0
fi

# 1. Deploy evaluator worker
echo ""
echo "--- Deploying evaluator worker ---"
cd "$EVALUATOR_DIR"
bunx wrangler deploy --env production

# 2. Deploy API worker
echo ""
echo "--- Deploying API worker ---"
cd "$API_DIR"
bunx wrangler deploy --env production

# 3. Build and deploy web app
echo ""
echo "--- Building web app ---"
cd "$WEB_DIR"
bun run build

echo ""
echo "--- Deploying web app (production) ---"
bunx wrangler pages deploy dist --project-name=softwarepilots-web --commit-dirty=true

echo ""
echo "=== Production deployment complete ==="
echo "  Web:       https://app.softwarepilotry.com"
echo "  API:       https://softwarepilots-api.julian-harris.workers.dev"
echo "  Evaluator: https://softwarepilots-evaluator.julian-harris.workers.dev"
