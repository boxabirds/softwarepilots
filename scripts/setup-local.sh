#!/usr/bin/env bash
set -euo pipefail

# Local development setup for Software Pilots platform
# Prerequisites: bun, wrangler (via bun)

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API_DIR="$REPO_ROOT/packages/api"
EVALUATOR_DIR="$REPO_ROOT/packages/evaluator"

echo "=== Software Pilots Local Setup ==="
echo ""

# 1. Check bun is installed
if ! command -v bun &>/dev/null; then
  echo "ERROR: bun is not installed. Install from https://bun.sh"
  exit 1
fi
echo "[ok] bun found: $(bun --version)"

# 2. Install dependencies
echo ""
echo "--- Installing dependencies ---"
cd "$REPO_ROOT"
bun install

# 3. Check wrangler auth
echo ""
echo "--- Checking Cloudflare auth ---"
if ! bunx wrangler whoami 2>/dev/null | grep -q "Account ID"; then
  echo "WARNING: Not logged into Cloudflare."
  echo "  Run: bunx wrangler login"
  echo ""
else
  echo "[ok] Authenticated with Cloudflare"
fi

# 4. Check API .dev.vars
echo ""
echo "--- Checking API secrets ---"
if [ ! -f "$API_DIR/.dev.vars" ]; then
  echo "ERROR: $API_DIR/.dev.vars not found."
  echo ""
  echo "  1. Create a GitHub OAuth App at: https://github.com/settings/applications/new"
  echo "     - Homepage URL: http://localhost:3000"
  echo "     - Callback URL: http://localhost:3000/api/auth/callback"
  echo ""
  echo "  2. Copy the example file and fill in values:"
  echo "     cp $API_DIR/.dev.vars.example $API_DIR/.dev.vars"
  echo ""
  exit 1
fi

MISSING_VARS=0
for var in GITHUB_CLIENT_ID GITHUB_CLIENT_SECRET JWT_SECRET; do
  val=$(grep "^${var}=" "$API_DIR/.dev.vars" 2>/dev/null | cut -d'=' -f2-)
  if [ -z "$val" ]; then
    echo "ERROR: $var is empty in $API_DIR/.dev.vars"
    MISSING_VARS=1
  fi
done
if [ "$MISSING_VARS" -eq 1 ]; then
  exit 1
fi
echo "[ok] API secrets configured"

# 5. Check evaluator .dev.vars
echo ""
echo "--- Checking evaluator secrets ---"
if [ ! -f "$EVALUATOR_DIR/.dev.vars" ]; then
  echo "ERROR: $EVALUATOR_DIR/.dev.vars not found."
  echo ""
  echo "  1. Get a Gemini API key at: https://aistudio.google.com/apikey"
  echo ""
  echo "  2. Copy the example file and fill in values:"
  echo "     cp $EVALUATOR_DIR/.dev.vars.example $EVALUATOR_DIR/.dev.vars"
  echo ""
  exit 1
fi

val=$(grep "^GEMINI_API_KEY=" "$EVALUATOR_DIR/.dev.vars" 2>/dev/null | cut -d'=' -f2-)
if [ -z "$val" ]; then
  echo "ERROR: GEMINI_API_KEY is empty in $EVALUATOR_DIR/.dev.vars"
  exit 1
fi
echo "[ok] Evaluator secrets configured"

# 6. Apply D1 migrations locally (shared state directory)
echo ""
echo "--- Applying D1 migrations ---"
cd "$API_DIR"
bunx wrangler d1 migrations apply DB --local --persist-to ../../.wrangler/state
echo "[ok] Database migrated (shared state)"

echo ""
echo "=== Setup complete ==="
echo ""
echo "Start the platform:"
echo "  cd $REPO_ROOT"
echo "  bun run dev:platform"
echo ""
echo "Then open: http://localhost:3000"
echo ""
echo "Services:"
echo "  Web frontend:  http://localhost:3000"
echo "  API worker:    http://localhost:8787"
echo "  Evaluator:     http://localhost:8788"
