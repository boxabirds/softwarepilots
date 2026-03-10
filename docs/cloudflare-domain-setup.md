# Cloudflare Pages + Custom Domain Setup

**Domain:** softwarepilots.com
**Registrar:** Namecheap
**Hosting:** Cloudflare Pages

---

## 1. Point Namecheap nameservers to Cloudflare

Namecheap > Domain List > `softwarepilots.com` > Manage > Nameservers > change from "Namecheap BasicDNS" to **Custom DNS**. Enter the two nameservers Cloudflare assigns when you add the site (e.g. `ada.ns.cloudflare.com`, `will.ns.cloudflare.com` — assigned per-zone).

This is the only Namecheap change. Namecheap remains the registrar; Cloudflare manages DNS from here.

Propagation: minutes to hours.

## 2. Add site to Cloudflare

Cloudflare dashboard > **Add a Site** > enter `softwarepilots.com` > select plan. Cloudflare provides the nameservers for step 1.

## 3. Create Pages project and deploy

```bash
bun run build
wrangler pages project create softwarepilots
wrangler pages deploy dist --project-name=softwarepilots --branch=main
```

Gives a working `softwarepilots.pages.dev` URL immediately.

## 4. Connect custom domain

Cloudflare dashboard > **Workers & Pages** > `softwarepilots` > **Custom domains** > Add:
- `softwarepilots.com`
- `www.softwarepilots.com` (optional)

Cloudflare auto-creates DNS records and provisions SSL.

## 5. Verify

```bash
curl -I https://softwarepilots.com
```

Should return 200 with `server: cloudflare` header.
