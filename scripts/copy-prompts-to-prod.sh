#!/bin/bash
#
# Copy one or more prompts from staging to production.
#
# This script:
# 1. Reads the latest version of each prompt from staging
# 2. Shows a diff for each key and asks for confirmation
# 3. Inserts confirmed prompts into production
# 4. Marks previous production versions as deleted
#
# Usage:
#   ./scripts/copy-prompts-to-prod.sh <key> [key2] [key3] ...
#   ./scripts/copy-prompts-to-prod.sh socratic.rules
#   ./scripts/copy-prompts-to-prod.sh socratic.rules socratic.persona review.persona
#
# Safety:
#   - Requires interactive terminal (blocks automated execution)
#   - Requires explicit confirmation before writing each key to production
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$REPO_ROOT/packages/api"

STAGING_DB="softwarepilots-db-staging"
PROD_DB="softwarepilots-db"

# Require interactive terminal
if [ ! -t 0 ] || [ ! -t 1 ]; then
  echo "ERROR: This script must be run interactively from a terminal."
  echo ""
  echo "This safety measure prevents automated scripts from modifying production prompts."
  echo "Run this command directly in your terminal, not from a script or CI."
  exit 1
fi

# Parse flags
AUTO_CONFIRM=false
KEYS=()
for arg in "$@"; do
  case "$arg" in
    -y) AUTO_CONFIRM=true ;;
    *)  KEYS+=("$arg") ;;
  esac
done

