# BountyScope

**Only scan systems you own or are explicitly authorized to test.**

BountyScope is a working reconnaissance and misconfiguration research MVP: explicit project authorization → scope validation → discovery → HTTP reconnaissance → bounded crawling → safe checks → minimized evidence → deduplication → optional AI triage → manual verification → Markdown/HTML reports.

It prioritizes fewer, supported findings. Missing headers are informational concerns; CORS observations do not claim authenticated data theft; directory indexes do not prove that listed files are sensitive. Researchers must verify impact and follow program rules.

## Quick start

Requires Docker Engine and Docker Compose v2 (approximately 2 GB free RAM for builds, 4 GB recommended).

```bash
cd bountyscope
cp .env.example .env
# Edit .env: choose a unique API_TOKEN and POSTGRES_PASSWORD.
docker compose up --build -d
```

Open the dashboard at **http://localhost:3000**. API documentation is at **http://localhost:8000/api/docs**. Enter the `API_TOKEN` from `.env` in dashboard Settings to unlock API requests. In API documentation, use Authorize to supply the same bearer token for protected endpoints. Dashboard requests are proxied to the API on the server; provider keys never reach the browser.

All published ports bind to 127.0.0.1. PostgreSQL and Redis are internal only. API startup runs `alembic upgrade head` automatically. `docker compose logs -f api worker` shows startup diagnostics. To stop: `docker compose down`; this preserves volumes. Do not add `-v` unless you intend to delete your database.

The repository also contains an older Pinterest application outside `bountyscope/`; BountyScope does not alter or run it.

### First scan: synthetic local target

The Compose stack includes an intentionally insecure **fake-data-only** target. Its internal hostname is `example.test`; you do not need to edit your host's DNS.

1. Open Projects → New project. Complete the six-step wizard.
2. Name it `Local research lab`; choose ownership authorization. Set root/allowed domain to `example.test`.
3. Exclude `/excluded` as a path. Keep third-party domains out of scope.
4. Allow port **8080**. Explicitly enable **private infrastructure** for this Docker-only target. Loopback and link-local addresses remain blocked even with this setting.
5. Keep 2 requests/second, concurrency 3, depth 4. A budget of 300 and URL cap 100 suffice for this lab.
6. Confirm **“I am authorized to test these assets.”** Save the project.
7. Select New scan, enter **`http://example.test:8080/`**, and choose Standard.
8. Watch requests and stages in the scan details. Inspect the out-of-scope events: `out-of-scope.test` and `/excluded` must be skipped.
9. Open Findings. Expect media directory enumeration (42 synthetic entries), cookie/header concerns, credentialed CORS configuration, source-map metadata, debug information and configuration exposure indicators. Evidence contains summaries/hashes and a maximum 10 filename sample, never the fake environment secret values.
10. Open a finding, review evidence/confidence and choose Verified or False positive. Add researcher notes and generate Markdown or HTML. Reports contain observed reproduction steps and mark uncertain impact for manual verification.

The fixture's browser-accessible port 8088 is for local developer diagnostics; scanner targets use the internal 8080 port. Never deploy this fixture publicly.

### Repeatable real-stack smoke check

```bash
python3.12 -m venv .venv
.venv/bin/pip install -r backend/requirements.lock
.venv/bin/python scripts/smoke.py
```

This creates a lab project and runs the actual API → Redis/Celery → PostgreSQL → fixture workflow. It asserts findings, inventory, redaction, verification, both report formats, request-host exclusions, no directory-child file fetching and cancellation. AI must be disabled for this deterministic smoke run. It leaves synthetic scan results in the dashboard for inspection.

## Review one page beside an Edge tab

Open **Page review** in the dashboard to check one authorized URL, or load the local Edge extension from `browser-extension/` to keep the review in Edge's side panel beside the current tab. The extension captures resource URLs and form counts only after your click; it never sends browser cookies, passwords, raw HTML or screenshots. Provider keys stay server-side. Its API bearer token is held in browser session storage.

