#!/bin/bash
#
# Update a prompt in the D1 database.
#
# This script:
# 1. Inserts a new version of the prompt
# 2. Marks the previous version as deleted
# 3. Uses savePrompt() semantics (version history preserved)
#
# Usage:
#   ./scripts/change-prompt.sh --key "socratic.rules" --value "New content"
#   ./scripts/change-prompt.sh --key "socratic.persona" --file prompts/persona.txt
#   ./scripts/change-prompt.sh --key "socratic.rules" --file content.txt --production
#
# Environments:
#   Default: staging (softwarepilots-db-staging)
#   --production: production (softwarepilots-db) - requires interactive terminal
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$REPO_ROOT/packages/api"

# Defaults
ENV="staging"
DB_NAME="softwarepilots-db-staging"
KEY=""
VALUE=""
FILE=""
CREATED_BY=""
REASON=""
REASON_FILE=""

# Parse arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    --key)
      KEY="$2"
      shift 2
      ;;
    --value)
      VALUE="$2"
      shift 2
      ;;
    --file)
      FILE="$2"
      shift 2
      ;;
    --created-by)
      CREATED_BY="$2"
      shift 2
      ;;
    --reason)
      REASON="$2"
      shift 2
      ;;
    --reason-file)
      REASON_FILE="$2"
      shift 2
      ;;
    --production)
      ENV="production"
      DB_NAME="softwarepilots-db"
      shift
      ;;
    --help|-h)
      echo "Usage: $0 --key <key> [--value <content> | --file <path>] [options]"
      echo ""
      echo "Options:"
      echo "  --key          Prompt key (e.g., 'socratic.rules')"
      echo "  --value        Prompt content as string"
      echo "  --file         Read prompt content from file"
      echo "  --reason       Why this change is being made (supports markdown)"
      echo "  --reason-file  Read reason from file (for long explanations)"
      echo "  --created-by   Audit reference (e.g., 'story-69')"
      echo "  --production   Target production database (requires interactive terminal)"
      echo ""
      echo "Examples:"
      echo "  $0 --key 'socratic.rules' --file /tmp/rules.txt"
      echo "  $0 --key 'socratic.rules' --file content.txt --reason 'Widen provide_instruction trigger'"
      echo "  $0 --key 'socratic.rules' --file content.txt --reason-file /tmp/reason.md --production"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

# Validate required arguments
if [[ -z "$KEY" ]]; then
  echo "ERROR: --key is required"
  exit 1
fi

if [[ -z "$VALUE" && -z "$FILE" ]]; then
  echo "ERROR: Either --value or --file is required"
  exit 1
fi

if [[ -n "$VALUE" && -n "$FILE" ]]; then
  echo "ERROR: Cannot specify both --value and --file"
  exit 1
fi

# Read value from file if specified
if [[ -n "$FILE" ]]; then
  if [[ ! -f "$FILE" ]]; then
    echo "ERROR: File not found: $FILE"
    exit 1
  fi
  VALUE=$(cat "$FILE")
fi

# Validate reason arguments
if [[ -n "$REASON" && -n "$REASON_FILE" ]]; then
  echo "ERROR: Cannot specify both --reason and --reason-file"
  exit 1
fi

# Read reason from file if specified
if [[ -n "$REASON_FILE" ]]; then
  if [[ ! -f "$REASON_FILE" ]]; then
    echo "ERROR: Reason file not found: $REASON_FILE"
    exit 1
  fi
  REASON=$(cat "$REASON_FILE")
fi

# Production safety: require interactive terminal
if [[ "$ENV" == "production" ]]; then
  if [ ! -t 0 ] || [ ! -t 1 ]; then
    echo "ERROR: Production changes must be run interactively from a terminal."
    echo ""
    echo "This safety measure prevents automated scripts from modifying production prompts."
    echo "Run this command directly in your terminal, not from a script or CI."
    exit 1
  fi

  echo "WARNING: PRODUCTION PROMPT CHANGE"
  echo ""
  echo "Key: $KEY"
  echo "Content preview (first 200 chars):"
  echo "${VALUE:0:200}..."
  echo ""
  read -p "Type 'yes' to confirm production change: " CONFIRM
  if [[ "$CONFIRM" != "yes" ]]; then
    echo "Aborted."
    exit 0
  fi
fi

# Get current version info
echo "Checking current prompt state..."
CURRENT=$(bunx wrangler d1 execute "$DB_NAME" --env "$ENV" --remote --json \
  --command "SELECT version, LENGTH(content) as content_length FROM prompts WHERE key = '$KEY' AND deleted = 0 ORDER BY version DESC LIMIT 1" 2>/dev/null \
  | jq -r '.[].results[0] // empty' 2>/dev/null || echo "")