# Validate arguments
if [[ ${#KEYS[@]} -lt 1 ]]; then
  echo "Usage: $0 [-y] <prompt-key> [prompt-key2] [prompt-key3] ..."
  echo ""
  echo "Options:"
  echo "  -y    Auto-confirm all prompts (skip interactive confirmation)"
  echo ""
  echo "Examples:"
  echo "  $0 socratic.rules"
  echo "  $0 -y socratic.rules socratic.persona review.persona"
  exit 1
fi

TOTAL=${#KEYS[@]}
COPIED=0
SKIPPED=0
FAILED=0

echo "Copying $TOTAL prompt(s) from staging to production..."
echo ""

for KEY in "${KEYS[@]}"; do
  echo "================================================================"
  echo "  Key: $KEY  ($((COPIED + SKIPPED + FAILED + 1)) of $TOTAL)"
  echo "================================================================"
  echo ""

  echo "Reading from staging..."

  # Single query for staging - get everything we need
  STAGING_JSON=$(bunx wrangler d1 execute "$STAGING_DB" --env staging --remote --json \
    --command "SELECT content, reason, version FROM prompts WHERE key = '$KEY' AND deleted = 0 ORDER BY version DESC LIMIT 1" 2>/dev/null \
    | jq -r '.[].results[0] // empty' 2>/dev/null || echo "")

  if [[ -z "$STAGING_JSON" || "$STAGING_JSON" == "null" ]]; then
    echo "  SKIP: Prompt '$KEY' not found in staging"
    echo ""
    SKIPPED=$((SKIPPED + 1))
    continue
  fi

  STAGING_CONTENT=$(echo "$STAGING_JSON" | jq -r '.content')
  STAGING_VERSION=$(echo "$STAGING_JSON" | jq -r '.version')
  STAGING_REASON=$(echo "$STAGING_JSON" | jq -r '.reason // empty')

  echo "  Found: version=$STAGING_VERSION, ${#STAGING_CONTENT} chars"

  # Single query for production - get everything we need
  echo "Checking production..."
  PROD_JSON=$(bunx wrangler d1 execute "$PROD_DB" --env production --remote --json \
    --command "SELECT content, version FROM prompts WHERE key = '$KEY' AND deleted = 0 ORDER BY version DESC LIMIT 1" 2>/dev/null \
    | jq -r '.[].results[0] // empty' 2>/dev/null || echo "")

  if [[ -n "$PROD_JSON" && "$PROD_JSON" != "null" ]]; then
    PROD_CONTENT=$(echo "$PROD_JSON" | jq -r '.content')
    PROD_VERSION=$(echo "$PROD_JSON" | jq -r '.version')
    echo "  Current: version=$PROD_VERSION, ${#PROD_CONTENT} chars"

    # Check if content is identical
    if [[ "$STAGING_CONTENT" == "$PROD_CONTENT" ]]; then
      echo "  SKIP: Content is identical (staging == production)"
      echo ""
      SKIPPED=$((SKIPPED + 1))
      continue
    fi
  else
    PROD_CONTENT="(none)"
    PROD_VERSION=""
    echo "  No existing prompt in production"
  fi

  # Show diff
  echo ""
  echo "-- CURRENT (production) --"
  echo "$PROD_CONTENT"
  echo "--------------------------"
  echo ""
  echo "-- NEW (from staging v$STAGING_VERSION) --"
  echo "$STAGING_CONTENT"
  echo "--------------------------"
  echo ""
  if [[ -n "$STAGING_REASON" ]]; then
    echo "-- REASON FOR CHANGE --"
    echo "$STAGING_REASON"
    echo "-----------------------"
    echo ""
  fi

  if [[ "$AUTO_CONFIRM" == "true" ]]; then
    echo "Auto-confirming (-y)..."
  else
    read -p "Copy '$KEY' to production? [Y/n] " CONFIRM
    if [[ "$CONFIRM" =~ ^[Nn] ]]; then
      echo "  Skipped."
      echo ""
      SKIPPED=$((SKIPPED + 1))
      continue
    fi
  fi

  # Create temp files
  SQL_FILE=$(mktemp)
  CONTENT_FILE=$(mktemp)
  REASON_FILE=$(mktemp)
  trap "rm -f $SQL_FILE $CONTENT_FILE $REASON_FILE" EXIT

  # Write content and reason to temp files
  printf '%s' "$STAGING_CONTENT" > "$CONTENT_FILE"
  printf '%s' "$STAGING_REASON" > "$REASON_FILE"

  # Escape for SQL
  ESCAPED_CONTENT=$(sed "s/'/''/g" "$CONTENT_FILE")
  ESCAPED_REASON=$(sed "s/'/''/g" "$REASON_FILE")

  # Build reason SQL
  if [[ -n "$STAGING_REASON" ]]; then
    REASON_SQL="'$ESCAPED_REASON'"
  else
    REASON_SQL="NULL"
  fi

  # Insert into production
  echo "  Copying..."

  printf "INSERT INTO prompts (key, content, version, created_by, reason)
SELECT '%s',
  '%s',
  COALESCE((SELECT MAX(version) + 1 FROM prompts WHERE key = '%s'), 1),
  'copy-from-staging',
  %s;
" "$KEY" "$ESCAPED_CONTENT" "$KEY" "$REASON_SQL" > "$SQL_FILE"

  INSERT_OUTPUT=$(bunx wrangler d1 execute "$PROD_DB" --env production --remote \
    --file "$SQL_FILE" 2>&1)

  if ! echo "$INSERT_OUTPUT" | grep -q "success.*true"; then
    echo ""
    echo "  ERROR: Failed to insert '$KEY' into production"
    echo "  Wrangler output: $(echo "$INSERT_OUTPUT" | head -3)"
    echo ""
    FAILED=$((FAILED + 1))
    continue
  fi

  # Mark old versions as deleted
  printf "UPDATE prompts SET deleted = 1
WHERE key = '%s'
  AND deleted = 0
  AND version < (SELECT MAX(version) FROM prompts WHERE key = '%s');
" "$KEY" "$KEY" > "$SQL_FILE"

  UPDATE_OUTPUT=$(bunx wrangler d1 execute "$PROD_DB" --env production --remote \
    --file "$SQL_FILE" 2>&1)

  if ! echo "$UPDATE_OUTPUT" | grep -q "success"; then
    echo "  WARNING: New version inserted but old versions may not be marked deleted"
    echo ""
    FAILED=$((FAILED + 1))
    continue
  fi

  # Verify
  RESULT=$(bunx wrangler d1 execute "$PROD_DB" --env production --remote --json \
    --command "SELECT version, LENGTH(content) as content_length FROM prompts WHERE key = '$KEY' AND deleted = 0 ORDER BY version DESC LIMIT 1" 2>/dev/null \
    | jq -r '.[].results[0]' 2>/dev/null)

  NEW_VERSION=$(echo "$RESULT" | jq -r '.version')
  NEW_LENGTH=$(echo "$RESULT" | jq -r '.content_length')

  echo "  Done: Copied '$KEY' to production v$NEW_VERSION ($NEW_LENGTH chars)"
  echo ""
  COPIED=$((COPIED + 1))
done

# Summary
echo "================================================================"
echo "  Summary: $COPIED copied, $SKIPPED skipped, $FAILED failed (of $TOTAL)"
echo "================================================================"
