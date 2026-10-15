# Review an Edge tab beside the page

**Only scan systems you own or are explicitly authorized to test.**

BountyScope can review one page while you keep that page open in Microsoft Edge. The unpacked extension opens an Edge side panel in the same window. It captures a bounded list of resource URLs and form counts from the current tab after you click it. The backend checks the public page and selected resources through the same scope, DNS, rate, budget and redaction controls as a normal scan.

This is a bounded page review, not a claim that every vulnerability has been tested. It does not exploit the application, submit forms, guess passwords, enumerate every file or download media collections. AI can explain and prioritize observed evidence and propose existing safe checks; its suggestions do not expand project authorization.

## 1. Update and start BountyScope

Cancel running scans before replacing worker code. In **Windows Command Prompt**, run:

```cmd
cd /d "%USERPROFILE%\Documents\pintbot"
git pull --ff-only origin claude/beautiful-bell-x8lnfs
cd bountyscope
docker compose up -d --build api worker frontend
docker compose ps
start http://localhost:3000
```

Your existing `.env` remains in place. Do not copy `.env.example` over an already configured `.env`. The API, worker and frontend should be running; the API should be healthy. For startup or AI diagnostics:

```cmd
docker compose logs -f --tail=100 --timestamps worker api
```

Press Ctrl+C to stop following logs; containers keep running.

## 2. Define the authorized project

In the dashboard, create a project or edit an existing project's scope. Add each authorized hostname explicitly, including a separate CDN or viewer hostname if the program permits testing it. For example:

```text
Allow domain: research.example
Allow domain: cdn.research.example
Allow domain: viewer.research.example
Allow port: 443
```

These are examples, not targets to scan. `*.research.example` authorizes matching subdomains only when you deliberately add that wildcard; it does not include `research.example` itself. A page link to a third-party host never grants permission to request it. Add program exclusions and confirm authorization before saving. Public targets should leave private-network access disabled.

## 3. Load the Edge extension

Use an up-to-date desktop Microsoft Edge with side-panel extension support.

1. Open **`edge://extensions`** in Edge.
2. Turn on **Developer mode**.
3. Click **Load unpacked**.
4. Select this folder, using the folder picker:

   ```text
   C:\Users\Admin\Documents\pintbot\bountyscope\browser-extension
   ```

   Replace `Admin` if your Windows account uses a different name. Select the folder containing `manifest.json`, not the repository root.

5. Pin **BountyScope** from Edge's Extensions menu so its toolbar button is visible.
6. Keep Docker and the local dashboard running.

The extension is a local unpacked developer installation; it is not published in the Edge Add-ons store. After a future `git pull`, click **Reload** on its card at `edge://extensions`, then close and reopen its panel.

If Edge says unpacked extensions are disabled by your administrator, use the
dashboard split-screen option below or ask your device administrator about the
policy. The cloud validation browser has that restriction; automated coverage
includes collector/privacy tests, a Chromium panel flow with simulated extension
interfaces, and the real Docker API/worker workflow. The toolbar permission grant
and native Edge panel still need a check on your permitted local browser.

## 4. Review the active tab

Open a page you are authorized to test, then click the BountyScope toolbar button on that tab. Clicking grants temporary access to that tab's page metadata. In **Local connection**, keep **Dashboard address** as `http://localhost:3000` (or `http://127.0.0.1:3000`), enter **Local API token**, and click **Connect**. Choose the **Authorized project** and review profile, then click **1. Capture this page’s metadata**. Check the preview URL/reference/form counts before entering an **Optional review focus**, such as:

> Review this page and its observed resources for directory indexes, enumerable uploaded media, source-map exposure and configuration concerns. Use the existing evidence, respect exclusions, and identify what requires manual verification.

Confirm the displayed target and **I am authorized to test these assets.**, then click **2. Start page review**. Click the toolbar button again on each new target tab before capturing it; access is granted by that click, not globally. Browser settings and extension pages cannot be captured. Results and activity appear beside the page. **Cancel review** stops new request admission; **Full scan** opens its dashboard details. Open a finding to inspect redacted evidence, update its verification status and download a Markdown or HTML report. The extension uses the project's saved scope, not the wording in the focus box, to authorize requests.

Use the `API_TOKEN` from your local `.env` when the panel asks to connect. It is the same bearer token used by dashboard Settings, **not** an Anthropic or OpenAI key. The extension stores it in browser session storage and connects only to the local dashboard/API proxy. Provider credentials stay in the backend's environment. Closing the browser clears session credentials; enter the token again when prompted. **Forget token** removes it immediately. Do not paste it into the page under review.

Choose **Exposure** for directory, file and media indicators; **Standard** also reviews relevant headers, cookies, CORS, cache and disclosure signals. **Passive** inspects the page and inventories references without active resource/follow-up probes. The focus text is advisory and cannot enable unrestricted tools or exploitation.

