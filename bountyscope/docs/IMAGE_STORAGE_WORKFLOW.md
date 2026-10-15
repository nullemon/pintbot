# Find and review image exposure

**Only scan systems you own or are explicitly authorized to test.**

Paste a normal **`https://` page URL** into **Autopilot** at
**http://localhost:3000/autopilot**, then choose **Directories, exposed files,
media and source maps**. A matching project must already have confirmed
authorization. If several projects match, select the intended project explicitly.
For a review beside the page in Edge, use the
[Edge side-panel guide](EDGE_PAGE_REVIEW.md); that mode reviews one page rather
than starting a broader site assessment.

The scanner discovers public image/resource references, inventoried JavaScript
references and observed parent directories. It can identify an open directory
index and retain a small filename sample, content metadata and redacted evidence.
It does not discover every backend file, infer private bucket names or download
the image collection.

## Which URL and scope to use

Start with the authorized page that displays or references the images, such as
`https://app.research.example/gallery/`. If you already know a public upload
directory, it can also be a starting URL. Example names here are illustrative.

Add a CDN or viewer hostname to the project only when the program authorizes
testing it. An allowed application hostname does not automatically authorize a
separate CDN, storage provider or redirect destination. `*.research.example`
does not include the apex `research.example`; add the apex separately if allowed.
The scanner logs skipped references and never treats a discovered URL as new
permission.

After starting, inspect **Scans → your scan** for progress and the completion
reason. Use **Assets** for observed hosts and **Endpoints** to search `/uploads/`,
`/wp-content/`, `/media/` or an observed image path. These inventory entries are
not vulnerability findings by themselves. Open a directory/file finding to review
its response evidence, entry count/sample, confidence and affected locations.

## Autopilot rounds and stopping

Autopilot can continue beyond three AI rounds. Each round may propose at most
`AI_MAX_ACTIONS_PER_ROUND` checks, with a hard ceiling of 20. Every proposed check
must use an existing safe tool, pass ScopeGuard and fit the scan's original HTTP
request budget, URL cap, depth/rate limits and cancellation state. It cannot
expand scope or execute arbitrary model-generated commands.

By default, **three consecutive rounds without fresh completed checks stop AI
review**. That is a no-progress stop condition, not a three-round total limit.
Repeated, denied or failed checks do not create new progress. To choose a different
threshold, add this to your existing `.env` (accepted range 1–10):

```dotenv
AI_AUTOPILOT_NO_PROGRESS_ROUNDS=3
```

Do not overwrite your existing `.env` with the example file. Regular scans and
Edge/dashboard page reviews still use `AI_MAX_ROUNDS`, with a maximum of three.
AI is optional; disabling it leaves deterministic checks available. Provider
refusal/failure stops further automatic AI calls for the scan while deterministic
work continues. Cancellation stops new target requests.

The request budget is an upper bound, not an instruction to use every request.
A scan can finish early when no permitted work remains. More AI rounds can incur
more provider usage; the HTTP request budget is not a spending cap for provider
requests. **Why this scan finished** and **Live log → AI** show recorded progress
and stopping decisions.

## When an image URL begins with `blob:`

A URL such as `blob:https://app.research.example/…` is a handle to an object held
by that browser context. It is not a public backend URL that another HTTP client
can fetch. The origin in that handle identifies the page's origin, not necessarily
the image's storage server.

For an authorized manual check in Edge:

1. Open the page, press **F12**, and choose **Network**.
2. Reload the page with Network recording enabled.
3. Inspect **Img** requests and **Fetch/XHR** requests. A script may fetch bytes
   before creating the displayed blob, so there may be no direct Img request for
   that handle.
4. Inspect a relevant request's **Initiator**, URL, status and content type to
   understand which script or public resource produced it.
5. If you identify a public HTTP(S) resource on a hostname authorized for testing,
   use that page/resource URL as a scanner starting point or review its observed
   parent directory. Keep private or credential-bearing URLs out of scanner
   inputs and reports.

There may be no standalone public source: the image might be generated in the
browser, assembled from other data, decrypted locally, or delivered through an
authenticated endpoint. A network request visible in your signed-in browser does
not establish unauthenticated access. The backend scanner makes separate public
requests and does not inherit the tab's login.

The Edge extension's `activeTab` permission captures bounded URL metadata after
your click, including already-recorded public resource URLs when the browser
makes them available. These can provide clues to a fetch/XHR image loader's URL;
they are unverified references, not a live network interception or a guaranteed
mapping from a blob to its source. The extension cannot read blob bytes or
authenticated response bodies, discover private buckets or extract browser credentials.
It does not bypass access controls or mass-download media.

## What belongs in a report

A reachable storage host, a public image, a predictable filename or a blob handle
alone is not a vulnerability. Look for supported exposure such as an unintended
directory index or publicly reachable configuration/source indicators. Confirm
intended access policy and impact manually before marking a finding verified.
Retain only the minimum redacted metadata and filename sample needed to show the
exposure; do not extract credentials or download other users' media.

Autopilot creates local Markdown/HTML drafts for eligible evidence-backed
findings. Review and edit them before submission. It never submits reports or
changes verification status automatically.

## Update on Windows

Cancel running scans before replacing worker code. From **Command Prompt**:

```cmd
cd /d "%USERPROFILE%\Documents\pintbot"
git pull --ff-only origin claude/beautiful-bell-x8lnfs
cd bountyscope
notepad .env
docker compose up -d --build api worker frontend
docker compose ps
start http://localhost:3000/autopilot
```

Keep your current credentials and provider/model settings in `.env`; add the
optional no-progress setting above if you want to configure it. Save and close
Notepad before the Compose command. Refresh the dashboard after the rebuild. For
the unpacked Edge extension, also click **Reload** at `edge://extensions` and
reopen its panel. Existing scans keep the configuration and events recorded when
they ran; start a new assessment to use the updated behavior.

To follow sanitized live diagnostics:

```cmd
docker compose logs -f --tail=100 --timestamps worker api
```

Press Ctrl+C to stop viewing logs; containers continue running.
