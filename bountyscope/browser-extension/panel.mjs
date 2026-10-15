import { isTerminal, localOrigin, makeReviewBody, requestAPI } from "./client.mjs";
import { createTabAccess } from "./tab-access.mjs";

const tabAccess = createTabAccess(chrome);

const $ = (id) => document.getElementById(id);
const state = {
  origin: "http://localhost:3000", token: "", connected: false, projects: [], projectTotal: 0,
  project: null, projectRevision: 0, snapshot: null, tabID: null, tabWindowID: null, scan: null, finding: null,
  findingsOffset: 0, timer: null, polling: false, busy: false, closed: false,
  requests: new Set(), savedReview: null,
};

function showMessage(id, value = "") {
  $(id).textContent = value;
  $(id).hidden = !value;
}
function error(cause) {
  if (cause?.name !== "AbortError" && !state.closed) {
    showMessage("error", cause instanceof Error ? cause.message : "The operation failed.");
    if (cause?.name === "TabAccessError") {
      $("capture-diagnostics-data").textContent = JSON.stringify({ extension_version: chrome.runtime?.getManifest?.().version || "unknown", ...cause.diagnostics }, null, 2);
      $("capture-diagnostics").hidden = false;
      $("capture-diagnostics").open = true;
    }
  }
}
function node(tag, text = "", className = "") {
  const element = document.createElement(tag);
  element.textContent = String(text ?? "");
  if (className) element.className = className;
  return element;
}
function identifier(value) {
  if (typeof value !== "string" || !/^[a-z0-9-]{1,100}$/i.test(value)) throw new Error("The API returned an invalid identifier.");
  return encodeURIComponent(value);
}
function human(value) { return String(value ?? "").replaceAll("_", " "); }
function setLink(id, path) { $(id).href = state.origin + path; }
function updateLinks() {
  setLink("dashboard-link", "/"); setLink("projects-link", "/projects"); setLink("findings-link", "/findings");
}
function updateControls() {
  $("capture").disabled = !state.connected || state.busy;
  $("refresh-projects").disabled = !state.connected || state.busy;
  $("project").disabled = !state.connected || !state.projects.length || state.busy;
  const active = state.scan && !isTerminal(state.scan.status);
  $("review").disabled = !state.connected || state.busy || active || !state.snapshot || !state.project?.authorization_confirmed || !$("authorized").checked;
  $("more-projects").hidden = !state.connected || state.projects.length >= state.projectTotal;
  $("more-projects").disabled = state.busy;
  $("cancel").disabled = !active || state.busy;
}
function clearSnapshot(message = "") {
  state.snapshot = null; state.tabID = null; state.tabWindowID = null;
  $("snapshot").hidden = true; $("authorized").checked = false;
  updateControls();
  if (message) showMessage("notice", message);
}
function stopPolling() { clearTimeout(state.timer); state.timer = null; }
function abortRequests() { for (const controller of state.requests) controller.abort(); }

async function call(path, options = {}) {
  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, 20000);
  state.requests.add(controller);
  try { return await requestAPI(state.origin, state.token, path, { ...options, signal: controller.signal }); }
  catch (cause) {
    if (cause?.status === 401) {
      state.connected = false; stopPolling();
      $("connection").open = true; $("connection-state").textContent = "Access token rejected";
      updateControls();
    }
    if (timedOut) {
      throw new Error("The local API request timed out. Use Refresh to try again.");
    }
    throw cause;
  } finally { clearTimeout(timeout); state.requests.delete(controller); }
}

async function chooseProject() {
  const revision = ++state.projectRevision;
  const projectID = $("project").value;
  state.project = null; $("authorized").checked = false; updateControls();
  if (!projectID) return;
  $("project-summary").textContent = "Loading scope and authorization…";
  const project = await call(`/api/projects/${identifier(projectID)}`);
  if (revision !== state.projectRevision) return;
  state.project = project;
  const allowed = (Array.isArray(project.scope) ? project.scope : []).filter((rule) => rule.enabled && ["allow_domain", "allow_wildcard"].includes(rule.rule_type)).map((rule) => String(rule.value));
  $("project-summary").textContent = `${project.authorization_confirmed ? "Authorization confirmed." : "Project authorization is not confirmed; edit the project first."} Allowed: ${allowed.slice(0, 6).join(", ") || "no allowed domains"}${allowed.length > 6 ? ` (+${allowed.length - 6} more)` : ""}. Exclusions take precedence. Review limit: ${Math.min(200, project.request_budget || 200)} requests; ${Math.min(2, project.max_rps || 2)} requests/sec.`;
  setLink("projects-link", `/projects/${identifier(projectID)}`);
  updateControls();
}

