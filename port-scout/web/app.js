/* Port Scout: dependency-free, local-only browser client. */
'use strict';

const $ = id => document.getElementById(id);
const token = document.querySelector('meta[name="session-token"]').content;
const fmt = number => Number(number || 0).toLocaleString();
const pageSize = 75;
let config = null;
let job = null;
let validated = null;
let validationGeneration = 0;
let previewing = false;
let starting = false;
let polling = false;
let pollTimer = null;
let activeView = 'ports';
let currentPage = 0;
let lastStatus = null;
let toastTimer = null;
let exactHostFilter = null;
const verificationMap = new Map();
let activeVerification = null;
let verificationPollTimer = null;
let verificationPosting = false;
let verificationSession = 0;
let verificationDisplayUrl = '';

const verificationLabels = {
  video_confirmed: 'Video confirmed', video_advertised: 'Video advertised only',
  snapshot_confirmed: 'Snapshot image confirmed', authentication_required: 'Authentication required',
  web_service: 'Web service', rtsp_service: 'RTSP service', ssh_service: 'SSH service', media_response: 'Media response',
  playlist_found: 'Playlist found', tls_untrusted: 'HTTPS certificate untrusted',
  unconfirmed: 'Not confirmed', error: 'Check error', cancelled: 'Check stopped'
};
const verificationHelp = {
  video_confirmed: 'Video data was actually received. This does not verify the camera’s identity or that remote access is configured.',
  video_advertised: 'The service described a video stream, but this check did not receive video data. It is not confirmed video.',
  snapshot_confirmed: 'Image data was received. A still image does not confirm a live video stream.',
  authentication_required: 'The service asks for authentication. Enter your own camera account, then retry the check.',
  web_service: 'A web service responded. A login or web page alone does not confirm a video stream.',
  rtsp_service: 'The service speaks RTSP. Try the camera’s documented stream path and account to look for actual video.',
  ssh_service: 'An SSH server banner was received. SSH provides remote terminal access; it does not confirm camera video.',
  media_response: 'A media response was detected, but the available evidence did not confirm video data.',
  playlist_found: 'A media playlist was found. Finding a playlist alone does not confirm that video data is being delivered.',
  tls_untrusted: 'This HTTPS certificate was not trusted. For your own camera, you can explicitly allow its self-signed certificate and retry.',
  unconfirmed: 'No video was confirmed. Check the private IP, port, protocol, stream path, network connection, and credentials.',
  error: 'The check could not finish. Review the evidence and settings, then retry.',
  cancelled: 'This check was stopped. Any unobserved video remains unconfirmed.'
};

const descriptions = {
  all: 'Checks every TCP port, including camera services on unusual ports.',
  camera: 'A focused list of common camera web, RTSP, and vendor TCP ports.',
  common: 'A quick check of common TCP services. Choose All TCP ports for complete coverage.',
  custom: 'Choose individual TCP ports or inclusive port ranges.'
};

function isActive(snapshot = job) {
  return Boolean(snapshot && ['running', 'cancelling'].includes(snapshot.status));
}