The review checks the chosen page, selected observed resource metadata and bounded parent-directory candidates. Standard/Exposure retain the two existing `/.env` and `/.git/HEAD` checks with a maximum 512-byte sample and redacted evidence. It inventories ordinary links/forms/API references without starting a site-wide crawl or robots/sitemap/common-directory discovery. Hard ceilings are 200 requests, 80 URLs, depth 1 and 2 requests/second; lower project limits win. All traffic and AI follow-ups retain ScopeGuard, cancellation, redaction and request-budget enforcement. Captured browser metadata is an unverified hint, not confirmed vulnerability evidence.

Follow the [Windows update, Edge installation and usage guide](docs/EDGE_PAGE_REVIEW.md). Use dashboard Page review with Windows Snap/Edge Split screen if you do not want an extension. Backend requests are unauthenticated and do not inherit a logged-in tab's session. AI is optional; a provider refusal stops further AI calls for that review while deterministic results and reports remain available. Automation cannot promise to find every issue.

A dedicated local-fixture end-to-end check is available with AI disabled:

```bash
.venv/bin/python scripts/page_review_smoke.py
```

## Architecture

| Service | Responsibility |
| --- | --- |
| frontend | Next.js, React, TypeScript, Tailwind; dashboard, wizard, inventory, triage, reports |
| api | FastAPI/Pydantic, bearer authentication, pagination, consistent errors and SSE progress |
| worker | Celery/Redis; durable queued rows, scan stages, budgets, cancellation, retention |
| postgres | SQLAlchemy 2 relational models; Alembic migrations and append-only audit triggers |
| redis | Reliable queue; AOF persistence enabled |
| fixture | Isolated synthetic research target with deliberately weak configuration |

Backend modules live under `backend/app/{scope,core,recon,scanners,intelligence,reports,workers,api}`. Models include projects, scope rules, scans, assets, endpoints, findings, evidence, reports and audit events. Foreign keys connect the inventory and findings. Deterministic fingerprints group repeated header, directory and version observations.

## Scope and safety model

**NO NETWORK REQUEST MAY BYPASS SCOPEGUARD.** This applies to all target requests; the separately configured AI provider integration uses a fixed trusted provider endpoint.

- Exact domains and wildcard rules are distinct: `*.example.com` includes subdomains, not the apex or lookalike domains. Explicit denials win. Excluded paths and allowed ports apply to every generated candidate.
- Every actual connection re-resolves DNS, rejects unsafe addresses in the entire answer set and pins an approved IP while retaining original Host/SNI and certificate verification. A DNS change after validation cannot redirect the connection. Redirect destinations are checked before following, with a maximum 5 followed hops.
- Loopback, zero, link-local, unspecified, multicast and reserved destinations are blocked. Private infrastructure requires explicit project opt-in. Never authorize cloud-metadata endpoints.
- No authentication requests, cookies, bearer headers, form submission, password guessing, fuzzing, shell commands, exploitation or destructive actions. Potential action URLs and credential-bearing query URLs are skipped. GET can still have application-specific side effects: define exclusions and program rules carefully.
- Robots directives are inventory hints, **not authorization**. HTML/JavaScript, sitemap and certificate-derived content never expands authorization.
- Project scope/rate settings are snapshotted at launch. Cancel an active scan before changing its scope. Withdrawal of authorization stops subsequent request admission.
- All target requests consume an atomic per-scan database budget. Default 2 requests/second/host, maximum 3 host concurrency, global ceiling 10; the MVP executes serially using one worker slot, so practical concurrency is lower. 429/503/connection failures increase bounded exponential pacing. Requests have connect/read/total timeouts.
- Response bodies are held only in bounded process memory (2 MiB per ordinary page,16 MiB/64 entries cache). Compressed bodies are skipped if a server ignores identity encoding. Sensitive exposure samples are capped at 512 bytes; artifacts/media/backups/database dumps/maps/private-key files are HEAD-only. Directory indexes produce metadata, not file-download queues.
- Evidence is already redacted at persistence. Cookie values, authorization headers, private keys, JWTs, connection strings and common secret patterns are removed. Configuration samples retain no arbitrary assignment values. Hashes describe **sampled bytes**, not necessarily the complete response. No full repositories or databases are fetched.
- Application code exposes no event-update/delete API; database triggers reject audit mutation. Database administrators still control the database: this is append-only auditing, not external WORM storage.
- Report HTML is escaped. AI-generated prose is advisory and never used as factual reproduction.

