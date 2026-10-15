# BountyScope Page Review for Microsoft Edge

Review the current authorized page beside the page itself. This Manifest V3 extension uses Edge’s side panel and your running **local** BountyScope stack. Keep Edge updated; the equivalent Chromium Side Panel API requires Chromium 116 or newer.

**Only scan systems you own or are explicitly authorized to test.**

## Install on Windows

1. Update and start BountyScope in Command Prompt:

   ```cmd
   cd /d "%USERPROFILE%\Documents\pintbot"
   git pull --ff-only origin claude/beautiful-bell-x8lnfs
   cd bountyscope
   docker compose up -d --build
   start http://localhost:3000
   ```

2. Create an authorized project in the dashboard. Add exact hosts or wildcard rules, any separately authorized CDN, allowed ports, and exclusions. A wildcard such as `*.example.test` does not include the root `example.test`; add the root separately if authorized.
3. In Edge, open `edge://extensions`, turn on **Developer mode**, choose **Load unpacked**, and select:

   ```text
   C:\Users\Admin\Documents\pintbot\bountyscope\browser-extension
   ```

   If your Windows account is different, use its actual Documents folder. Select the folder containing `manifest.json`, not an individual file.
4. Open Edge’s Extensions menu and pin **BountyScope Page Review** to the toolbar.

After future Git updates, use **Reload** on the extension’s card in `edge://extensions`, then reopen its panel. Provider settings and keys remain in the backend `.env`.

## Review a page in the same window

1. Open your authorized HTTP/HTTPS target in an Edge tab. Click the BountyScope toolbar icon **on that target tab**. The side panel opens beside it and the click grants temporary access to that tab.
2. In **Local connection**, choose `http://localhost:3000` (or `http://127.0.0.1:3000`). Paste the local `API_TOKEN` from BountyScope’s `.env` into **Local API token** and click **Connect**. This is **not** your Anthropic/OpenAI API key.
3. Select **Authorized project**. Inspect its allowed hosts and project authorization summary; use **Edit scope** if needed.
4. Choose **Checks**. **Exposure** focuses on directories, files and media. **Standard** adds the existing safe security checks; **Passive** inspects responses with lower impact.
5. Click **1. Capture this page’s metadata**. Inspect the captured URL and reference count. Capture is explicit; opening the panel or navigating never automatically reads page metadata.
6. Optionally enter a concise **review focus**, such as “Prioritize public file indexes and media parent directories supported by observed URLs.” Focus cannot override scope, request limits or allowed scanner actions.
7. Check **I am authorized to test these assets.** Click **2. Start page review**.
8. Follow **Live review** counters, AI status, and AI/warning events. Open a finding to inspect redacted evidence and confidence, save your verification status, then download a **Markdown report** or **HTML report**. Verify every report before submission.

Only one review is launched from this panel at a time. **Cancel review** stops new backend requests. Closing the panel or browser does **not** cancel a running backend scan. Reopening the panel and connecting during the same browser session restores its last review. You can also open **Full scan** in the dashboard.

If capture says access was not granted, click the extension toolbar icon again on the actual target tab, then capture again. A permission grant does not automatically transfer to a different tab or origin. Browser-protected pages such as `edge://`, `chrome://`, local files, extension pages, and some browser-managed pages cannot be reviewed. A navigation invalidates the snapshot; capture again before starting another review.

## What is inspected

The extension captures the page URL, up to 200 URL references from links/scripts/styles/images/media/iframes/canonical links/forms/API attributes, aggregate form/password/file-input counts, and the browser’s secure-context flag. It also inspects up to the latest 500 entries already present in the page’s Resource Timing buffer, reading only their resource URL and initiator type. This can reveal an HTTP(S) image/CDN URL or fetch/XHR API endpoint used by a JavaScript image loader even when it is absent from the current DOM. Scripts, media, and recorded resource clues are prioritized before navigation links; the shared encoded context remains capped at 50 KB and 200 references. Reference query strings and fragments are removed. The target URL is preserved for explicit backend validation; credential-bearing or sensitive target URLs are rejected rather than silently changed.

A `blob:` image is a browser-local object URL, not a public storage address. The extension does not read blob contents, infer a bucket from a blob UUID, or replay its authenticated download. If the HTTP(S) request that supplied it is still present in Resource Timing, its sanitized URL can become an unverified discovery clue. If the application generated the image locally, cleared the timing buffer, loaded it in an inaccessible frame/worker, or proxies a private storage service, the underlying storage URL may be unavailable. Capture after the relevant image has loaded. No origin/CDN clue is itself a vulnerability; only backend scope-approved checks and retained evidence can establish an exposure. Fetch/XHR entries without a recognizable media extension remain API inventory clues, rather than proof that an image or publicly accessible file exists.

It never captures page text, HTML, input values, cookies, browser storage, authorization headers, or login credentials. It does not load target URLs or submit forms. The backend uses separate **unauthenticated** requests through ScopeGuard, DNS/IP checks, redirect checks, rate limiting, and the shared request budget. Your browser login session is not transferred. Metadata supplied by the tab is untrusted discovery context, never proof that a vulnerability exists.

Page reviews are capped at **200 requests**, **80 URLs**, **one crawl level**, and **2 requests/sec**, or the project’s lower limits. Observed references and their parent directories inform the review; this mode does not launch a whole-site sweep. Out-of-scope references are recorded as skipped. It does not promise to find every vulnerability or brute force hidden files.

AI is optional and runs only through the configured server provider and existing enumerated safe tools. A provider refusal remains visible and stops automatic AI retries for that review. Deterministic scanning continues. Switching models or rewriting the request is not an automatic fallback for refusals.

## Connection and privacy

- Only the exact local origins `http://localhost:3000` and `http://127.0.0.1:3000` are supported. Remote dashboard addresses, alternate ports, and arbitrary destinations are intentionally rejected.
- `API_TOKEN` is held in `chrome.storage.session`, which clears when the browser session ends. It is not saved in synced storage or extension local storage. **Forget token** removes it immediately. The current scan ID is also session-only; DOM snapshots remain in panel memory.
- The extension requests `activeTab`, `scripting`, `sidePanel`, `storage`, and access to the two local dashboard origins. It has no `<all_urls>`, cookies, debugger, or request interception permission, and no automatic content scripts.
- A connection failure usually means Docker is stopped, port 3000 is unavailable, or the local API token differs from `.env`. Check the dashboard and run:

  ```cmd
  docker compose ps
  docker compose logs -f --tail=100 --timestamps api worker
  ```

## Developer checks

No extension build step or third-party packages are required. From this folder, using Node.js 22 or newer:

```cmd
node --test tests/*.test.mjs
node --check panel.mjs
node --check collector.mjs
node --check client.mjs
node --check service-worker.js
```

Tests cover capture minimization, forbidden data access, URL and origin restrictions, reference deduplication/caps, request credential handling, error rendering inputs, and manifest permissions. Final browser permission behavior should also be checked manually in Edge after loading unpacked.