async function loadProjects(append = false) {
  const previous = $("project").value;
  const offset = append ? state.projects.length : 0;
  const result = await call(`/api/projects?limit=50&offset=${offset}`);
  if (!Array.isArray(result?.items)) throw new Error("The API returned an invalid project list.");
  state.projects = append ? [...state.projects, ...result.items.filter((item) => !state.projects.some((existing) => existing.id === item.id))] : result.items;
  state.projectTotal = Number(result.total) || 0;
  $("project").replaceChildren(...state.projects.map((project) => {
    const option = node("option", project.name); option.value = project.id; return option;
  }));
  if (!state.projects.length) {
    const option = node("option", "Create a project in the dashboard first"); option.value = ""; $("project").append(option);
  } else if (state.projects.some((project) => project.id === previous)) $("project").value = previous;
  await chooseProject(); updateControls();
}

async function connect(event) {
  event.preventDefault(); showMessage("error"); showMessage("notice");
  $("capture-diagnostics").hidden = true;
  state.busy = true; updateControls(); $("connect").disabled = true;
  stopPolling(); abortRequests();
  try {
    state.origin = localOrigin($("origin").value);
    const entered = $("token").value.trim();
    if (entered) state.token = entered;
    await chrome.storage.session.set({ origin: state.origin, apiToken: state.token });
    $("token").value = ""; $("token").placeholder = state.token ? "Saved for this browser session" : "API_TOKEN from your .env";
    await call("/api/settings"); state.connected = true;
    await loadProjects();
    updateLinks(); $("connection-state").textContent = "Connected"; $("connection").open = false;
    showMessage("notice", "Connected. On the target tab, click the BountyScope toolbar button, then capture page metadata.");
    if (state.savedReview?.origin === state.origin && state.savedReview?.scan_id) {
      try {
        const scan = await call(`/api/scans/${identifier(state.savedReview.scan_id)}`);
        state.scan = scan; state.findingsOffset = 0; renderScan(scan); await refreshScan();
      } catch (cause) {
        if (cause?.status === 404) {
          state.savedReview = null; state.scan = null;
          await chrome.storage.session.remove("activeReview");
          showMessage("notice", "Connected. The previous review no longer exists; capture a page to start a new one.");
        } else throw cause;
      }
    }
  } catch (cause) { state.connected = false; $("connection-state").textContent = "Connection failed"; error(cause); }
  finally { state.busy = false; $("connect").disabled = false; updateControls(); }
}

async function capture() {
  state.busy = true; clearSnapshot(); showMessage("error"); showMessage("notice");
  $("capture-diagnostics").hidden = true;
  try {
    const { tabId, windowId, metadata } = await tabAccess.capture();
    state.snapshot = metadata; state.tabID = tabId; state.tabWindowID = windowId;
    $("page-url").textContent = metadata.url;
    $("page-counts").textContent = `${metadata.references.length} URL references · ${metadata.forms.total} forms · ${metadata.forms.password_fields} password inputs · metadata only`;
    $("snapshot").hidden = false;
    showMessage("notice", "Snapshot captured. Select your project and checks, confirm authorization, then start review.");
  } catch (cause) { error(cause); }
  finally { state.busy = false; updateControls(); }
}