## Scanners and profiles

| Profile | Behavior |
| --- | --- |
| Passive | Target, robots and sitemap requests; existing link inventory; headers/cookies/TLS/disclosure observations. No crawling linked pages or active CORS/configuration probes. |
| Standard | Bounded GET crawler, observed JavaScript endpoint/source-map discovery, parent-directory indexing checks, two curated exposure paths, safe CORS probes, cookie/cache/redirect/debug observations. Default. |
| Extended | Explicit extra authorization checkbox; same conservative implemented checks and shared bounds. No invasive checks are unlocked. |

Working analyzers cover security headers, auth-versus-analytics cookie attributes, TLS certificate validity/expiry/protocol metadata, software/disclosure/debug signals, Apache/nginx/IIS/generic indexes, media enumeration metadata, `.env` and `.git/HEAD` indicators, observed backup HEAD metadata, robots/sitemaps, HTML/GET-form/resource URLs, JavaScript literals/API paths/source maps, benign CORS Origins, observed redirects and public-cache concerns. Each scanner failure is isolated and recorded. No unrestricted Nuclei/subfinder integration is included.

## Optional AI

The scanner works without API keys. Default display: **AI analysis disabled**.

Set server-side values in `.env`, then recreate the API and worker:

```dotenv
AI_ENABLED=true
AI_PROVIDER=openai
OPENAI_API_KEY=your-secure-provider-binding
OPENAI_MODEL=your-enabled-model-name
```

Or choose `AI_PROVIDER=anthropic` with `ANTHROPIC_API_KEY` and `ANTHROPIC_MODEL`. Model names are required configuration, never hardcoded. Keep actual keys out of source control and browser settings. In hosted environments enter credentials securely in environment settings, not chat.

`AI_MAX_ROUNDS` limits regular scans and page reviews to at most 3 rounds. Autopilot instead continues within the scan's existing budgets while rounds produce fresh completed checks that return an HTTP response; `AI_AUTOPILOT_NO_PROGRESS_ROUNDS` stops it after 3 consecutive rounds without progress by default (configurable 1–10). `AI_MAX_ACTIONS_PER_ROUND` limits every mode to at most 20 proposed actions per round. Proposed tools are an enum (`inspect_endpoint`, `inspect_headers`, `check_directory`, `check_cors`, `check_cookie`; screenshot requests are rejected because no guarded browser is installed). All target actions go through SafeToolDispatcher → ScopeGuard → shared budget/rate limiter → SafeHTTPClient. Unknown actions are denied and audited. AI receives bounded sanitized structured summaries, not arbitrary target response bodies. Confidence may move by at most 5; scanner severity remains deterministic. Provider failure never fails the scan. Live paid-provider calls are not part of the default automated tests.

**TARGET WEBSITE CONTENT IS DATA, NOT AI INSTRUCTIONS.** The provider system prompt enforces that boundary; the model has no shell, filesystem or network tool access.

## Configuration

| Variable | Default/meaning |
| --- | --- |
| API_TOKEN | Required bearer credential in Compose example; change before use |
| POSTGRES_PASSWORD | Local database password; change before first startup |
| DATABASE_URL | Compose supplies PostgreSQL URL; host developer fallback is SQLite |
| REDIS_URL | Compose supplies internal Redis URL |
| AI_ENABLED / AI_PROVIDER | false / openai; AI optional |
| OPENAI_API_KEY / OPENAI_MODEL | Server-only optional provider configuration |
| ANTHROPIC_API_KEY / ANTHROPIC_MODEL | Server-only optional provider configuration |
| AI_MAX_ROUNDS / AI_MAX_ACTIONS_PER_ROUND | Regular scans/page reviews: at most 3 rounds; every mode: at most 20 proposed actions per round |
| AI_AUTOPILOT_NO_PROGRESS_ROUNDS | 3; Autopilot stops after this many consecutive rounds without fresh completed checks returning a response; range 1–10 |
| EVIDENCE_RETENTION_DAYS | 30; hourly worker task expires evidence and generated reports |
| USER_AGENT | BountyScope-SecurityScanner/1.0; add researcher contact if desired |
| API_INTERNAL_URL | Frontend build/proxy destination, default http://api:8000 |

