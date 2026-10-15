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
- `browser-extension`: unpacked Edge/Chromium side panel. Explicit `activeTab`
  capture sends bounded URL references and form counts, never HTML, page text,
  field values, cookies or storage. Host permissions allow only the local
  dashboard; target checks use the backend's guarded client.
- `fixture`: intentionally insecure synthetic target; local test network only.

Use typed Pydantic inputs, SQLAlchemy parameterized queries, small cohesive functions and explicit exceptions. Escape target strings in UI/report output. Redact and minimize BEFORE database storage or AI calls. Never persist raw bodies or cookie/credential values. Archive, dump, media and source-map requests are metadata-only. Exposure samples are capped at512 bytes, then discarded after classification/hash. Redirects revalidate DNS and pin approved IPs. TLS verification stays enabled. Do not change these invariants to fix a test.

Page reviews use the existing scan lifecycle. Commit the sanitized
`page_review_requested` event before dispatching the worker. Apply the lower of
project limits and page-review caps. Browser observations are unverified clues,
never confirmed finding evidence. The scanner does not inherit the browser login.
Do not add broad extension host permissions, cookie/debugger access, automatic DOM
capture or automatic replay of reviews declined by an AI provider.
Capture must select exactly one active tab in the current window and verify the
browser's actual isolated-script permission before reading DOM metadata. Stored
toolbar-click IDs are not permission and must not gate capture. Never fall back
to another window or an old tab; recheck identity and URL before and after capture
and before review. Browser error diagnostics must contain fixed codes and safe
counts/flags/IDs, never raw browser exceptions, URLs, tokens or page content.

Autopilot must resolve an existing confirmed project, never infer authorization
from a URL. Drain guarded work discovered by final AI reviews before completing a
scan. Persist completion diagnostics. Automatic local report drafts must use saved
evidence, retain researcher verification status, and never submit externally.
Autopilot uses the shared scan budget instead of the regular three-round AI cap.
Keep a bounded, redacted history of completed and denied checks. Stop after the
configured consecutive rounds without fresh completed checks, on exhausted limits,
cancellation or provider refusal/failure. Never add unlimited retries, repeated
target requests or a requirement to keep searching until a finding exists.

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
node --test browser-extension/tests/*.test.mjs
```

Run Compose with one worker execution slot. Increasing worker replicas requires a shared distributed rate/concurrency admission service first. The current conservative executor honors upper bounds by processing target requests serially.

Migration workflow: change models, generate `alembic revision --autogenerate -m ...` inside backend, review the migration, test upgrade/check/downgrade on an isolated database, then `alembic upgrade head`. Production schema changes never run `create_all`; API startup applies migrations before worker startup. Append-only event triggers must remain intact.

End-to-end validation: `docker compose up -d --build`, then `.venv/bin/python scripts/smoke.py`. Never substitute an unrelated live Internet target for the synthetic fixture. Do not enable invasive exploitation, credential use, mass extraction, POST crawling, destructive checks, or uncontrolled discovery.

Page-review validation with the synthetic Compose fixture and AI disabled:
`.venv/bin/python scripts/page_review_smoke.py` and the same command with
`--profile standard`. For browser setup and manual toolbar/side-panel checks, see
`docs/EDGE_PAGE_REVIEW.md`. Cloud-managed browsers may prohibit loading unpacked
extensions; report that limitation and never override administrator policy.