async function startReview() {
  state.busy = true; updateControls(); showMessage("error"); showMessage("notice");
  try {
    if (!state.snapshot) throw new Error("Capture the target page before starting a review.");
    const tab = await tabAccess.current({ id: state.tabID, windowId: state.tabWindowID, url: state.snapshot.url });
    if (!state.snapshot || tab.id !== state.tabID || tab.url !== state.snapshot.url) {
      clearSnapshot(); throw new Error("The active tab or URL changed. Capture the target page again before review.");
    }
    const body = makeReviewBody($("project").value, state.snapshot, $("profile").value, $("focus").value, $("authorized").checked);
    const scan = await call("/api/page-reviews", { method: "POST", body });
    identifier(scan?.id); state.scan = scan; state.findingsOffset = 0; state.finding = null;
    $("finding-detail").hidden = true;
    state.savedReview = { origin: state.origin, scan_id: scan.id };
    await chrome.storage.session.set({ activeReview: state.savedReview });
    renderScan(scan); showMessage("notice", "Page review started. You may keep browsing; no further DOM capture happens automatically.");
    await refreshScan();
  } catch (cause) { error(cause); }
  finally { state.busy = false; updateControls(); }
}

function renderScan(scan) {
  $("scan-section").hidden = false; $("findings-section").hidden = false;
  $("scan-status").textContent = human(scan.status); $("scan-target").textContent = scan.target;
  setLink("scan-link", `/scans/${identifier(scan.id)}`);
  const values = [
    ["Requests", `${scan.requests_sent ?? 0}/${scan.limits?.request_budget ?? 200}`],
    ["Assets", scan.assets_found ?? 0], ["URLs", scan.endpoints_found ?? 0], ["Findings", scan.findings_found ?? 0],
  ];
  $("scan-counters").replaceChildren(...values.map(([label, value]) => { const card = node("div", "", "metric"); card.append(node("strong", value), node("span", label)); return card; }));
  const progress = scan.ai_progress;
  $("ai-status").className = `notice${["refused", "unavailable"].includes(progress?.status) ? " warning" : ""}`;
  if (progress?.status === "refused") {
    $("ai-status").textContent = "Provider declined this review; deterministic scanning continues. Automatic AI retries stopped. Available account credit does not override a provider refusal.";
  } else if (progress) {
    const rounds = progress.round_policy === "budget" || progress.max_rounds === null
      ? `${progress.round ?? 0} · scan budget`
      : `${progress.round ?? 0}/${progress.max_rounds ?? 3}`;
    $("ai-status").textContent = `AI ${human(progress.status)} · round ${rounds}. ${progress.message || ""} Approved ${progress.actions_approved ?? 0}; denied ${progress.actions_denied ?? 0}; analyzed ${progress.findings_analyzed ?? 0}.`;
  } else $("ai-status").textContent = "AI status is not available yet. Deterministic checks do not require an AI key.";
  updateControls();
}

function renderEvents(results) {
  const events = [...new Map(results.flatMap((result) => result.items || []).map((event) => [event.id, event])).values()]
    .sort((left, right) => String(right.created_at).localeCompare(String(left.created_at))).slice(0, 30);
  $("events").replaceChildren(...events.map((event) => {
    const card = node("div", "", "event"); const when = new Date(event.created_at);
    card.append(node("time", Number.isNaN(when.valueOf()) ? "" : when.toLocaleTimeString()), node("strong", ` · ${human(event.kind)}`));
    const data = event.data || {};
    const message = [data.message || data.reason, data.task, data.scanner, data.model, data.elapsed_ms === undefined ? "" : `${data.elapsed_ms} ms`].filter((value) => typeof value === "string" || typeof value === "number").join(" · ");
    if (message) card.append(node("p", message.slice(0, 800)));
    return card;
  }));
  if (!events.length) $("events").append(node("p", "No AI or warning events yet.", "hint"));
}