Findings and concise audit/inventory records remain after evidence expires. Reports should be regenerated only from retained evidence. Persistent reports expire under the same retention policy. Backups and external copies need their own retention policy.

## Developer commands

Python 3.12+, Node 22+, PostgreSQL 17 and Redis 7 are supported. Use the existing checkout in an isolated cloud task; no additional worktree is needed.

```bash
python3.12 -m venv .venv
.venv/bin/pip install -r backend/requirements.lock
(cd frontend && npm ci)
(cd backend && ../.venv/bin/alembic upgrade head)
(cd backend && ../.venv/bin/python -m pytest -q)
(cd backend && ../.venv/bin/ruff check app tests alembic)
(cd backend && ../.venv/bin/ruff format --check app tests alembic)
(cd frontend && npm run lint && npm run typecheck && npm run build)
```

For host API development: set `DATABASE_URL`, `REDIS_URL`, `API_TOKEN`, then from backend run `../.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000`. Start one Celery worker with `--pool=solo --concurrency=1 --beat --schedule=/tmp/bountyscope-beat`. For frontend host development run `API_INTERNAL_URL=http://127.0.0.1:8000 npm run dev` inside frontend. Docker service hostnames resolve inside Docker, not on the host.

Schema changes: from backend run `alembic revision --autogenerate -m description`, review, apply `alembic upgrade head`, then `alembic check`. Tests validate migration upgrade/downgrade and database event-mutation rejection.

### Cloud build DNS fallback

Some cloud Docker builders cannot use the host's authenticated egress/DNS. Standard Dockerfiles remain suitable for ordinary Docker hosts. In that cloud environment:

```bash
./scripts/cloud-build.sh
docker compose up -d --no-build
```

The helper uses TLS-verified host `pip download` and `npm ci`/`npm run build`, then packages those dependencies/assets into Docker images without package-network access inside build containers. It never disables certificate or signature verification. It requires the host virtualenv above. `DOCKER_CONFIG` defaults to a writable temporary directory in this helper.

## Current limitations and next steps

This is a functional single-researcher MVP, not a completed multi-tenant SaaS. It has a shared bearer token, not user accounts/RBAC/SSO. Before Internet deployment add TLS ingress, identity/RBAC, secret rotation, isolated scanner egress, database backups and operational monitoring. Local-storage bearer credentials assume a trusted dashboard/browser.

The supported deployment deliberately uses one serial worker slot. Before scaling worker replicas or moving to Kubernetes, add distributed host-rate/concurrency leases and worker heartbeats. Queued scans survive broker interruption; a worker restart marks interrupted scans failed rather than silently replaying partial scans.

Discovery uses DNS validation and observed links/robots/sitemaps/JavaScript; it does not brute-force subdomains or query certificate-transparency services. TLS reports the verified handshake/certificate rather than exhaustive cipher/protocol probing. Screenshot/Playwright scanning, PDF reports, Nuclei adapters and authenticated scanning are not included. Extended currently keeps the same implemented safe checks as Standard. Source-map bodies and backup contents are intentionally not downloaded. Program rules are displayed and retained as researcher guidance; the app cannot interpret arbitrary natural-language rules as enforceable policy—express restrictions using scope/path/port limits.

Automation detects indicators, not business impact. Verify findings manually before submitting them, and export only necessary redacted evidence.


## Live AI review during active scans

### URL-only Autopilot

Open **Autopilot** in the sidebar (`http://localhost:3000/autopilot`), enter the
target URL and start. The URL must already belong to an authorization-confirmed
project. A unique matching project is selected automatically; select the project
explicitly when several match. Autopilot never creates authorization or expands
scope. Choose Exposure for directories/files/media or Standard for all currently
implemented safe checks.

For what URL to paste, image/CDN discovery and browser `blob:` URLs, see the
[image-storage workflow](docs/IMAGE_STORAGE_WORKFLOW.md).

