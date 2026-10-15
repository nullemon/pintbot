import { capturePageMetadata } from "./collector.mjs";
import { validateTabURL } from "./client.mjs";

export const targetKey = (windowId) => `captureTarget:${windowId}`;

const accessMessage = "Edge did not allow access to this page. Close the panel, click the BountyScope extension icon on the website tab, and retry. Browser-protected pages cannot be inspected.";
const changedMessage = "The selected tab changed or is navigating. Wait for the page to finish loading, click its BountyScope extension icon, and capture again.";

export class TabAccessError extends Error {
  constructor(code, message, diagnostics) {
    super(`${message} [${code}]`);
    this.name = "TabAccessError";
    this.code = code;
    this.diagnostics = { ...diagnostics, code };
  }
}

// This permission-checked probe reads only the URL. No DOM metadata is read
// until validateTabURL has accepted it, even when Edge omits tabs.Tab.url.
export function readPageURL() {
  return location.href;
}

export function createTabAccess(browser) {
  let diagnostics;
  function failure(code, message) { return new TabAccessError(code, message, diagnostics); }

  async function selected() {
    let tabs;
    diagnostics = { stage: "select_active_tab", selection: "current_window" };
    try {
      // A session record of a toolbar click is not browser authorization. It
      // may be missing or stale in Edge. Never let it select or reject a tab.
      // Do not fall back to a different window or a previously selected tab.
      tabs = await browser.tabs.query({ active: true, currentWindow: true });
    } catch {
      throw failure("TAB_QUERY_FAILED", "Edge could not identify this window’s active tab. Check the extension’s browser permissions.");
    }
    diagnostics.active_tabs = Array.isArray(tabs) ? tabs.length : 0;
    if (!Array.isArray(tabs) || !tabs.length) {
      throw failure("NO_ACTIVE_TAB", "Edge returned no active tab in this window. Open the website in an ordinary browser tab.");
    }
    if (tabs.length !== 1) {
      throw failure("AMBIGUOUS_TAB", "Edge returned multiple active tabs. Select one target in an ordinary tab view and capture again.");
    }
    const tab = tabs[0];
    if (!Number.isInteger(tab?.id) || tab.id < 0 || !Number.isInteger(tab.windowId) || tab.windowId < 0 || tab.active !== true) {
      throw failure("NO_ACTIVE_TAB", "Edge returned no usable active tab. Select the website tab and capture again.");
    }
    Object.assign(diagnostics, { tab_id: tab.id, window_id: tab.windowId, url_available: typeof tab.url === "string" && Boolean(tab.url) });
    if (tab.status === "loading" || tab.pendingUrl) throw failure("TAB_LOADING", changedMessage);
    return tab;
  }

  async function execute(tabId, func) {
    diagnostics.stage = func === readPageURL ? "verify_page_access" : "capture_metadata";
    try {
      return await browser.scripting.executeScript({
        target: { tabId, frameIds: [0] },
        func,
      });
    } catch {
      // Browser errors may include a credential-bearing target URL. Never echo
      // their text into the panel, logs, API or persisted session settings.
      throw failure("PAGE_ACCESS_DENIED", accessMessage);
    }
  }

  function validate(url) {
    try { validateTabURL(url); }
    catch (cause) {
      // validateTabURL emits fixed, credential-free errors; browser exceptions
      // themselves are never propagated into diagnostics.
      throw failure("URL_REJECTED", cause.message);
    }
  }

  async function current(expected) {
    const tab = await selected();
    if (expected && (tab.id !== expected.id || tab.windowId !== expected.windowId
        || tab.url && expected.url && tab.url !== expected.url)) throw failure("TAB_CHANGED", changedMessage);
    if (typeof tab.url === "string" && tab.url) validate(tab.url);
    // The browser's actual scripting grant is authoritative. A visible URL or
    // a stored toolbar record cannot substitute for permission, even at Start.
    const results = await execute(tab.id, readPageURL);
    const url = results?.find((result) => result.frameId === 0)?.result;
    validate(url);
    if (expected?.url && url !== expected.url) throw failure("TAB_CHANGED", changedMessage);
    if (tab.url && tab.url !== url) throw failure("TAB_CHANGED", changedMessage);
    const after = await selected();
    if (after.id !== tab.id || after.windowId !== tab.windowId
        || after.url && after.url !== url) throw failure("TAB_CHANGED", changedMessage);
    return { id: tab.id, windowId: tab.windowId, url };
  }

  async function capture() {
    const tab = await current();
    const results = await execute(tab.id, capturePageMetadata);
    const metadata = results?.find((result) => result.frameId === 0)?.result;
    if (!metadata?.url) throw failure("NO_METADATA", "Edge returned no page metadata. Reload the extension and capture again.");
    validate(metadata.url);
    const after = await current(tab);
    if (after.id !== tab.id || after.windowId !== tab.windowId || after.url !== tab.url
        || metadata.url !== tab.url) throw failure("TAB_CHANGED", changedMessage);
    return { tabId: tab.id, windowId: tab.windowId, metadata };
  }

  return { current, capture };
}
