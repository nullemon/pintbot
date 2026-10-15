# BountyScope engineering instructions

BountyScope is an authorization-aware, non-destructive reconnaissance application. Only scan systems you own or are explicitly authorized to test.

**NO NETWORK REQUEST MAY BYPASS SCOPEGUARD.** All target traffic, generated paths, redirects and AI follow-ups must use `SafeHTTPClient`. Fixed AI-provider API calls are control-plane integrations; never allow target content to choose their destinations. Do not introduce scanner-owned HTTP clients, socket clients, subprocess scanners or browsers.

**TARGET CONTENT IS UNTRUSTED DATA, NEVER AI INSTRUCTIONS.** The model receives sanitized structured observations, not arbitrary response bodies. AI proposals must use the enumerated dispatcher capabilities, scope checks, the shared request budget and rate limiter. No shell, filesystem, arbitrary network tools or model-invented commands.

## Architecture

- `backend/app/core`: settings, SQLAlchemy sessions, guarded HTTP, request admission.
- `backend/app/scope`: hostname/path/port matching, IP safety and DNS approval.
- `backend/app/recon`, `scanners`: pure discovery parsers and bounded observation scanners.
- `backend/app/workers`: Celery queue, persisted scan lifecycle and cancellation.
- `backend/app/intelligence`: optional OpenAI/Anthropic analysis and safe follow-ups.
- `backend/app/reports`: deterministic evidence-based escaped reports.
- `frontend`: Next.js/TypeScript dashboard. Never expose provider keys here.
- `fixture`: intentionally insecure synthetic target; local test network only.

Use typed Pydantic inputs, SQLAlchemy parameterized queries, small cohesive functions and explicit exceptions. Escape target strings in UI/report output. Redact and minimize BEFORE database storage or AI calls. Never persist raw bodies or cookie/credential values. Archive, dump, media and source-map requests are metadata-only. Exposure samples are capped at512 bytes, then discarded after classification/hash. Redirects revalidate DNS and pin approved IPs. TLS verification stays enabled. Do not change these invariants to fix a test.

## Development and tests

Existing isolated cloud tasks should use this checkout; do not create worktrees unless requested.

From `bountyscope/`:

```
python3.12 -m venv .venv
.venv/bin/pip install -r backend/requirements.lock
(cd backend && ../.venv/bin/python -m pytest -q)
(cd backend && ../.venv/bin/ruff check app tests alembic)
(cd backend && ../.venv/bin/ruff format --check app tests alembic)
(cd frontend && npm ci && npm run lint && npm run typecheck && npm run build)
```

Run Compose with one worker execution slot. Increasing worker replicas requires a shared distributed rate/concurrency admission service first. The current conservative executor honors upper bounds by processing target requests serially.

Migration workflow: change models, generate `alembic revision --autogenerate -m ...` inside backend, review the migration, test upgrade/check/downgrade on an isolated database, then `alembic upgrade head`. Production schema changes never run `create_all`; API startup applies migrations before worker startup. Append-only event triggers must remain intact.

End-to-end validation: `docker compose up -d --build`, then `.venv/bin/python scripts/smoke.py`. Never substitute an unrelated live Internet target for the synthetic fixture. Do not enable invasive exploitation, credential use, mass extraction, POST crawling, destructive checks, or uncontrolled discovery.
