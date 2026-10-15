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

`AI_MAX_ROUNDS` (ceiling 3) and `AI_MAX_ACTIONS_PER_ROUND` (ceiling 20) can reduce autonomy. Proposed tools are an enum (`inspect_endpoint`, `inspect_headers`, `check_directory`, `check_cors`, `check_cookie`; screenshot requests are rejected because no guarded browser is installed). All target actions go through SafeToolDispatcher → ScopeGuard → shared budget/rate limiter → SafeHTTPClient. Unknown actions are denied and audited. AI receives bounded sanitized structured summaries, not arbitrary target response bodies. Confidence may move by at most 5; scanner severity remains deterministic. Provider failure never fails the scan. Live paid-provider calls are not part of the default automated tests.

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
| AI_MAX_ROUNDS / AI_MAX_ACTIONS_PER_ROUND | 3 /20; hard maximums |
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
