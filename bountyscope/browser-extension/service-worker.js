/* The toolbar gesture selects the target and grants temporary activeTab access. */
function configurePanel() {
  if (!chrome.sidePanel?.setPanelBehavior) return;
  const failed = () => {
    console.warn("BountyScope could not configure the side panel. Reload the extension or update Edge.");
  };
  try { chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(failed); }
  catch { failed(); }
}
configurePanel();
chrome.runtime.onInstalled.addListener(configurePanel);
chrome.runtime.onStartup.addListener(configurePanel);

chrome.action.onClicked.addListener((tab) => {
  if (!Number.isInteger(tab?.id) || tab.id < 0 || !Number.isInteger(tab.windowId) || tab.windowId < 0) return;
  if (!chrome.sidePanel?.open) {
    console.warn("BountyScope requires an Edge version supporting extension side panels.");
    return;
  }
  // Open synchronously in the action event: awaiting storage first can lose the
  // browser's user gesture. This does not inject a script or capture a document.
  const openFailed = () => {
    console.warn("BountyScope could not open its side panel. Click its toolbar icon again.");
  };
  try { chrome.sidePanel.open({ windowId: tab.windowId }).catch(openFailed); }
  catch { openFailed(); return; }
  // Store only selection identifiers, never the page URL, content or credentials.
  const saveFailed = () => {
    console.warn("BountyScope could not remember the selected tab. Reload the extension and retry.");
  };
  try {
    chrome.storage.session.set({
      [`captureTarget:${tab.windowId}`]: { tabId: tab.id, windowId: tab.windowId },
    }).catch(saveFailed);
  } catch { saveFailed(); }
});
