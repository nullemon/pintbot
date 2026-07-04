# Pinterest Auto-Pin Bot

A local Node.js bot that pulls articles from WordPress sites (via RSS, enriched
by the WP REST API), crops the featured photo to Pinterest's vertical 2:3 ratio,
generates an SEO description, and drip-posts pins to Pinterest using the official
**v5 API** — with dedupe, retries, board mapping, and an admin panel.

Runs locally (Windows-friendly) under PM2. SQLite for storage, `sharp` for image
processing, `node-cron` for scheduling, a tiny Express admin UI on
`localhost:8787`.

## Why local (not Cloudflare)

Real filesystem, no Worker CPU/memory limits, full `sharp` support, easier
debugging. Tradeoff: the bot only runs while the PC is on — PM2 handles
restart-on-boot.

## 1. Pinterest setup (do this first — can't be automated)

1. Open the [Pinterest Developer portal](https://developers.pinterest.com/) and
   create an app (a **business account** is required).
2. Note the **App ID** (`client_id`) and **App secret** (`client_secret`).
3. Set the redirect URI to `http://localhost:8787/oauth/callback`.
4. Request scopes: `boards:read`, `pins:read`, `pins:write`,
   `user_accounts:read`.
5. After the bot is running, visit `http://localhost:8787/oauth/login` once →
   authorize → the bot stores the refresh token in SQLite and auto-refreshes the
   short-lived access token from then on.

## 2. Configure — all from the dashboard menu

```bash
npm install
cp .env.example .env      # just set ADMIN_PORT + a first-login ADMIN_PASSWORD
node src/index.js
```

Then open **http://localhost:8787**, log in, and use the **⚙ Settings** tab to:

- enter your Pinterest **App ID + App secret** (stored in the DB, not `.env`),
- click **Authorize with Pinterest**,
- set the **drip pacing** (pins/day, interval, posting window),
- change the **admin password**.

Use the **Sites** tab to add/edit/delete WordPress sites and pick each site's
Pinterest board from a dropdown (populated live from your account after you
authorize). No file editing required.

> `src/sites.js` only provides the initial example sites, which are copied into
> the editable database on first run.

### Environment variables (`.env`)

| Var | Meaning |
| --- | --- |
| `PINTEREST_CLIENT_ID` / `PINTEREST_CLIENT_SECRET` | App credentials |
| `PINTEREST_REDIRECT_URI` | `http://localhost:8787/oauth/callback` |
| `ADMIN_PORT` | Admin UI port (default 8787) |
| `ADMIN_PASSWORD` | Password for the admin panel (Basic auth) |
| `DB_PATH` / `IMAGE_DIR` | SQLite + generated image locations |
| `PINS_PER_DAY` / `POST_INTERVAL_MINUTES` | Drip pacing |
| `POST_WINDOW_START` / `POST_WINDOW_END` | Hours (local) pins are allowed to post |
| `PINTEREST_SANDBOX` | `true` to use the Pinterest sandbox API |

## 3. Run

```bash
node src/index.js
# first run: open http://localhost:8787/oauth/login to authorize
```

Then run it in the background under PM2 (survives reboots):

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup        # follow the printed instructions
```

## CLI helpers

```bash
npm run ingest     # fetch feeds + queue pins now
npm run boards     # list your Pinterest boards (id + name)
npm run tick       # post the next due pin once
```

## How it works

1. **Ingest** (`src/ingest.js`) — parse each site's RSS, dedupe by `guid`, find
   the featured image (RSS `media:content`/`enclosure`/first `<img>`, falling
   back to the WP REST API `wp:featuredmedia`), crop the image, build the
   description, and queue a `pending` pin with a drip-scheduled `scheduled_at`.
2. **Image** (`src/image.js`) — `sharp` smart-crop to 1000×1500 with
   `position: 'attention'`, optional semi-transparent title band over the lower
   third (SVG overlay).
3. **Description** (`src/description.js`) — front-loaded keywords from the title,
   trimmed excerpt, plus 3–5 niche + keyword hashtags.
4. **Scheduler** (`src/scheduler.js`) — spreads `scheduled_at` across the day
   inside the posting window; a cron tick every 5 min posts the next due pin and
   retries failures with backoff (3 attempts → `dead`).
5. **Pinterest** (`src/pinterest.js`) — v5 OAuth (exchange + auto-refresh),
   `listBoards`, `createPin` (uploads the local crop as `image_base64`),
   `getPinAnalytics`.
6. **Admin** (`src/admin/`) — password-protected dashboard at `localhost:8787`:
   Queue / Posted / Failed / Dead views; pause/resume, manual ingest, post-now,
   re-queue dead pins, edit title/description, delete.

## Database

SQLite (auto-created at `DB_PATH`): `articles` (dedupe source), `pins` (queue +
state), `tokens` (OAuth), `boards` (board map cache), `settings` (pause flag).

## Notes / gotchas

- Pinterest v5 needs an **approved app**; traffic-driving pins for content sites
  are an approved use case.
- Access tokens are short-lived — the refresh flow is mandatory and automatic.
- The drip scheduler keeps you well under rate limits.
- Keep `.env` and `data/` out of git (already in `.gitignore`).
- `sharp` on Windows installs prebuilt binaries. If it fails:
  `npm install --include=optional sharp`.

## Roadmap ("one of a kind" features)

- A/B image templates per article, auto-favor the winner via analytics.
- Fresh-pin recycling for evergreen URLs.
- Deeper keyword-optimized descriptions from category/tags.
- Analytics pull into the admin panel (`getPinAnalytics` is already wired).
