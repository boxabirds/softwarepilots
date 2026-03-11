# Cloudflare Pages + Custom Domain Setup

**Domain:** softwarepilots.com
**Registrar:** Namecheap
**Hosting:** Cloudflare Pages

---

## Automated setup

The entire flow is scripted: [`scripts/namecheap-cloudflare-dns-setup.sh`](../scripts/namecheap-cloudflare-dns-setup.sh)

### Prerequisites

| Credential | Where to get it | Required access |
|-----------|----------------|----------------|
| `CLOUDFLARE_API_TOKEN` | [dash.cloudflare.com/profile/api-tokens](https://dash.cloudflare.com/profile/api-tokens) | Zone: Edit, DNS: Edit, Account: Pages: Edit |
| `CLOUDFLARE_ACCOUNT_ID` | Dashboard → any zone → Overview → right sidebar, or `wrangler whoami` | — |
| `NAMECHEAP_API_USER` | Your Namecheap login username | — |
| `NAMECHEAP_API_KEY` | [ap.www.namecheap.com/settings/tools/apiaccess](https://ap.www.namecheap.com/settings/tools/apiaccess/) | Account balance ≥ $50, or ≥ 20 domains, or ≥ $50 spent. Current IP must be whitelisted. |
| `NAMECHEAP_CLIENT_IP` | `dig +short myip.opendns.com @resolver1.opendns.com` | Must match the whitelisted IP in Namecheap API settings |

### Run

```bash
export CLOUDFLARE_API_TOKEN="..."
export CLOUDFLARE_ACCOUNT_ID="..."
export NAMECHEAP_API_USER="..."
export NAMECHEAP_API_KEY="..."
export NAMECHEAP_CLIENT_IP="$(dig +short myip.opendns.com @resolver1.opendns.com)"

./scripts/namecheap-cloudflare-dns-setup.sh softwarepilots.com softwarepilots
```

### What the script does

1. Creates a Cloudflare zone for the domain (or finds existing)
2. Updates Namecheap nameservers to Cloudflare's assigned pair via API
3. Polls Cloudflare until the zone status is `active` (up to 30 min)
4. Creates the Pages project (idempotent)
5. Builds and deploys the site
6. Attaches `softwarepilots.com` and `www.softwarepilots.com` as custom domains

### Verify

```bash
curl -I https://softwarepilots.com
```

Should return 200 with `server: cloudflare` header.

---

## Manual fallback

If the script fails or you prefer the dashboard:

1. **Cloudflare:** Add a Site → enter `softwarepilots.com` → note the assigned nameservers
2. **Namecheap:** Domain List → `softwarepilots.com` → Manage → Nameservers → Custom DNS → paste Cloudflare nameservers
3. **Deploy:** `bun run build && wrangler pages deploy dist --project-name=softwarepilots --branch=main`
4. **Custom domain:** Dashboard → Workers & Pages → `softwarepilots` → Custom domains → Add `softwarepilots.com`