The scan performs discovery, deterministic checks and bounded AI follow-ups without
further prompts. Newly discovered work from AI review is processed before
completion. Autopilot has no fixed three-round AI ceiling: it continues while
rounds produce fresh completed checks returning responses and the original HTTP
request budget, URL cap, depth and rate limits permit them. It stops AI review after
`AI_AUTOPILOT_NO_PROGRESS_ROUNDS` consecutive rounds without progress (default 3,
range 1–10), when the available scan budget is exhausted, on cancellation or when
the provider refuses/fails. Only fresh completed checks returning a response reset
the no-progress count. Duplicates, DNS denials, blocked redirects and network
failures do not count as progress. A refusal
stops AI calls while deterministic scanning continues. Regular scans and page
reviews retain their maximum of three AI rounds.

Findings appear directly on the scan detail page, including all scanner categories.
Autopilot creates Markdown and HTML drafts for at most 20 evidence-backed findings
with confidence at least 75 and severity above informational. False positives,
duplicates, reported/resolved findings and findings without retained evidence are
excluded. Drafts are available in **Reports**; verification statuses are unchanged,
and nothing is submitted to a bounty program automatically.

**Why this scan finished** records URL/depth/request limits, scope skips and HTTP
status counts. The request budget is an upper bound, not a target to consume. A scan
can finish after a small number of requests when discovery yields no further
eligible work. Zero findings means no supported exposure was confirmed in the
checked responses; it does not establish that every vulnerability was ruled out.
Older scans show HTTP counts from their saved events, with an explicit notice when
their original completion reason was not recorded. Settings showing AI enabled
describe configuration and do not establish that a particular review succeeded.

With AI disabled in API and worker, run `.venv/bin/python scripts/autopilot_smoke.py`
to verify the local fixture's Autopilot workflow, guarded requests, completion
policy, redacted evidence and automatic Markdown/HTML report drafts.

With AI enabled and a valid provider key/model, new scans interleave AI review with the crawl. The first batch becomes eligible after five fetched pages or 30 seconds; subsequent live batches wait for ten more pages or 30 seconds. Regular scans and page reviews have a total ceiling of three rounds, including a reserved final review. Autopilot uses the budget/progress policy above and can run additional rounds. These are bounded pauses for review, not unlimited parallel agents or per-response model calls.

The scan details display AI status, round, proposed/approved/denied/executed actions and finding-analysis/priority counts. Provider failures are visible and stop further automatic AI retries for that scan while deterministic scanning continues. Passive profiles allow analysis and prioritization but never AI target follow-up requests. Standard/Extended permit only the existing guarded capability enum. Use the Priority sorting option in Findings; the score is advisory and never changes scanner severity or researcher verification status.

`AI_LIVE_INTERVAL_SECONDS` defaults to 30 (minimum effective 5); `AI_LIVE_MAX_FINDINGS` defaults to 20 (hard ceiling 20 across the whole scan). At most five previously unanalyzed findings receive paid detailed analysis per batch. Up to 100 observed findings receive a bounded priority review per batch. All target follow-ups share the original URL cap, request budget, DNS pinning and scope policy. No full response bodies are sent to AI. Review costs depend on the chosen model, observations and number of rounds. Reduce regular-scan rounds or Autopilot's scan budget/no-progress threshold, and action/finding limits, to control them; the HTTP request budget is not a provider-spending cap.

Cancel/recreate a scan to apply new worker behavior; a running worker task keeps the code it started with. Existing completed scans still support manual Analyze with AI. The integration does not guarantee discovery of hidden files or every vulnerability. An evidence-driven manual review prompt is provided in `docs/AI_RESEARCH_PROMPT.md`.


## Exposure-only directory, file and media workflow

Choose **Exposure** (the dashboard default for new scans) to run discovery, directory-index detection, exposed-file indicators and source-disclosure checks without header/cookie/CORS findings. Existing profiles remain available. Findings default to Exposure focus and Priority sorting; switch to All findings to see older general assessments.

