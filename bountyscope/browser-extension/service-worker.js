/* Opening the toolbar action is the explicit activeTab permission grant. */
function configurePanel() {
  if (!chrome.sidePanel?.setPanelBehavior) return;
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {
    // Unsupported browser versions are explained in the installation guide.
  });
}
configurePanel();
chrome.runtime.onInstalled.addListener(configurePanel);
chrome.runtime.onStartup.addListener(configurePanel);