if [[ -n "$CURRENT" ]]; then
  CURRENT_VERSION=$(echo "$CURRENT" | jq -r '.version')
  CURRENT_LENGTH=$(echo "$CURRENT" | jq -r '.content_length')
  echo "  Current: version=$CURRENT_VERSION, content_length=$CURRENT_LENGTH"

  # Fetch current content and compare to new content
  CURRENT_CONTENT=$(bunx wrangler d1 execute "$DB_NAME" --env "$ENV" --remote --json \
    --command "SELECT content FROM prompts WHERE key = '$KEY' AND deleted = 0 ORDER BY version DESC LIMIT 1" 2>/dev/null \
    | jq -r '.[].results[0].content // empty' 2>/dev/null || echo "")

  if [[ "$CURRENT_CONTENT" == "$VALUE" ]]; then
    echo ""
    echo "ERROR: New content is identical to current version (v$CURRENT_VERSION)."
    echo "No update needed."
    exit 0
  fi
else
  echo "  No existing prompt found for key '$KEY' (will create)"
fi

# Execute the update
echo ""
echo "Updating prompt in $ENV..."

# Create temp files
SQL_FILE=$(mktemp)
CONTENT_FILE=$(mktemp)
REASON_TMP_FILE=$(mktemp)
trap "rm -f $SQL_FILE $CONTENT_FILE $REASON_TMP_FILE" EXIT

# Write content to temp file (preserves all special characters)
printf '%s' "$VALUE" > "$CONTENT_FILE"

# Write reason to temp file if provided
if [[ -n "$REASON" ]]; then
  printf '%s' "$REASON" > "$REASON_TMP_FILE"
fi

# Escape single quotes for SQL by reading content and replacing
ESCAPED_VALUE=$(sed "s/'/''/g" "$CONTENT_FILE")
ESCAPED_CREATED_BY="${CREATED_BY//\'/\'\'}"

# Escape reason if provided
if [[ -n "$REASON" ]]; then
  ESCAPED_REASON=$(sed "s/'/''/g" "$REASON_TMP_FILE")
  REASON_SQL="'$ESCAPED_REASON'"
else
  REASON_SQL="NULL"
fi

# Determine created_by clause
if [[ -n "$CREATED_BY" ]]; then
  CREATED_BY_SQL="'$ESCAPED_CREATED_BY'"
else
  CREATED_BY_SQL="NULL"
fi

# Step 1: Insert new version
printf "INSERT INTO prompts (key, content, version, created_by, reason)
SELECT '%s',
  '%s',
  COALESCE((SELECT MAX(version) + 1 FROM prompts WHERE key = '%s'), 1),
  %s,
  %s;
" "$KEY" "$ESCAPED_VALUE" "$KEY" "$CREATED_BY_SQL" "$REASON_SQL" > "$SQL_FILE"

INSERT_OUTPUT=$(bunx wrangler d1 execute "$DB_NAME" --env "$ENV" --remote --file "$SQL_FILE" 2>&1)
if ! echo "$INSERT_OUTPUT" | grep -q '"success": true'; then
  echo "ERROR: Failed to insert new prompt version"
  echo "SQL attempted:"
  cat "$SQL_FILE"
  echo ""
  echo "Wrangler output:"
  echo "$INSERT_OUTPUT"
  exit 1
fi

# Step 2: Mark old versions as deleted
printf "UPDATE prompts SET deleted = 1
WHERE key = '%s'
  AND deleted = 0
  AND version < (SELECT MAX(version) FROM prompts WHERE key = '%s');
" "$KEY" "$KEY" > "$SQL_FILE"

DELETE_OUTPUT=$(bunx wrangler d1 execute "$DB_NAME" --env "$ENV" --remote --file "$SQL_FILE" 2>&1)
if ! echo "$DELETE_OUTPUT" | grep -q '"success": true'; then
  echo "ERROR: Failed to mark old versions as deleted"
  echo "Wrangler output:"
  echo "$DELETE_OUTPUT"
  exit 1
fi

# Verify
echo ""
echo "Verifying..."
RESULT=$(bunx wrangler d1 execute "$DB_NAME" --env "$ENV" --remote --json \
  --command "SELECT version, LENGTH(content) as content_length, created_at, created_by FROM prompts WHERE key = '$KEY' AND deleted = 0 ORDER BY version DESC LIMIT 1" 2>/dev/null \
  | jq -r '.[].results[0]' 2>/dev/null)

NEW_VERSION=$(echo "$RESULT" | jq -r '.version')
NEW_LENGTH=$(echo "$RESULT" | jq -r '.content_length')
CREATED_AT=$(echo "$RESULT" | jq -r '.created_at')

echo "Done: Updated prompt '$KEY'"
echo "  Version: $NEW_VERSION"
echo "  Content length: $NEW_LENGTH chars"
echo "  Created at: $CREATED_AT"
echo "  Environment: $ENV"
