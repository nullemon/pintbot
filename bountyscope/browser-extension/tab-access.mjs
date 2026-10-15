import { capturePageMetadata } from "./collector.mjs";
import { validateTabURL } from "./client.mjs";

export const targetKey = (windowId) => `captureTarget:${windowId}`;

const selectMessage = "On the website tab, click the pinned BountyScope extension icon, then capture again. Opening Edge’s sidebar does not grant page access.";
const accessMessage = "Edge did not allow access to this page. Close the panel, click the BountyScope extension icon on the website tab, and retry. Browser-protected pages cannot be inspected.";
const changedMessage = "The selected tab changed or is navigating. Wait for the page to finish loading, click its BountyScope extension icon, and capture again.";

// This permission-checked probe reads only the URL. No DOM metadata is read
// until validateTabURL has accepted it, even when Edge omits tabs.Tab.url.
export function readPageURL() {
  return location.href;
}

export function createTabAccess(browser) {
  async function selected() {
    let window, tabs, saved, tab;
    try {
      window = await browser.windows.getCurrent();
      if (!Number.isInteger(window?.id) || window.id < 0) throw new Error();
      tabs = await browser.tabs.query({ active: true, windowId: window.id });
      saved = await browser.storage.session.get(targetKey(window.id));
    } catch {
      throw new Error(selectMessage);
    }
    const binding = saved?.[targetKey(window.id)];
    if (!Number.isInteger(binding?.tabId) || binding.tabId < 0
        || binding.windowId !== window.id || tabs?.[0]?.id !== binding.tabId) {
      throw new Error(selectMessage);
    }
    try { tab = await browser.tabs.get(binding.tabId); }
    catch { throw new Error(changedMessage); }
    if (tab.id !== binding.tabId || tab.windowId !== window.id || tab.active !== true
        || tab.status === "loading" || tab.pendingUrl) {
      throw new Error(changedMessage);
    }
    return tab;
  }

  async function execute(tabId, func) {
    try {
      return await browser.scripting.executeScript({
        target: { tabId, frameIds: [0] },
        func,
      });
    } catch {
      // Browser errors may include a credential-bearing target URL. Never echo
      // their text into the panel, logs, API or persisted session settings.
      throw new Error(accessMessage);
    }
  }

  async function current() {
    const tab = await selected();
    let url = tab.url;
    if (typeof url !== "string" || !url) {
      const results = await execute(tab.id, readPageURL);
      url = results?.find((result) => result.frameId === 0)?.result;
      validateTabURL(url);
      const after = await selected();
      if (after.id !== tab.id || after.windowId !== tab.windowId
          || after.url && after.url !== url) throw new Error(changedMessage);
    } else validateTabURL(url);
    return { id: tab.id, windowId: tab.windowId, url };
  }

  async function capture() {
    const tab = await current();
    const results = await execute(tab.id, capturePageMetadata);
    const metadata = results?.find((result) => result.frameId === 0)?.result;
    if (!metadata?.url) throw new Error("Edge returned no page metadata. Reload the extension and capture again.");
    validateTabURL(metadata.url);
    const after = await current();
    if (after.id !== tab.id || after.windowId !== tab.windowId || after.url !== tab.url
        || metadata.url !== tab.url) throw new Error(changedMessage);
    return { tabId: tab.id, windowId: tab.windowId, metadata };
  }

  return { current, capture };
}