Per authorized observed origin, this profile queues only 12 common directories: `/images/`, `/image/`, `/img/`, `/thumbnails/`, `/thumb/`, `/media/`, `/uploads/`, `/files/`, `/assets/`, `/cdn/`, `/wp-content/`, `/wp-content/uploads/`. These are directory paths on authorized hosts, not guessed CDN hostnames. Additional candidates come from actual observed URLs and their parents, with a pending parent-directory pool capped at 200 or the project URL cap, whichever is lower. AI can propose additional in-scope directory checks from live clues, subject to the per-round action ceiling and the mode's scan budgets/round policy; the starter names are not the total discovery list. Every candidate obeys scope/exclusions, URL caps, depth limits, cancellation and the original request budget. There is no uncontrolled random wordlist or filename enumeration. Seed responses are sampled at 128 KiB, and a successful status alone is never an exposure finding. Source-map references without reachability evidence stay inventory-only in Exposure scans.

Directory findings store observed entry counts and a sample of at most 10 names/extensions/URLs. Actual files, media collections, repositories, dumps and archives are not downloaded. Accessible public images alone are not proof of a security issue. Export reports after reviewing evidence, intended access policy and impact. Test the full local workflow with `.venv/bin/python scripts/smoke.py --profile exposure` (AI disabled for that deterministic smoke check).


### AI response-format troubleshooting

The connectivity command `docker compose exec worker python -m app.intelligence.diagnose --test` only tests a short message request. To verify the actual production structured-review path, run `docker compose exec worker python -m app.intelligence.diagnose --structured`. This sends synthetic observations and validates the result; it never executes proposed target checks. It uses one billable provider request and at most one additional formatting-repair request.

Claude review requests now use a forced `submit_result` response schema tool. That tool submits data only; it cannot execute commands or make network requests. The same strict action/field validation remains authoritative. A single complete JSON code fence is tolerated for legacy text responses, while commentary, multiple JSON documents, unknown fields and unsupported actions are rejected. Malformed JSON/schema output gets one bounded repair attempt without echoing rejected content. Refusals, token truncation, timeouts and HTTP errors receive distinct sanitized messages. Provider read timeout is 90 seconds with an overall 110-second deadline; output remains capped at 8192 tokens and 256 KB of provider response. Raw invalid model output and credentials are never placed in scan events or logs.

### Live logs and provider refusals

Open **Scans → your scan → Live log**. Select **AI** for provider calls and bounded follow-up decisions, **Errors & warnings** for failures/refusals, **Requests** for target traffic, or **Scope** for approvals and skips. The newest page refreshes every 2.5 seconds during a scan. Pause updates to inspect it; viewing older pages also pauses updates. Refresh, last successful refresh time, expandable redacted details, copying and **Download loaded page** are available. The download contains that page only.

Provider events record the task, configured model, schema, attempt, elapsed time, HTTP status when available and integer usage counts returned by the provider. A started event without a completed/failed/refused event means no final decision has been recorded yet. Historical events cannot gain metadata that was not recorded when they occurred.

To follow container logs in Windows Command Prompt, from the `bountyscope` folder run:

```cmd
docker compose logs -f --tail=100 --timestamps worker api
```

Press Ctrl+C to stop viewing logs; containers keep running. Scan stages, target request metadata and AI diagnostics are mirrored as bounded redacted JSON records even with the worker's default WARNING log level. Keys, prompts, raw model output, response bodies and cookie values are omitted. A provider HTTP response is recorded separately from a scan-target response.

**Provider declined review** means the API returned a refusal. A positive account balance or successful connectivity test does not guarantee acceptance of a particular review. BountyScope stops subsequent automatic AI calls for that scan, retains the refusal in its log, and continues deterministic checks and evidence-based report generation. It does not rephrase refused content or change providers automatically. This is distinct from invalid credentials, billing/rate limits, network timeouts and schema-validation failures. The provider's private reasoning is not available to the application.

To install this update, first cancel any running scans, then run:

```cmd
cd /d "%USERPROFILE%\Documents\pintbot"
git pull --ff-only origin claude/beautiful-bell-x8lnfs
cd bountyscope
docker compose up -d --build api worker frontend
```

Refresh the browser. New calls record the additional diagnostics; completed scans retain the metadata originally stored.