function renderFindings(page) {
  const items = Array.isArray(page.items) ? page.items : [];
  $("findings-count").textContent = `${page.total || 0} findings · ${items.length ? state.findingsOffset + 1 : 0}–${state.findingsOffset + items.length}. Findings require manual verification.`;
  $("findings").replaceChildren(...items.map((finding) => {
    const button = node("button", "", "finding-button"); button.type = "button";
    const badges = node("div", "", "row"); badges.append(node("span", finding.severity, `badge severity-${["critical", "high", "medium", "low", "informational"].includes(finding.severity) ? finding.severity : "informational"}`), node("span", `${finding.confidence}% confidence`, "hint"));
    button.append(badges, node("strong", finding.title), node("p", finding.affected_url, "mono"), node("p", human(finding.status), "hint"));
    button.addEventListener("click", () => void openFinding(finding.id).catch(error)); return button;
  }));
  if (!items.length) $("findings").append(node("p", "No findings on this page of results. This does not establish that the target is free of vulnerabilities.", "hint"));
  $("findings-previous").disabled = state.findingsOffset === 0;
  $("findings-next").disabled = state.findingsOffset + items.length >= Number(page.total || 0);
}

async function refreshScan() {
  stopPolling();
  if (!state.scan || !state.connected || state.polling || state.closed) return;
  state.polling = true;
  try {
    const scanID = identifier(state.scan.id);
    const scan = await call(`/api/scans/${scanID}`); state.scan = scan; renderScan(scan);
    const offset = state.findingsOffset;
    const results = await Promise.allSettled([
      call(`/api/scans/${scanID}/events?category=ai&newest_first=true&limit=15&offset=0`),
      call(`/api/scans/${scanID}/events?category=errors&newest_first=true&limit=15&offset=0`),
      call(`/api/findings?scan_id=${scanID}&focus=all&sort=priority&limit=10&offset=${offset}`),
    ]);
    const events = results.slice(0, 2).filter((result) => result.status === "fulfilled").map((result) => result.value);
    if (events.length) renderEvents(events);
    if (results[2].status === "fulfilled" && offset === state.findingsOffset) renderFindings(results[2].value);
    const failures = results.filter((result) => result.status === "rejected");
    if (failures.length) { $("updated").textContent = "Some live data could not refresh. Displayed results may be stale."; error(failures[0].reason); }
    else $("updated").textContent = `Last updated ${new Date().toLocaleTimeString()}${isTerminal(scan.status) ? " · review finished" : " · updates every 2.5 seconds"}`;
  } catch (cause) { $("updated").textContent = "Live refresh failed. Displayed results may be stale."; error(cause); }
  finally {
    state.polling = false;
    if (!state.closed && state.connected && state.scan && !isTerminal(state.scan.status)) state.timer = setTimeout(refreshScan, 2500);
  }
}

async function openFinding(findingID) {
  const finding = await call(`/api/findings/${identifier(findingID)}`); state.finding = finding;
  $("finding-detail").hidden = false; $("finding-title").textContent = finding.title;
  $("finding-meta").replaceChildren(node("span", human(finding.severity), "badge"), node("span", `${finding.confidence}% confidence`, "hint"));
  $("finding-url").textContent = finding.affected_url; $("finding-description").textContent = finding.description;
  $("finding-recommendation").textContent = `Remediation: ${finding.recommendation || "Review the full finding."}`;
  $("finding-status").value = finding.status;
  setLink("finding-link", `/findings/${identifier(finding.id)}`);
  $("evidence").replaceChildren(...(finding.evidence || []).slice(0, 10).map((evidence) => {
    const card = node("article", "", "evidence-card"); card.append(node("h3", `Redacted evidence · ${human(evidence.type)}`));
    if (evidence.redacted_excerpt) card.append(node("pre", evidence.redacted_excerpt));
    const details = node("details"); details.append(node("summary", "Request and response metadata"), node("pre", JSON.stringify({ request: evidence.request_metadata, response: evidence.response_metadata, body_sha256: evidence.body_sha256 }, null, 2).slice(0, 12000)));
    card.append(details); return card;
  }));
  if (!finding.evidence?.length) $("evidence").append(node("p", "No retained evidence is available. Check retention and the full finding before reporting.", "hint"));
  $("finding-detail").scrollIntoView({ behavior: "smooth", block: "start" });
}

async function saveFinding() {
  if (!state.finding) return;
  $("save-finding").disabled = true;
  try {
    await call(`/api/findings/${identifier(state.finding.id)}`, { method: "PATCH", body: { status: $("finding-status").value } });
    showMessage("notice", "Researcher status saved."); await refreshScan();
  } finally { $("save-finding").disabled = false; }
}

