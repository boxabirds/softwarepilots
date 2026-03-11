#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# namecheap-cloudflare-dns-setup.sh
#
# Automates the full domain setup flow:
#   1. Create a Cloudflare zone for the domain
#   2. Wait for Cloudflare to assign nameservers
#   3. Update Namecheap to use those nameservers
#   4. Poll until Cloudflare confirms the zone is active
#   5. Create a Cloudflare Pages project (if it doesn't exist)
#   6. Deploy the site
#   7. Attach the custom domain to the Pages project
#
# REQUIRED API KEYS AND ACCESS:
#
#   CLOUDFLARE_API_TOKEN
#     - Create at: https://dash.cloudflare.com/profile/api-tokens
#     - Required permissions:
#       - Zone: Zone: Edit         (to create zones)
#       - Zone: DNS: Edit          (to manage DNS records)
#       - Account: Pages: Edit     (to create projects and attach domains)
#     - Scope: Account level (the account that will own the zone)
#
#   CLOUDFLARE_ACCOUNT_ID
#     - Find at: https://dash.cloudflare.com → any zone → Overview → right sidebar
#     - Or: wrangler whoami
#
#   NAMECHEAP_API_USER
#     - Your Namecheap username (same as login)
#
#   NAMECHEAP_API_KEY
#     - Create at: https://ap.www.namecheap.com/settings/tools/apiaccess/
#     - Requires: account balance ≥ $50, or ≥ 20 domains, or ≥ $50 spent
#     - Your current public IP must be whitelisted in the API access settings
#
#   NAMECHEAP_CLIENT_IP
#     - Your current public IP address (must match the whitelisted IP)
#     - Find with: dig +short myip.opendns.com @resolver1.opendns.com
#
# USAGE:
#   export CLOUDFLARE_API_TOKEN="..."
#   export CLOUDFLARE_ACCOUNT_ID="..."
#   export NAMECHEAP_API_USER="..."
#   export NAMECHEAP_API_KEY="..."
#   export NAMECHEAP_CLIENT_IP="$(dig +short myip.opendns.com @resolver1.opendns.com)"
#   ./scripts/namecheap-cloudflare-dns-setup.sh softwarepilots.com softwarepilots
#
# =============================================================================

# --- Constants ---
readonly CLOUDFLARE_API="https://api.cloudflare.com/client/v4"
readonly NAMECHEAP_API="https://api.namecheap.com/xml.response"
readonly PROPAGATION_POLL_INTERVAL_SECS=30
readonly PROPAGATION_MAX_ATTEMPTS=60  # 30 minutes max