function elapsed(seconds) {
  const whole = Math.max(0, Math.floor(Number(seconds) || 0));
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor(whole / 60) % 60;
  const secs = whole % 60;
  return `${hours ? String(hours).padStart(2, '0') + ':' : ''}${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function showError(message) {
  $('error-text').textContent = message;
  $('error-banner').hidden = false;
}

function clearError() {
  $('error-banner').hidden = true;
}

function toast(message) {
  $('toast').textContent = message;
  $('toast').hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { $('toast').hidden = true; }, 3500);
}

function connected(online) {
  $('connection-label').textContent = online ? 'Local scanner connected' : 'Local scanner disconnected';
  $('connection-label').previousElementSibling.style.background = online ? '' : '#bd7a7a';
}

async function request(path, data) {
  const options = {headers: {'X-Scout-Token': token}, cache: 'no-store'};
  if (data !== undefined) {
    options.method = 'POST';
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(data);
  }
  let response;
  try {
    response = await fetch(path, options);
  } catch (_) {
    connected(false);
    throw new Error('Cannot reach the local scanner. Keep the Python launcher running, then refresh this page.');
  }
  connected(true);
  const body = await response.json().catch(() => ({error: 'The scanner returned an unexpected response.'}));
  if (!response.ok) {
    const error = new Error(body.error || `Request failed (${response.status}).`);
    error.status = response.status;
    throw error;
  }
  return body;
}

function payload() {
  return {
    targets: $('targets').value.trim(),
    ports: $('preset').value === 'custom' ? $('custom-ports').value.trim() : config?.presets[$('preset').value] || '1-65535',
    timeout_ms: Number($('timeout').value),
    concurrency: Number($('concurrency').value),
    retries: Number($('retries').value)
  };
}

function signature() { return JSON.stringify(payload()); }

function updateControls() {
  const busy = isActive() || starting;
  $('scan-inputs').disabled = busy;
  $('preview-button').disabled = !config || busy || previewing;
  $('preview-button').textContent = previewing ? 'Reviewing…' : 'Review targets';
  $('start-button').hidden = busy;
  $('start-button').disabled = !config || !validated || validated.signature !== signature() || previewing || starting;
  $('cancel-button').hidden = !busy;
  $('cancel-button').disabled = starting || job?.status === 'cancelling';
  $('cancel-button').textContent = job?.status === 'cancelling' ? 'Stopping…' : '■ Stop scan';
  const hasJob = Boolean(job?.id);
  $('export-csv').disabled = !hasJob;
  $('export-json').disabled = !hasJob;
  $('manual-verify-button').disabled = !config;
}

function invalidate() {
  validated = null;
  validationGeneration += 1;
  $('scan-plan').hidden = true;
  updateControls();
}

function presetChanged() {
  $('custom-ports-field').hidden = $('preset').value !== 'custom';
  $('custom-ports').required = $('preset').value === 'custom';
  $('preset-description').textContent = descriptions[$('preset').value];
  if (!job) $('port-scope').textContent = {all: 'All TCP', camera: 'Camera', common: 'Common', custom: 'Custom'}[$('preset').value];
  invalidate();
}

async function preview() {
  if (!config || previewing || isActive()) return;
  if (!$('scan-form').reportValidity()) return;
  const generation = ++validationGeneration;
  const input = payload();
  const inputSignature = JSON.stringify(input);
  previewing = true;
  clearError();
  updateControls();
  try {
    const result = await request('/api/preview', input);
    if (generation !== validationGeneration || inputSignature !== signature()) return;
    validated = {signature: inputSignature, result};
    $('plan-title').textContent = 'Targets reviewed';
    $('plan-hosts').textContent = `${fmt(result.host_count)} ${result.host_count === 1 ? 'host' : 'hosts'}`;
    $('plan-detail').textContent = `${fmt(result.port_count)} TCP ports per host · ${fmt(result.total)} checks total`;
    $('plan-warnings').replaceChildren();
    for (const warning of result.warnings || []) {
      const line = document.createElement('p');
      line.textContent = warning;
      $('plan-warnings').append(line);
    }
    $('scan-plan').hidden = false;
    $('announcer').textContent = `${fmt(result.host_count)} targets reviewed. ${fmt(result.total)} TCP port checks. Start scan is ready.`;
  } catch (error) {
    if (generation === validationGeneration) {
      validated = null;
      $('scan-plan').hidden = true;
      showError(error.message);
    }
  } finally {
    previewing = false;
    updateControls();
  }
}

async function start(event) {
  event.preventDefault();
  if (!validated || validated.signature !== signature() || isActive() || starting) return;
  starting = true;
  clearError();
  updateControls();
  try {
    const result = await request('/api/scan', payload());
    currentPage = 0;
    $('result-filter').value = '';
    verificationMap.clear();
    applySnapshot(result.job || result);
    schedulePoll();
    $('announcer').textContent = 'Scan started. Open ports will appear as they are found.';
  } catch (error) {
    showError(error.message);
  } finally {
    starting = false;
    updateControls();
  }
}

async function cancel() {
  if (!job || !isActive() || job.status === 'cancelling') return;
  $('cancel-button').disabled = true;
  try {
    const result = await request('/api/cancel', {id: job.id});
    applySnapshot(result.job || result);
    schedulePoll();
  } catch (error) {
    showError(error.message);
    updateControls();
  }
}

function schedulePoll(delay = 700) {
  clearTimeout(pollTimer);
  if (isActive()) pollTimer = setTimeout(poll, delay);
}

async function poll() {
  if (polling) return;
  polling = true;
  try {
    const result = await request('/api/scan');
    if (result.job) applySnapshot(result.job);
    else if (job) {
      clearTimeout(pollTimer);
      showError('The scanner session was restarted. Refresh the page to connect to the current session.');
      return;
    }
  } catch (error) {
    showError(error.message);
  } finally {
    polling = false;
    schedulePoll();
  }
}

function applySnapshot(snapshot) {
  job = snapshot;
  const previous = lastStatus;
  lastStatus = snapshot.status;
  const percentage = Math.max(0, Math.min(100, Number(snapshot.percent) || 0));
  const rounded = percentage > 0 && percentage < 1 ? '<1' : Math.floor(percentage);
  $('progress-percent').replaceChildren(document.createTextNode(String(rounded)), Object.assign(document.createElement('span'), {textContent: '%'}));
  $('progress-fill').style.width = `${percentage}%`;
  $('progress-track').setAttribute('aria-valuenow', String(percentage));
  const states = {running: 'Scanning', cancelling: 'Stopping', cancelled: 'Stopped', completed: 'Complete', failed: 'Failed'};
  $('scan-state').textContent = states[snapshot.status] || snapshot.status;
  $('scan-state').className = `state-badge ${snapshot.status}`;
  $('progress-title').textContent = {running: 'Exploring your network', cancelling: 'Finishing active connections', cancelled: 'Scan stopped', completed: 'Your scan is complete', failed: 'Scan could not finish'}[snapshot.status] || 'Scan activity';
  $('progress-description').textContent = isActive(snapshot)
    ? `${fmt(snapshot.host_count)} ${snapshot.host_count === 1 ? 'target' : 'targets'} · ${fmt(snapshot.port_count)} ports per host`
    : snapshot.status === 'cancelled' ? 'Partial results are ready to view and export.'
      : snapshot.status === 'failed' ? (snapshot.error || 'Check the connection and settings, then try again.')
        : `${fmt(snapshot.open_count)} open ${snapshot.open_count === 1 ? 'port' : 'ports'} across ${fmt(snapshot.hosts_with_open)} ${snapshot.hosts_with_open === 1 ? 'device' : 'devices'}.`;
  $('checks-count').textContent = `${fmt(snapshot.completed)} / ${fmt(snapshot.total)} checks`;
  $('eta').textContent = isActive(snapshot) && snapshot.eta != null && Number.isFinite(snapshot.eta) ? `ETA ${elapsed(snapshot.eta)}` : 'ETA —';
  $('elapsed').textContent = elapsed(snapshot.elapsed);
  $('scan-rate').textContent = Number(snapshot.rate) > 0 ? fmt(Math.round(snapshot.rate)) : '—';
  $('port-scope').textContent = snapshot.port_spec === '1-65535' ? 'All TCP' : `${fmt(snapshot.port_count)} ports`;
  $('stat-open').textContent = fmt(snapshot.open_count);
  $('stat-devices').textContent = fmt(snapshot.hosts_with_open);
  $('stat-targets').textContent = `Of ${fmt(snapshot.host_count)} ${snapshot.host_count === 1 ? 'target IP' : 'target IPs'}`;
  $('results-total').textContent = fmt(snapshot.open_count);
  if (snapshot.status === 'failed' && snapshot.error) showError(snapshot.error);
  if (previous && previous !== snapshot.status && !isActive(snapshot)) {
    $('announcer').textContent = `${states[snapshot.status] || snapshot.status}. ${fmt(snapshot.open_count)} open ports found.`;
    toast(snapshot.status === 'completed' ? 'Scan complete. Your results are ready.' : snapshot.status === 'cancelled' ? 'Scan stopped. Partial results are available.' : 'Scan ended with an error.');
  }
  updateControls();
  renderResults();
}

function node(tag, text, className) {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  if (className) element.className = className;
  return element;
}

function cell(row, text, className) {
  const result = node('td', text, className);
  row.append(result);
  return result;
}

function copyButton(value) {
  const button = node('button', '⧉', 'copy-button');
  button.type = 'button';
  button.title = `Copy ${value}`;
  button.setAttribute('aria-label', `Copy ${value}`);
  button.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(String(value));
      toast(`Copied ${value}`);
    } catch (_) { toast('Copy is unavailable in this browser. Select the address to copy it.'); }
  });
  return button;
}

function setView(view) {
  activeView = view;
  currentPage = 0;
  for (const name of ['ports', 'hosts']) {
    $(`tab-${name}`).classList.toggle('active', name === view);
    $(`tab-${name}`).setAttribute('aria-selected', String(name === view));
    $(`tab-${name}`).tabIndex = name === view ? 0 : -1;
  }
  $('results-view').setAttribute('aria-labelledby', `tab-${view}`);
  $('device-options').hidden = view !== 'hosts';
  $('result-sort').hidden = view === 'hosts';
  $('result-filter').placeholder = view === 'hosts' ? 'Filter device IP or port…' : 'Filter IP, port, service…';
  renderResults();
}

function portRows() {
  const query = $('result-filter').value.trim().toLowerCase();
  const rows = (job?.results || []).filter(row => exactHostFilter && query === exactHostFilter.toLowerCase()
    ? row.host === exactHostFilter
    : !query || `${row.host} ${row.port} ${row.protocol} ${row.service} ${verificationSearchText(row.host, row.port)}`.toLowerCase().includes(query));
  const sort = $('result-sort').value;
  if (sort === 'latest') rows.reverse();
  else rows.sort((a, b) => sort === 'port'
    ? a.port - b.port || a.host.localeCompare(b.host, undefined, {numeric: true})
    : a.host.localeCompare(b.host, undefined, {numeric: true}) || a.port - b.port);
  return rows;
}

function groupedPorts() {
  const grouped = new Map();
  for (const result of job?.results || []) {
    if (!grouped.has(result.host)) grouped.set(result.host, []);
    grouped.get(result.host).push(result);
  }
  for (const ports of grouped.values()) ports.sort((a, b) => a.port - b.port);
  return grouped;
}

function renderResults() {
  renderVerificationHistory();
  const grouped = activeView === 'hosts' ? groupedPorts() : null;
  const query = $('result-filter').value.trim().toLowerCase();
  let rows;
  if (activeView === 'ports') rows = portRows();
  else rows = (job?.hosts || []).filter(host => {
    if (!$('show-all-hosts').checked && !host.open) return false;
    return !query || `${host.host} ${(grouped.get(host.host) || []).map(port => `${port.port} ${port.service} ${verificationSearchText(host.host, port.port)}`).join(' ')}`.toLowerCase().includes(query);
  }).sort((a, b) => a.host.localeCompare(b.host, undefined, {numeric: true}));
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  currentPage = Math.max(0, Math.min(currentPage, totalPages - 1));
  const start = currentPage * pageSize;
  const visible = rows.slice(start, start + pageSize);
  $('empty-state').hidden = rows.length > 0;
  $('results-table-wrap').hidden = rows.length === 0;
  $('pagination').hidden = rows.length <= pageSize;
  $('previous-page').disabled = currentPage === 0;
  $('next-page').disabled = currentPage >= totalPages - 1;
  $('page-label').textContent = `${currentPage + 1} / ${totalPages}`;
  if (!rows.length) {
    const filtering = Boolean(query);
    $('empty-title').textContent = filtering ? 'No matching results.'
      : !job ? 'Your network has a story.'
        : isActive() ? 'Listening for open connections…'
          : activeView === 'hosts' && !$('show-all-hosts').checked ? 'No devices with open ports found.'
            : 'No open TCP ports found.';
    $('empty-description').textContent = filtering ? 'Try another IP, port, or service name.'
      : !job ? 'Start a scan to see which ports are listening.'
        : isActive() ? 'Results appear as connections succeed. You can inspect all target hosts in the Devices view.'
          : job.status === 'cancelled' ? 'This scan was stopped early. Try again to check the remaining ports.'
            : 'Check the target IP, network or VPN connection, and timeout. “No response” does not prove a port is closed.';
  }
  const headers = activeView === 'ports'
    ? ['Device IP', 'Port / protocol', 'Service hint', 'Connect time', 'Status', 'Verified service']
    : ['Device IP', 'Open TCP ports', 'Verified services', 'Checked', 'Closed', 'No response', 'Errors'];
  const headerRow = node('tr');
  for (const heading of headers) {
    const th = node('th', heading);
    th.scope = 'col';
    headerRow.append(th);
  }
  $('results-head').replaceChildren(headerRow);
  const fragment = document.createDocumentFragment();
  for (const row of visible) {
    const tr = node('tr');
    const address = cell(tr, row.host, 'mono host-address');
    address.append(copyButton(row.host));
    if (activeView === 'ports') {
      const port = cell(tr);
      port.append(node('span', row.port, 'port-number'), node('span', ` / ${row.protocol || 'tcp'}`, 'protocol-label'));
      cell(tr, row.service || 'Unknown');
      cell(tr, `${Number(row.latency_ms || 0).toFixed(1)} ms`, 'mono');
      cell(tr).append(node('span', '● Open', 'open-chip'));
      const verified = cell(tr, undefined, 'verification-cell');
      const check = verificationMap.get(verificationKey(row.host, row.port));
      verified.append(verificationChip(check));
      const action = node('button', check ? 'View / retry check' : 'Check service', 'button secondary compact check-service-button');
      action.type = 'button';
      action.addEventListener('click', () => openVerification(row.host, row.port));
      verified.append(action);
    } else {
      const portsCell = cell(tr, undefined, 'device-port-cell');
      const found = grouped.get(row.host) || [];
      const portList = node('div', undefined, 'device-port-list');
      for (const port of found.slice(0, 8)) {
        const badge = node('span', String(port.port), 'device-port-badge');
        badge.title = `${port.port}/tcp · ${port.service || 'Unknown'} (unverified service hint)`;
        portList.append(badge);
      }
      if (!found.length) portList.append(node('span', row.completed === row.total ? 'None found' : 'Scanning…', 'no-ports'));
      if (found.length) {
        const view = node('button', found.length > 8 ? `+${fmt(found.length - 8)} more · View all` : 'View ports', 'text-button device-view-button');
        view.type = 'button';
        view.addEventListener('click', () => { exactHostFilter = row.host; $('result-filter').value = row.host; setView('ports'); });
        portList.append(view);
      }
      portsCell.append(portList);
      const summary = cell(tr, undefined, 'device-verification-summary');
      const checked = found.map(port => ({port: port.port, snapshot: verificationMap.get(verificationKey(row.host, port.port))})).filter(item => item.snapshot);
      if (!checked.length) summary.append(node('span', 'No services checked', 'no-ports'));
      const verificationList = node('div', undefined, 'verified-device-summary');
      for (const item of checked.slice(0, 5)) {
        const button = node('button', undefined, 'device-verification-action');
        button.type = 'button';
        button.title = `View service check for ${row.host}:${item.port}`;
        button.append(node('span', `${item.port} · `, 'mono'), verificationChip(item.snapshot));
        button.addEventListener('click', () => openVerification(row.host, item.port));
        verificationList.append(button);
      }
      if (checked.length > 5) verificationList.append(node('span', `+${fmt(checked.length - 5)} more in Open ports`, 'no-ports'));
      summary.append(verificationList);
      cell(tr, `${fmt(row.completed)} / ${fmt(row.total)}`, 'mono');
      cell(tr, fmt(row.closed), 'mono');
      cell(tr, fmt(row.timeout), 'mono');
      cell(tr, fmt(row.error), 'mono');
    }
    fragment.append(tr);
  }
  $('results-body').replaceChildren(fragment);
  const unit = activeView === 'ports' ? 'open ports' : 'device IPs';
  $('result-summary').textContent = !job ? 'No scan yet'
    : rows.length ? `${fmt(start + 1)}–${fmt(start + visible.length)} of ${fmt(rows.length)} ${unit}${query ? ' · filtered' : ''}`
      : `0 ${unit}${query ? ' match your filter' : ''}`;
}

async function download(format) {
  if (!job?.id) return;
  const button = $(`export-${format}`);
  button.disabled = true;
  try {
    const response = await fetch(`/api/export?format=${format}&id=${encodeURIComponent(job.id)}`, {headers: {'X-Scout-Token': token}, cache: 'no-store'});
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || 'Could not export this scan.');
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `port-scout-${job.id}.${format}`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    toast(isActive() ? 'Current results exported. The scan is still running.' : 'Results exported.');
  } catch (error) { showError(error.message); }
  finally { updateControls(); }
}

async function importFile(event) {
  const file = event.target.files?.[0];
  if (!file || isActive()) return;
  try {
    if (file.size > 128 * 1024) throw new Error('Use a target text file smaller than 128 KB.');
    const contents = await file.text();
    $('targets').value = [$('targets').value.trim(), contents.trim()].filter(Boolean).join('\n');
    invalidate();
    toast(`Imported ${file.name}. Review targets to validate the list.`);
  } catch (error) { showError(error.message); }
  finally { $('file-input').value = ''; }
}

function verificationKey(host, port) { return `${host}|${Number(port)}`; }

function verificationIsRunning(snapshot = activeVerification) { return snapshot?.status === 'running'; }

function verificationState(snapshot) {
  if (!snapshot) return 'unchecked';
  if (verificationIsRunning(snapshot)) return 'running';
  return snapshot.result?.state || (snapshot.status === 'cancelled' ? 'cancelled' : snapshot.status === 'failed' ? 'error' : 'unconfirmed');
}

function verificationSearchText(host, port) {
  const snapshot = verificationMap.get(verificationKey(host, port));
  return snapshot ? `${verificationLabels[verificationState(snapshot)] || verificationState(snapshot)} ${snapshot.result?.summary || ''}` : '';
}

function verificationChip(snapshot) {
  const state = verificationState(snapshot);
  const tone = ['video_confirmed', 'snapshot_confirmed'].includes(state) ? 'good'
    : ['video_advertised', 'playlist_found', 'media_response'].includes(state) ? 'advertised'
      : ['authentication_required', 'tls_untrusted'].includes(state) ? 'auth'
        : state === 'running' ? 'running' : state === 'error' ? 'error' : 'neutral';
  const label = state === 'unchecked' ? 'Not checked' : state === 'running' ? snapshot.cancel_requested ? 'Stopping…' : 'Checking…' : verificationLabels[state] || state;
  const badge = node('span', label, `verified-chip ${tone}`);
  if (snapshot?.result?.summary) badge.title = snapshot.result.summary;
  return badge;
}

function rememberVerification(snapshot) {
  if (!snapshot?.id || !snapshot.host || !snapshot.port) return snapshot;
  const key = verificationKey(snapshot.host, snapshot.port);
  const existing = verificationMap.get(key);
  if (existing && existing.id !== snapshot.id && Date.parse(existing.created_at) > Date.parse(snapshot.created_at)) return existing;
  if (existing?.id === snapshot.id && !verificationIsRunning(existing) && verificationIsRunning(snapshot)) return existing;
  verificationMap.set(key, snapshot);
  return snapshot;
}

function renderVerificationHistory() {
  const checks = [...verificationMap.values()].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  $('verification-history').hidden = !checks.length;
  const fragment = document.createDocumentFragment();
  for (const snapshot of checks.slice(0, 12)) {
    const button = node('button', undefined, 'verification-history-item');
    button.type = 'button';
    button.append(node('span', `${snapshot.host}:${snapshot.port}`, 'mono'), verificationChip(snapshot));
    button.addEventListener('click', () => openVerification(snapshot.host, snapshot.port));
    fragment.append(button);
  }
  if (checks.length > 12) fragment.append(node('span', `${fmt(checks.length - 12)} older checks are shown on their open-port rows.`, 'verification-history-more'));
  $('verification-history-list').replaceChildren(fragment);
}

function safeVerificationUrl(value) {
  if (!value || typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    if (!['rtsp:', 'http:', 'https:'].includes(url.protocol)) return null;
    url.username = '';
    url.password = '';
    url.hash = '';
    return url;
  } catch (_) { return null; }
}

function updateVerificationControls() {
  const busy = Boolean(verificationPosting) || verificationIsRunning();
  $('verification-inputs').disabled = busy;
  $('verify-start').disabled = busy;
  $('verify-start').textContent = verificationPosting ? 'Starting check…' : verificationIsRunning() ? 'Checking service…' : activeVerification ? 'Retry check' : 'Check service';
  $('verify-cancel').hidden = !verificationIsRunning();
  $('verify-cancel').disabled = Boolean(activeVerification?.cancel_requested);
  $('verify-cancel').textContent = activeVerification?.cancel_requested ? 'Stopping…' : 'Stop check';
}

function renderVerification(snapshot) {
  const previous = activeVerification;
  activeVerification = snapshot;
  $('verification-result').hidden = !snapshot;
  updateVerificationControls();
  if (!snapshot) return;
  const state = verificationState(snapshot);
  const result = snapshot.result;
  $('verification-badge').dataset.state = state;
  $('verification-badge').textContent = state === 'running' ? snapshot.cancel_requested ? 'Stopping check…' : 'Checking service…' : verificationLabels[state] || state;
  $('verification-elapsed').textContent = `${elapsed(snapshot.elapsed)} elapsed`;
  $('verification-summary').textContent = state === 'running' ? `${snapshot.cancel_requested ? 'Stopping check for' : 'Checking'} ${snapshot.host} on port ${snapshot.port}` : result?.summary || snapshot.error || 'The check finished without confirming video.';
  $('verification-status-help').textContent = state === 'running' ? 'Waiting for the service response and, where supported, a short sample of media data. No result is assumed from the port number.' : verificationHelp[state] || verificationHelp.unconfirmed;
  $('verification-evidence').replaceChildren();
  for (const item of result?.evidence || []) $('verification-evidence').append(node('li', String(item)));
  if (snapshot.error && !result?.evidence?.includes(snapshot.error)) $('verification-evidence').append(node('li', snapshot.error));
  $('verification-video-metrics').replaceChildren();
  $('verification-video-metrics').hidden = state !== 'video_confirmed' || !result?.video;
  if (state === 'video_confirmed' && result?.video) {
    const video = result.video;
    if (video.codec) $('verification-video-metrics').append(node('span', `Codec: ${video.codec}`));
    if (video.packets != null) $('verification-video-metrics').append(node('span', `${fmt(video.packets)} video packets`));
    if (video.bytes != null) $('verification-video-metrics').append(node('span', `${fmt(video.bytes)} media bytes`));
  }
  const url = safeVerificationUrl(result?.url);
  verificationDisplayUrl = url?.href || '';
  $('verification-link-box').hidden = !url;
  $('verification-viewer-help').hidden = true;
  $('verification-open-url').hidden = true;
  $('verification-open-url').removeAttribute('href');
  $('verification-url').textContent = verificationDisplayUrl;
  $('verification-copy-url').textContent = url?.protocol === 'rtsp:' ? 'Copy RTSP URL' : 'Copy URL';
  if (url?.protocol === 'rtsp:') {
    $('verification-viewer-help').hidden = false;
    $('verification-viewer-help').textContent = 'Open in VLC: choose Media → Open Network Stream (macOS: File → Open Network), then paste this URL. Enter your camera account in VLC if prompted. Your browser cannot play raw RTSP.';
  } else if (url && ['http:', 'https:'].includes(url.protocol)) {
    $('verification-open-url').href = url.href;
    $('verification-open-url').hidden = false;
    $('verification-open-url').textContent = state === 'snapshot_confirmed' ? 'Open snapshot ↗' : 'Open page ↗';
  }
  if (!verificationIsRunning(snapshot) && (previous?.id !== snapshot.id || verificationIsRunning(previous))) {
    $('verification-auth').removeAttribute('open');
    requestAnimationFrame(() => {
      if ($('verification-dialog').open && activeVerification?.id === snapshot.id) $('verification-result').scrollIntoView({block: 'nearest', behavior: 'auto'});
    });
  }
}

function selectVerificationPathPreset() {
  const path = $('verify-path').value;
  $('verify-path-preset').value = path === '/' ? 'root' : path === '/Streaming/Channels/101' ? 'hikvision' : path === '/cam/realmonitor?channel=1&subtype=0' ? 'dahua' : 'custom';
}

function openVerification(host = '', port = 554) {
  verificationSession += 1;
  clearTimeout(verificationPollTimer);
  verificationPosting = false;
  $('verification-error').hidden = true;
  $('verify-host').value = host;
  $('verify-port').value = port;
  $('verify-mode').value = 'auto';
  $('verify-path').value = '/';
  $('verify-username').value = '';
  $('verify-password').value = '';
  $('verify-self-signed').checked = false;
  $('verification-auth')?.removeAttribute('open');
  const existing = verificationMap.get(verificationKey(host, port));
  const url = safeVerificationUrl(existing?.result?.url);
  if (url) {
    $('verify-path').value = `${url.pathname || '/'}${url.search}`;
    $('verify-mode').value = url.protocol.slice(0, -1);
  }
  selectVerificationPathPreset();
  renderVerification(existing || null);
  if (!$('verification-dialog').open) $('verification-dialog').showModal();
  if (existing && verificationIsRunning(existing)) scheduleVerificationPoll();
}

function showVerificationError(message) {
  $('verification-error').textContent = message;
  $('verification-error').hidden = false;
}

function closeVerification() { $('verification-dialog').close(); }

function cleanupVerification() {
  const snapshot = activeVerification;
  verificationSession += 1;
  clearTimeout(verificationPollTimer);
  verificationPosting = false;
  $('verify-username').value = '';
  $('verify-password').value = '';
  activeVerification = null;
  if (verificationIsRunning(snapshot)) {
    request('/api/verify/cancel', {id: snapshot.id}).then(response => {
      rememberVerification(response.verification);
      renderResults();
      if (verificationIsRunning(response.verification)) watchStoppedVerification(snapshot.id);
    }).catch(error => { toast(`Could not stop the service check: ${error.message}`); });
  }
}

async function startVerification(event) {
  event.preventDefault();
  if (verificationPosting || verificationIsRunning() || !$('verification-form').reportValidity()) return;
  const session = verificationSession;
  const input = {host: $('verify-host').value.trim(), port: Number($('verify-port').value), mode: $('verify-mode').value,
    path: $('verify-path').value.trim(), username: $('verify-username').value, password: $('verify-password').value,
    timeout_ms: 2500, allow_self_signed: $('verify-self-signed').checked};
  verificationPosting = session;
  $('verification-error').hidden = true;
  updateVerificationControls();
  try {
    const response = await request('/api/verify', input);
    const snapshot = rememberVerification(response.verification);
    if (!snapshot) throw new Error('The scanner did not return a service check. Please retry.');
    renderResults();
    if (session !== verificationSession || !$('verification-dialog').open) {
      if (verificationIsRunning(snapshot)) {
        const stopped = await request('/api/verify/cancel', {id: snapshot.id});
        rememberVerification(stopped.verification);
        renderResults();
        if (verificationIsRunning(stopped.verification)) watchStoppedVerification(snapshot.id);
      }
      return;
    }
    renderVerification(snapshot);
    scheduleVerificationPoll();
  } catch (error) {
    if (session === verificationSession && $('verification-dialog').open) showVerificationError(error.message);
  } finally {
    input.username = '';
    input.password = '';
    if (verificationPosting === session) verificationPosting = false;
    if (session === verificationSession) updateVerificationControls();
  }
}

function scheduleVerificationPoll(delay = 700) {
  clearTimeout(verificationPollTimer);
  if ($('verification-dialog').open && verificationIsRunning()) verificationPollTimer = setTimeout(pollVerification, delay);
}

async function pollVerification() {
  const session = verificationSession;
  const id = activeVerification?.id;
  if (!id || !$('verification-dialog').open) return;
  try {
    const response = await request(`/api/verify?id=${encodeURIComponent(id)}`);
    const snapshot = rememberVerification(response.verification);
    renderResults();
    if (session !== verificationSession || !$('verification-dialog').open) return;
    $('verification-error').hidden = true;
    renderVerification(snapshot);
    if (!verificationIsRunning(snapshot)) $('announcer').textContent = `Service check: ${verificationLabels[verificationState(snapshot)] || 'completed'}. ${snapshot.result?.summary || ''}`;
  } catch (error) {
    if (session === verificationSession && $('verification-dialog').open) {
      if (error.status === 404) {
        if (verificationMap.get(verificationKey(activeVerification.host, activeVerification.port))?.id === id) verificationMap.delete(verificationKey(activeVerification.host, activeVerification.port));
        renderVerification({...activeVerification, status: 'failed', error: 'This service check is no longer available. A new scan may have replaced it. You can retry the check.'});
        renderResults();
      } else showVerificationError(`${error.message} Status will retry automatically while this dialog is open.`);
    }
  } finally {
    if (session === verificationSession) scheduleVerificationPoll();
  }
}

function watchStoppedVerification(id, attempts = 0) {
  if (attempts >= 30) return;
  setTimeout(async () => {
    try {
      const response = await request(`/api/verify?id=${encodeURIComponent(id)}`);
      rememberVerification(response.verification);
      renderResults();
      if (verificationIsRunning(response.verification)) watchStoppedVerification(id, attempts + 1);
    } catch (_) { /* A new scan can replace cancelled checks. */ }
  }, 700);
}

async function cancelVerification() {
  if (!verificationIsRunning()) return;
  const session = verificationSession;
  $('verify-cancel').disabled = true;
  try {
    const response = await request('/api/verify/cancel', {id: activeVerification.id});
    const snapshot = rememberVerification(response.verification);
    renderResults();
    if (session === verificationSession && $('verification-dialog').open) { renderVerification(snapshot); scheduleVerificationPoll(); }
  } catch (error) {
    if (session === verificationSession) { showVerificationError(error.message); updateVerificationControls(); }
  }
}

function openGuide() { $('guide-dialog').showModal(); }
function closeGuide() { $('guide-dialog').close(); }
$('open-guide').addEventListener('click', openGuide);
$('heading-help').addEventListener('click', openGuide);
$('travel-help').addEventListener('click', openGuide);
$('close-guide').addEventListener('click', closeGuide);
$('guide-done').addEventListener('click', closeGuide);
$('guide-dialog').addEventListener('click', event => { if (event.target === $('guide-dialog')) { const rect = event.target.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeGuide(); } });
$('dismiss-error').addEventListener('click', clearError);
$('preset').addEventListener('change', presetChanged);
for (const id of ['targets', 'custom-ports', 'timeout', 'concurrency', 'retries']) $(id).addEventListener('input', invalidate);
$('file-input').addEventListener('change', importFile);
$('import-button').addEventListener('click', () => $('file-input').click());
$('example-button').addEventListener('click', () => {
  $('targets').value = '192.168.1.100\n192.168.1.110-125\n# Or scan your own home subnet:\n# 192.168.1.0/24';
  invalidate();
  $('targets').focus();
  toast('Example added. Replace it with your camera IP or your home subnet.');
});
$('preview-button').addEventListener('click', preview);
$('scan-form').addEventListener('submit', start);
$('cancel-button').addEventListener('click', cancel);
$('tab-ports').addEventListener('click', () => setView('ports'));
$('tab-hosts').textContent = 'Devices';
$('tab-hosts').addEventListener('click', () => setView('hosts'));
$('tab-ports').parentElement.addEventListener('keydown', event => { if (['ArrowLeft', 'ArrowRight'].includes(event.key)) { event.preventDefault(); setView(activeView === 'ports' ? 'hosts' : 'ports'); $(`tab-${activeView}`).focus(); } });
$('show-all-hosts').addEventListener('change', () => { currentPage = 0; renderResults(); });
$('result-filter').addEventListener('input', () => { exactHostFilter = null; currentPage = 0; renderResults(); });
$('result-sort').addEventListener('change', () => { currentPage = 0; renderResults(); });
$('previous-page').addEventListener('click', () => { currentPage -= 1; renderResults(); });
$('next-page').addEventListener('click', () => { currentPage += 1; renderResults(); });
$('export-csv').addEventListener('click', () => download('csv'));
$('export-json').addEventListener('click', () => download('json'));
$('manual-verify-button').addEventListener('click', () => openVerification());
$('close-verification').addEventListener('click', closeVerification);
$('verification-done').addEventListener('click', closeVerification);
$('verification-dialog').addEventListener('close', cleanupVerification);
$('verification-form').addEventListener('submit', startVerification);
$('verify-cancel').addEventListener('click', cancelVerification);
$('verify-path-preset').addEventListener('change', () => {
  const preset = $('verify-path-preset').value;
  if (preset === 'root') $('verify-path').value = '/';
  else if (preset === 'hikvision') { $('verify-path').value = '/Streaming/Channels/101'; $('verify-mode').value = 'rtsp'; }
  else if (preset === 'dahua') { $('verify-path').value = '/cam/realmonitor?channel=1&subtype=0'; $('verify-mode').value = 'rtsp'; }
  if (!verificationIsRunning() && !verificationPosting) renderVerification(null);
  if (preset === 'custom') $('verify-path').focus();
});
for (const id of ['verify-host', 'verify-port', 'verify-mode', 'verify-path']) $(id).addEventListener('input', () => {
  if (id === 'verify-path') selectVerificationPathPreset();
  if (!verificationIsRunning() && !verificationPosting) renderVerification(null);
});
$('verification-copy-url').addEventListener('click', async () => {
  if (!verificationDisplayUrl) return;
  try { await navigator.clipboard.writeText(verificationDisplayUrl); toast('Camera URL copied without credentials.'); }
  catch (_) { showVerificationError('Clipboard access is unavailable. Select the displayed URL to copy it.'); }
});

function restoreInputs(snapshot) {
  $('targets').value = (snapshot.hosts || []).map(host => host.host).join('\n');
  const preset = Object.keys(config.presets || {}).find(name => config.presets[name] === snapshot.port_spec);
  $('preset').value = preset || 'custom';
  if (!preset) $('custom-ports').value = snapshot.port_spec || '';
  if (snapshot.settings) {
    $('timeout').value = snapshot.settings.timeout_ms;
    $('concurrency').value = snapshot.settings.concurrency;
    $('retries').value = snapshot.settings.retries;
  }
  presetChanged();
}

async function initialize() {
  updateControls();
  try {
    config = await request('/api/config');
    for (const snapshot of config.verifications || []) rememberVerification(snapshot);
    renderVerificationHistory();
    $('version').textContent = `PORT SCOUT / v${config.version || '1.0'}`;
    if (config.limits) $('limits-help').textContent = `A session supports up to ${fmt(config.limits.max_hosts)} targets and ${fmt(config.limits.max_checks)} port checks. Results remain in memory until the scanner is restarted or replaced by a new scan. Export anything you want to keep.`;
    if (config.active_job) {
      restoreInputs(config.active_job);
      applySnapshot(config.active_job);
      schedulePoll();
    } else {
      const result = await request('/api/scan');
      if (result.job) { restoreInputs(result.job); applySnapshot(result.job); schedulePoll(); }
    }
  } catch (error) {
    connected(false);
    showError(error.message);
  } finally { updateControls(); }
}
initialize();