async function downloadReport(format) {
  if (!state.finding) return;
  $("report-markdown").disabled = true; $("report-html").disabled = true;
  try {
    const report = await call("/api/reports", { method: "POST", body: { finding_id: state.finding.id, format } });
    if (typeof report.content !== "string") throw new Error("The API returned an invalid report.");
    const url = URL.createObjectURL(new Blob([report.content], { type: format === "html" ? "text/html;charset=utf-8" : "text/markdown;charset=utf-8" }));
    const link = node("a"); link.href = url; link.download = `bountyscope-${identifier(state.finding.id)}.${format === "html" ? "html" : "md"}`;
    document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    showMessage("notice", "Evidence-based report downloaded. Verify observations before submitting.");
  } finally { $("report-markdown").disabled = false; $("report-html").disabled = false; }
}

$("connection-form").addEventListener("submit", connect);
$("forget").addEventListener("click", () => {
  state.connected = false; state.token = ""; stopPolling(); abortRequests(); clearSnapshot();
  $("token").value = ""; $("token").placeholder = "API_TOKEN from your .env"; $("connection-state").textContent = "Token forgotten";
  void chrome.storage.session.remove("apiToken").catch(error); showMessage("notice", "Token removed from this browser session. Running backend scans continue; cancel from the dashboard if needed."); updateControls();
});
$("project").addEventListener("change", () => void chooseProject().catch(error));
$("refresh-projects").addEventListener("click", () => void loadProjects().catch(error));
$("more-projects").addEventListener("click", () => void loadProjects(true).catch(error));
$("authorized").addEventListener("change", updateControls);
$("capture").addEventListener("click", capture);
$("review").addEventListener("click", startReview);
$("refresh-scan").addEventListener("click", () => { showMessage("error"); void refreshScan(); });
$("cancel").addEventListener("click", () => {
  if (!state.scan) return;
  state.busy = true; updateControls();
  void call(`/api/scans/${identifier(state.scan.id)}/cancel`, { method: "POST" }).then((scan) => {
    state.scan = scan; renderScan(scan); stopPolling(); return refreshScan();
  }).catch(error).finally(() => { state.busy = false; updateControls(); });
});
$("findings-previous").addEventListener("click", () => { state.findingsOffset = Math.max(0, state.findingsOffset - 10); void refreshScan(); });
$("findings-next").addEventListener("click", () => { state.findingsOffset += 10; void refreshScan(); });
$("close-finding").addEventListener("click", () => { state.finding = null; $("finding-detail").hidden = true; });
$("save-finding").addEventListener("click", () => void saveFinding().catch(error));
$("report-markdown").addEventListener("click", () => void downloadReport("markdown").catch(error));
$("report-html").addEventListener("click", () => void downloadReport("html").catch(error));
chrome.tabs.onActivated.addListener(({ tabId, windowId }) => {
  if (state.snapshot && windowId === state.tabWindowID && tabId !== state.tabID) clearSnapshot("Active tab changed. Capture the target tab again before starting another review.");
});
chrome.tabs.onUpdated.addListener((tabID, changes) => {
  if (state.snapshot && tabID === state.tabID && (changes.status === "loading" || changes.url && changes.url !== state.snapshot.url)) clearSnapshot("The captured page navigated. Capture it again before starting another review.");
});
window.addEventListener("pagehide", () => { state.closed = true; stopPolling(); abortRequests(); });

$("extension-version").textContent = `Extension ${chrome.runtime?.getManifest?.().version || "unknown"}`;

try {
  const saved = await chrome.storage.session.get(["origin", "apiToken", "activeReview"]);
  if (saved.origin) { state.origin = localOrigin(saved.origin); $("origin").value = state.origin; updateLinks(); }
  if (typeof saved.apiToken === "string") { state.token = saved.apiToken; $("token").placeholder = "Saved for this browser session"; }
  state.savedReview = saved.activeReview || null;
} catch { showMessage("notice", "Session settings could not be restored. Connect to the local dashboard to continue."); }