## What the review accesses

A page review has a maximum of **200 requests**, **80 inventoried URLs**, **depth 1**, **2 requests/second** and **3 host concurrency**. Lower project limits still apply. The executor remains serial in this MVP. All AI checks share these limits and the original request budget.

The backend fetches the chosen page; selected observed scripts, source-map metadata and media metadata may also be checked. Directory tests derive from observed resource parent paths and are bounded. Standard and Exposure also perform the existing two curated configuration checks, `/.env` and `/.git/HEAD`, on authorized observed origins, reading at most 512 bytes per response and retaining only redacted indicators; repositories and configuration values are not collected. Ordinary page links, form actions, iframe URLs and API references are inventory hints rather than a site-wide crawl. Page review does not start the normal robots/sitemap or common-directory seed discovery. Out-of-scope references are skipped and recorded.

The extension sends only the current URL, bounded reference URLs, form/password-field/file-input counts and whether the browser reports a secure context. It does **not** send raw HTML, text inputs, field values, passwords, cookies, authorization headers, browser storage or screenshots. It does not click the page or submit forms. Captured metadata is untrusted and unverified; confirmed HTTP findings require guarded backend evidence.

**A logged-in Edge tab does not authenticate the backend scanner.** It makes separate unauthenticated requests from Docker. Logged-in-only issues, DOM execution, browser storage issues, application business logic and full exploit verification remain manual work. A browser-only page that cannot be reached by the backend may yield little evidence. Never add credentials or secret-bearing URLs to make it accessible.

## AI status and refusals

Enable AI using `.env` on the server and recreate `api` and `worker` when changing its configuration. Page review still works with AI disabled. It does not require a provider key in Edge.

To explicitly choose OpenAI for future reviews, open the local file:

```cmd
cd /d "%USERPROFILE%\Documents\pintbot\bountyscope"
notepad .env
```

Set these values, replacing the key placeholder locally:

```dotenv
AI_ENABLED=true
AI_PROVIDER=openai
OPENAI_API_KEY=replace_with_your_openai_api_key
OPENAI_MODEL=gpt-4.1
```

The model is configurable; use an API model your OpenAI project can access. Save the file, then run:

```cmd
docker compose up -d --force-recreate api worker
docker compose exec worker python -m app.intelligence.diagnose
```

The last command checks configuration without sending a paid request. Add `--test` for one short billable connectivity request, or `--structured` to validate the production structured-output path using synthetic observations. An OpenAI API key and API billing are separate from a ChatGPT subscription. Never paste either provider's key into the extension or a review's focus field.

Provider selection is an explicit configuration choice for future reviews, not an automatic fallback for a refused review. BountyScope does not replay refused content to another provider. Live paid-provider behavior must be verified with your own account; the automated fixture smoke check keeps AI disabled.

A provider may decline a particular review even when credit and credentials are valid. BountyScope records **Provider declined review**, stops further automatic AI calls for that review and continues deterministic checks and report generation. It does not rewrite the request or change providers to work around that decision. Read **Live log → AI** or **Errors & warnings** for the sanitized outcome. Connectivity or structured-output diagnostics are separate from acceptance of a target review.

## Dashboard alternative without installing an extension

Open **Page review** in the BountyScope sidebar at **http://localhost:3000/page-review**. Select a project, paste the full authorized page URL including `https://`, choose the profile, enter an optional focus and confirm authorization. This uses the same bounded backend review but has no captured browser metadata.

Keep the target and dashboard beside each other with **Windows Snap** (`Win+Left` / `Win+Right`) or Edge's Split screen feature where available. BountyScope does not embed third-party pages in an iframe; sites' frame protections remain intact. The extension's side panel is the option for keeping a review beside the active tab in one Edge window.

## Synthetic local test

The Compose fixture is safe fake data. Create a project allowing `example.test`, port `8080` and private infrastructure. In dashboard Page review, use:

```text
http://example.test:8080/directory/
```

The backend resolves `example.test` inside Docker. Your Windows browser normally cannot open that internal hostname. To inspect the fake page in Edge, open **http://localhost:8088/directory/** beside the dashboard review. Keep the review target as the internal URL above; loopback remains blocked as a scanner destination. The extension reviews its tab's exact URL, so use the dashboard alternative for this Docker hostname example rather than attempting to authorize `localhost`.

From a Python developer environment with the backend dependencies installed and **AI disabled**, run the dedicated real-stack check:

```bash
.venv/bin/python scripts/page_review_smoke.py
```

On Windows with a corresponding virtual environment:

```cmd
.venv\Scripts\python.exe scripts\page_review_smoke.py
```

The check creates only a synthetic fixture project. It verifies bounded requests, directory evidence, source-map metadata, no media GET downloads, no ordinary-link crawling, skipped external references, browser metadata provenance and both report formats. It leaves the synthetic project/results available in the dashboard.
