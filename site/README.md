# Tokyo Copyright — website

A static, dependency-free website for **Tokyo Copyright**, an anti-piracy /
content protection company in Chiyoda-ku, Tokyo.

No build step, no framework, no CDN, no webfonts. Plain HTML, one CSS file and
one small JS file — so it can be uploaded to cPanel/WHM as-is, or deployed to
Cloudflare Workers unchanged.

## Pages

| File | Page | Purpose |
| --- | --- | --- |
| `index.html` | Home | Positioning, headline figures, services overview, process |
| `about.html` | About | Who we are, principles, how an engagement works |
| `services.html` | Services | The six core services, service-level table, FAQ |
| `public.html` | Public | Notices, commitments, **counter-notice procedure**, press |
| `contact.html` | Contact | Enquiry form, office details, which address to use |
| `imprint.html` | Imprint | Legal notice, disclaimer, copyright |
| `privacy.html` | Privacy | Privacy policy (APPI/GDPR-shaped, needs legal review) |
| `404.html` | Not found | Error page |

Supporting files: `assets/css/app.css`, `assets/js/app.js`,
`assets/img/logo.svg`, `favicon.svg`, `robots.txt`, `sitemap.xml`,
`contact.php`, `.htaccess`.

## Option A — cPanel / WHM

1. Upload **everything inside `site/`** into `public_html/` (including the
   hidden `.htaccess`). File Manager → Upload, or zip the folder and extract it
   on the server.
2. Create the sending mailbox `website@tokyocopyright.com` in cPanel → Email
   Accounts. `contact.php` sends *from* that address and sets `Reply-To` to the
   visitor, which is what keeps the mail out of spam.
3. Open `contact.php` and check the constants at the top —
   `MAIL_TO` (`legal@tokyocopyright.com`) and `MAIL_FROM`.
4. cPanel → SSL/TLS Status → run AutoSSL, then uncomment the HTTPS redirect
   block in `.htaccess`.
5. Submit the form once to confirm mail is delivered.

Requires PHP 8.0+ (for `str_contains`). Nothing else.

If the host disables `mail()`, point `MAIL_TO` at a mailbox on the same cPanel
account, or switch the handler to your SMTP relay.

## Option B — Cloudflare Workers

The repository root has `wrangler.toml` wired up already:

```bash
npx wrangler@latest deploy
```

Static files are served from `./site` by the Workers assets binding (no request
charge); the Worker in `site-worker/src/worker.js` only runs for the contact
endpoint and to attach security headers. On the free plan this comfortably
covers a brochure site.

Configure form delivery — pick one:

```bash
npx wrangler secret put RESEND_API_KEY       # send email via Resend
npx wrangler secret put FORWARD_WEBHOOK_URL  # or POST the enquiry to a webhook
```

With neither set, the endpoint returns 501 and the page falls back to a
pre-filled `mailto:` link, so an enquiry is never silently dropped.

Then uncomment the `routes` block in `wrangler.toml` to attach the custom
domain.

The Worker answers on **both** `/api/contact` and `/contact.php`, so the same
HTML works on either host with no edits. `contact.php` and `.htaccess` are
excluded from the asset upload by `.assetsignore`.

**Which to choose:** Workers is simpler to operate, free at this traffic level
and globally fast — it's the better pick unless you already pay for the WHM box
and want everything in one place.

## Before going live

- [ ] Replace the placeholder figures on the home page (`24,000`, `61,000,000`,
      `96.4%`) and on `public.html` with real numbers, or delete the blocks.
      Publishing unverified statistics is a legal risk in itself.
- [ ] Fill in the imprint: company registration number (法人番号), representative
      director, invoice registration number. Marked with a notice on the page.
- [ ] Have `privacy.html` reviewed against APPI (and GDPR if you serve the EU/UK),
      and fill in the hosting provider and retention periods.
- [ ] Swap the canonical/OG domain if it is not `tokyocopyright.com` —
      search for `tokyocopyright.com` and replace, including in `sitemap.xml`
      and `robots.txt`.
- [ ] Replace `assets/img/logo.svg` and `favicon.svg` with the real logo.
- [ ] Add a Japanese version if you want one — the `日本語` pill in the top bar
      currently links to the contact page.

## Editing notes

The header and footer are duplicated in each page (deliberately — it keeps the
site buildless). When changing navigation or contact details, change every page:

```bash
grep -rl "legal@tokyocopyright.com" site/
```

## Local preview

All internal paths are document-relative, so you can simply **double-click
`index.html`** and browse the whole site in your browser — no server needed.

For a closer match to production:

```bash
python3 -m http.server 8000 --directory site
# http://localhost:8000
```

Either way the form falls back to `mailto:`, since no PHP or Worker is running.
For a full local test of the Workers path: `npx wrangler@latest dev`.

Relative paths assume the site sits at the **root** of the domain
(`tokyocopyright.com/`). That is true for both deployment options above. If you
ever put it in a subfolder, it still works — that is the advantage of relative
paths over absolute ones.