# --- Args ---
if [[ $# -lt 2 ]]; then
  echo "Usage: $0 <domain> <pages-project-name>"
  echo "Example: $0 softwarepilots.com softwarepilots"
  exit 1
fi

readonly DOMAIN="$1"
readonly PAGES_PROJECT="$2"

# Split domain into SLD and TLD for Namecheap API
readonly TLD="${DOMAIN##*.}"
readonly SLD="${DOMAIN%.*}"

# --- Validate environment ---
missing=()
[[ -z "${CLOUDFLARE_API_TOKEN:-}" ]]  && missing+=("CLOUDFLARE_API_TOKEN")
[[ -z "${CLOUDFLARE_ACCOUNT_ID:-}" ]] && missing+=("CLOUDFLARE_ACCOUNT_ID")
[[ -z "${NAMECHEAP_API_USER:-}" ]]    && missing+=("NAMECHEAP_API_USER")
[[ -z "${NAMECHEAP_API_KEY:-}" ]]     && missing+=("NAMECHEAP_API_KEY")
[[ -z "${NAMECHEAP_CLIENT_IP:-}" ]]   && missing+=("NAMECHEAP_CLIENT_IP")

if [[ ${#missing[@]} -gt 0 ]]; then
  echo "ERROR: Missing required environment variables:"
  printf '  - %s\n' "${missing[@]}"
  echo ""
  echo "See script header for setup instructions."
  exit 1
fi

# --- Helpers ---
cf_curl() {
  curl -s -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
       -H "Content-Type: application/json" \
       "$@"
}

check_jq() {
  if ! command -v jq &>/dev/null; then
    echo "ERROR: jq is required. Install with: brew install jq"
    exit 1
  fi
}

# --- Main ---
check_jq

echo "=== Domain Setup: ${DOMAIN} → Cloudflare Pages (${PAGES_PROJECT}) ==="
echo ""

# ---- Step 1: Create Cloudflare zone ----
echo "[1/7] Creating Cloudflare zone for ${DOMAIN}..."

zone_response=$(cf_curl -X POST "${CLOUDFLARE_API}/zones" \
  -d "{\"account\":{\"id\":\"${CLOUDFLARE_ACCOUNT_ID}\"},\"name\":\"${DOMAIN}\",\"type\":\"full\"}")

zone_success=$(echo "$zone_response" | jq -r '.success')

if [[ "$zone_success" != "true" ]]; then
  # Check if zone already exists
  error_code=$(echo "$zone_response" | jq -r '.errors[0].code // empty')
  if [[ "$error_code" == "1061" ]]; then
    echo "  Zone already exists. Fetching existing zone..."
    zone_response=$(cf_curl "${CLOUDFLARE_API}/zones?name=${DOMAIN}")
    zone_id=$(echo "$zone_response" | jq -r '.result[0].id')
    nameservers=$(echo "$zone_response" | jq -r '.result[0].name_servers[]')
    zone_status=$(echo "$zone_response" | jq -r '.result[0].status')
  else
    echo "  ERROR: Failed to create zone:"
    echo "$zone_response" | jq '.errors'
    exit 1
  fi
else
  zone_id=$(echo "$zone_response" | jq -r '.result.id')
  nameservers=$(echo "$zone_response" | jq -r '.result.name_servers[]')
  zone_status=$(echo "$zone_response" | jq -r '.result.status')
fi

readonly ZONE_ID="$zone_id"

echo "  Zone ID: ${ZONE_ID}"
echo "  Status:  ${zone_status}"
echo "  Assigned nameservers:"
echo "$nameservers" | while read -r ns; do echo "    - ${ns}"; done

# If zone is already active, skip steps 2-4
if [[ "$zone_status" == "active" ]]; then
  echo "  Zone is already active. Skipping nameserver update and propagation."
  skip_ns_update=true
else
  skip_ns_update=false
fi

# ---- Step 2: Update Namecheap nameservers ----
if [[ "$skip_ns_update" == false ]]; then
  echo ""
  echo "[2/7] Updating Namecheap nameservers for ${SLD}.${TLD}..."

  ns_csv=$(echo "$nameservers" | tr '\n' ',' | sed 's/,$//')

  nc_response=$(curl -s "${NAMECHEAP_API}?\
ApiUser=${NAMECHEAP_API_USER}&\
ApiKey=${NAMECHEAP_API_KEY}&\
UserName=${NAMECHEAP_API_USER}&\
Command=namecheap.domains.dns.setCustom&\
ClientIp=${NAMECHEAP_CLIENT_IP}&\
SLD=${SLD}&\
TLD=${TLD}&\
Nameservers=${ns_csv}")

  # Namecheap returns XML — check for errors
  if echo "$nc_response" | grep -q 'Status="OK"'; then
    echo "  Nameservers updated successfully."
  elif echo "$nc_response" | grep -q 'Status="ERROR"'; then
    error_msg=$(echo "$nc_response" | grep -oP '(?<=<Error Number=")[^"]*"[^>]*>\K[^<]+' || echo "$nc_response")
    echo "  ERROR: Namecheap API returned an error:"
    echo "  ${error_msg}"
    echo ""
    echo "  Common causes:"
    echo "  - API not enabled on your Namecheap account"
    echo "  - IP ${NAMECHEAP_CLIENT_IP} not whitelisted"
    echo "  - Domain not in your Namecheap account"
    exit 1
  else
    echo "  WARNING: Unexpected response from Namecheap. Check manually."
    echo "  Response: ${nc_response}"
  fi

  # ---- Step 3: Wait for info ----
  echo ""
  echo "[3/7] Nameservers set. Waiting for propagation..."
  echo "  This typically takes 5-30 minutes but can take up to 48 hours."
  echo "  Polling every ${PROPAGATION_POLL_INTERVAL_SECS}s (max ${PROPAGATION_MAX_ATTEMPTS} attempts)..."

  # ---- Step 4: Poll for zone activation ----
  echo ""
  echo "[4/7] Polling Cloudflare zone status..."

  attempt=0
  while [[ $attempt -lt $PROPAGATION_MAX_ATTEMPTS ]]; do
    attempt=$((attempt + 1))
    status=$(cf_curl "${CLOUDFLARE_API}/zones/${ZONE_ID}" | jq -r '.result.status')

    if [[ "$status" == "active" ]]; then
      echo "  Zone is ACTIVE after ${attempt} polls."
      break
    fi

    echo "  Attempt ${attempt}/${PROPAGATION_MAX_ATTEMPTS}: status=${status}"
    sleep "$PROPAGATION_POLL_INTERVAL_SECS"
  done

  if [[ "$status" != "active" ]]; then
    echo ""
    echo "  WARNING: Zone not yet active after max polling time."
    echo "  The zone may still activate. Check https://dash.cloudflare.com"
    echo "  Continuing with Pages setup — custom domain attachment may fail until zone is active."
  fi
else
  echo ""
  echo "[2/7] Skipped (zone already active)."
  echo "[3/7] Skipped (zone already active)."
  echo "[4/7] Skipped (zone already active)."
fi

# ---- Step 5: Create Pages project (if needed) ----
echo ""
echo "[5/7] Creating Pages project '${PAGES_PROJECT}'..."

project_response=$(cf_curl -X POST \
  "${CLOUDFLARE_API}/accounts/${CLOUDFLARE_ACCOUNT_ID}/pages/projects" \
  -d "{\"name\":\"${PAGES_PROJECT}\",\"production_branch\":\"main\"}")

project_success=$(echo "$project_response" | jq -r '.success')

if [[ "$project_success" == "true" ]]; then
  echo "  Project created."
elif echo "$project_response" | jq -r '.errors[0].message' | grep -qi "already"; then
  echo "  Project already exists."
else
  echo "  WARNING: Unexpected response:"
  echo "$project_response" | jq '.errors'
  echo "  Continuing anyway — project may already exist."
fi

# ---- Step 6: Build and deploy ----
echo ""
echo "[6/7] Building and deploying..."

bun run build
wrangler pages deploy dist --project-name="${PAGES_PROJECT}" --branch=main

echo "  Deployed to ${PAGES_PROJECT}.pages.dev"

# ---- Step 7: Attach custom domain ----
echo ""
echo "[7/7] Attaching custom domain ${DOMAIN} to Pages project..."

domain_response=$(cf_curl -X POST \
  "${CLOUDFLARE_API}/accounts/${CLOUDFLARE_ACCOUNT_ID}/pages/projects/${PAGES_PROJECT}/domains" \
  -d "{\"name\":\"${DOMAIN}\"}")

domain_success=$(echo "$domain_response" | jq -r '.success')

if [[ "$domain_success" == "true" ]]; then
  echo "  Custom domain attached."
else
  error_msg=$(echo "$domain_response" | jq -r '.errors[0].message // "unknown error"')
  if echo "$error_msg" | grep -qi "already"; then
    echo "  Domain already attached."
  else
    echo "  WARNING: ${error_msg}"
    echo "  You may need to attach the domain manually in the dashboard."
  fi
fi

# Also attach www subdomain
echo "  Attaching www.${DOMAIN}..."

www_response=$(cf_curl -X POST \
  "${CLOUDFLARE_API}/accounts/${CLOUDFLARE_ACCOUNT_ID}/pages/projects/${PAGES_PROJECT}/domains" \
  -d "{\"name\":\"www.${DOMAIN}\"}")

www_success=$(echo "$www_response" | jq -r '.success')

if [[ "$www_success" == "true" ]]; then
  echo "  www subdomain attached."
else
  www_error=$(echo "$www_response" | jq -r '.errors[0].message // "unknown error"')
  if echo "$www_error" | grep -qi "already"; then
    echo "  www subdomain already attached."
  else
    echo "  WARNING: ${www_error}"
  fi
fi

# ---- Done ----
echo ""
echo "=== Setup complete ==="
echo ""
echo "  Zone:    ${DOMAIN} (${ZONE_ID})"
echo "  Pages:   ${PAGES_PROJECT}.pages.dev"
echo "  Custom:  https://${DOMAIN}"
echo "  WWW:     https://www.${DOMAIN}"
echo ""
echo "Verify with: curl -I https://${DOMAIN}"
echo ""
echo "If the site doesn't resolve yet, DNS propagation may still be in progress."
echo "Check zone status at: https://dash.cloudflare.com/${CLOUDFLARE_ACCOUNT_ID}/${DOMAIN}"
