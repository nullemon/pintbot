"use client";
import { useState } from "react";
import { Check, Copy, Pause, Play, RefreshCw, ScrollText } from "lucide-react";
import { human, number, useApi } from "@/lib/api";
import type { Page, ScanEvent } from "@/lib/types";
import { Download, Empty, ErrorBox, Loading, Pagination } from "./ui";

const categories = [
  ["all", "All events"], ["ai", "AI"], ["errors", "Errors & warnings"],
  ["requests", "Requests"], ["scope", "Scope"],
] as const;
type Category = typeof categories[number][0];
const pageSize = 100;

function text(data: ScanEvent["data"], ...keys: string[]) {
  for (const key of keys) {
    const value = data[key];
    if (typeof value === "string" && value) return value;
    if (typeof value === "number") return String(value);
  }
  return "";
}

function timestamp(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).format(new Date(value));
}

function tone(event: ScanEvent) {
  if (/failed|error|unavailable/.test(event.kind)) return "error";
  if (/blocked|denied|out_of_scope|retry|fallback|rate_limit|refused/.test(event.kind)) return "warning";
  const status = Number(event.data.status ?? event.data.status_code);
  if (status >= 400) return "warning";
  return event.kind.startsWith("ai_") ? "ai" : "normal";
}

function summary(event: ScanEvent) {
  const data = event.data;
  const target = text(data, "url", "path", "hostname");
  const reason = text(data, "message", "reason", "error_type", "error");
  const task = text(data, "task");
  switch (event.kind) {
    case "ai_provider_started": return `Provider request started${task ? `: ${human(task)}` : ""}. Waiting for a response.`;
    case "ai_provider_completed": return `Provider response validated${task ? `: ${human(task)}` : ""}.`;
    case "ai_provider_retry": return reason || "Retrying the provider request after a recoverable failure.";
    case "ai_provider_failed": return reason || "Provider request or output validation failed.";
    case "ai_provider_refused": return reason || "The provider declined this review. Automatic AI retries have stopped; deterministic scanning can continue.";
    case "ai_review_refused": return reason || "AI review stopped after a provider refusal. Deterministic scanning continues without automatic AI retries.";
    case "ai_progress": return reason || "AI progress updated.";
    case "ai_batch_started": return `Reviewing ${text(data, "observations") || "current"} observations in AI round ${text(data, "round") || "—"}.`;
    case "ai_batch_completed": return `AI round ${text(data, "round") || "—"} completed with ${text(data, "followup_pages") || "0"} follow-up pages.`;
    case "ai_round": return `AI round ${text(data, "round") || "—"} started.`;
    case "ai_action_proposed": return `${human(text(data, "tool", "action") || "safe check")} proposed${target ? ` for ${target}` : ""}.${reason ? ` ${reason}` : ""}`;
    case "ai_action_approved": return `${human(text(data, "tool", "action") || "safe check")} approved${target ? ` for ${target}` : ""}.`;
    case "ai_action_denied": return `Follow-up skipped${target ? `: ${target}` : ""}.${reason ? ` ${reason}` : ""}`;
    case "ai_action_executed": return `${human(text(data, "tool", "action") || "safe check")} completed${target ? `: ${target}` : ""}.`;
    case "ai_finding_analyzed": return `Finding ${text(data, "finding_id").slice(0, 8) || "—"} analyzed in AI round ${text(data, "round") || "—"}.`;
    case "ai_unavailable": return reason || "AI analysis is unavailable; deterministic scanning can continue.";
    case "ai_priority_fallback": return reason || "Using deterministic finding priorities where AI scores are unavailable.";
    case "request_sent": return `${text(data, "method") || "GET"} ${target} — request sent.`;
    case "response_received": return `${text(data, "method") || "GET"} ${target} — HTTP ${text(data, "status") || "—"}.`;
    case "request_error": return `Request failed${target ? `: ${target}` : ""}.${reason ? ` ${reason}` : ""}`;
    case "scope_check": return `${data.allowed ? "Scope approved" : "Scope denied"}${target ? `: ${target}` : ""}.`;
    case "redirect_blocked": return `Redirect blocked${target ? `: ${target}` : ""}.${reason ? ` ${reason}` : ""}`;
    case "discovered_out_of_scope": return `Discovered but skipped${target ? `: ${target}` : ""}.${reason ? ` ${reason}` : ""}`;
    case "stage_changed": return `Scan stage: ${human(text(data, "stage") || "updated")}.`;
    case "scanner_error": return `${human(text(data, "scanner") || "scanner")} failed.${reason ? ` ${reason}` : ""} See event details for the error location.`;
    case "rate_limit_triggered": return `Slowing requests${target ? ` to ${target}` : ""} after HTTP ${text(data, "status") || "—"}.`;
    case "finding_created": return text(data, "title") || `Finding ${text(data, "finding_id").slice(0, 8) || ""} recorded.`;
    case "asset_discovered": return `Asset discovered${target ? `: ${target}` : ""}.`;
    case "scan_cancelled": return "Scan cancellation recorded. No new target requests will be admitted.";
    default: return reason || target || "Open event details for the recorded metadata.";
  }
}

function metadata(event: ScanEvent) {
  const data = event.data;
  const entries = [
    ["Provider", text(data, "provider")], ["Task", text(data, "task")],
    ["Model", text(data, "model")], ["Attempt", text(data, "attempt")],
    ["Schema", text(data, "schema_name", "schema")],
    ["Field", text(data, "field", "field_path")],
    ["HTTP", text(data, "status_code", "http_status")],
    ["Scanner", text(data, "scanner")],
  ].filter(([, value]) => value);
  if (typeof data.elapsed_ms === "number") entries.push(["Elapsed", `${number(data.elapsed_ms)} ms`]);
  if (typeof data.usage_input === "number") entries.push(["Input tokens", number(data.usage_input)]);
  if (typeof data.usage_output === "number") entries.push(["Output tokens", number(data.usage_output)]);
  return entries;
}

function EventRow({ event }: { event: ScanEvent }) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");
  const details = JSON.stringify(event, null, 2);
  async function copy() {
    setCopyError(""); setCopied(false);
    try { await navigator.clipboard.writeText(details); setCopied(true); }
    catch { setCopyError("Clipboard unavailable. Select and copy the JSON below."); }
  }
  const entries = metadata(event);
  return <article className={`live-log-event live-log-${tone(event)}`}>
    <span className="event-marker" aria-hidden="true" />
    <div className="live-log-content">
      <div className="live-log-heading"><h3>{human(event.kind)}</h3><time dateTime={event.created_at} title={event.created_at}>{timestamp(event.created_at)}</time></div>
      <p className="live-log-summary">{summary(event)}</p>
      {!!entries.length && <dl className="live-log-metadata">{entries.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>}
      <details className="live-log-details"><summary>Redacted event details</summary>
        <div className="live-log-copy"><span className="muted small">Event {event.id.slice(0, 8)}</span><button type="button" className="btn btn-ghost btn-small" onClick={copy}>{copied ? <Check size={12} /> : <Copy size={12} />}{copied ? "Copied" : "Copy event"}</button></div>
        {copyError && <p role="status" className="small muted">{copyError}</p>}
        <pre className="code-block">{details}</pre>
      </details>
    </div>
  </article>;
}

export default function LiveLog({ scanId, finished }: { scanId: string; finished: boolean }) {
  const [category, setCategory] = useState<Category>("all");
  const [offset, setOffset] = useState(0);
  const [paused, setPaused] = useState(false);
  const following = !paused && offset === 0 && !finished;
  const events = useApi<Page<ScanEvent>>(`/scans/${scanId}/events?limit=${pageSize}&offset=${offset}&newest_first=true&category=${category}`, following ? 2500 : 0);
  const status = events.error ? "Updates unavailable" : offset > 0 ? "History view · auto-refresh paused" : paused ? "Auto-refresh paused" : finished ? "Scan finished" : "Following latest · every 2.5 seconds";
  function follow() { setOffset(0); setPaused(false); events.refresh(); }
  return <section className="panel panel-flush live-log" aria-labelledby="live-log-title">
    <div className="panel-header live-log-header">
      <div><div className="button-row"><ScrollText size={17} className="muted" /><h2 id="live-log-title">Live log</h2></div><p>Newest events first · provider diagnostics, requests and scope decisions</p></div>
      <div className="button-row">
        <button type="button" className="btn btn-ghost btn-small" onClick={events.refresh} aria-label="Refresh live log"><RefreshCw size={13} />Refresh</button>
        <button type="button" className="btn btn-ghost btn-small" disabled={finished && offset === 0} onClick={following ? () => setPaused(true) : follow}>{following ? <Pause size={13} /> : <Play size={13} />}{following ? "Pause updates" : "Follow latest"}</button>
      </div>
    </div>
    <div className="live-log-toolbar">
      <div className="live-log-filters" role="group" aria-label="Filter log events">{categories.map(([value, label]) => <button type="button" key={value} className={`btn btn-small ${category === value ? "live-log-filter-active" : "btn-ghost"}`} aria-pressed={category === value} onClick={() => { setCategory(value); setOffset(0); }}>{label}</button>)}</div>
      <div role="status" className={`live-log-status ${following && !events.error ? "live-log-following" : "muted"}`}><span aria-hidden="true" className="badge-dot" />{status}</div>
      <p className="small muted">Last successful refresh: {events.updatedAt ? timestamp(events.updatedAt) : "Not yet loaded"}.{events.error && events.data ? " Showing the last successfully loaded page." : ""}</p>
    </div>
    {events.error && <ErrorBox message={events.error} retry={events.refresh} />}
    {events.loading ? <Loading /> : events.data?.items.length ? <>
      <div className="event-list live-log-list">{events.data.items.map((event) => <EventRow key={event.id} event={event} />)}</div>
      <Pagination total={events.data.total} offset={offset} limit={pageSize} onChange={setOffset} />
    </> : !events.error && <Empty title={category === "all" ? "Waiting for events" : "No matching events"} detail={category === "errors" ? "No errors or warnings have been recorded in this scan's event log." : category === "ai" ? "AI provider calls, reviews and follow-up decisions will appear here when recorded." : "Worker activity and scope decisions appear here as the scan progresses."} />}
    <div className="live-log-footer"><p className="small muted">Server-redacted metadata only. Export includes this loaded page, not the full scan log.</p>{!!events.data?.items.length && <Download label="Download loaded page" format="application/json" name={`scan-${scanId.slice(0, 8)}-${category}-events-${offset + 1}.json`} content={JSON.stringify({ scan_id: scanId, category, last_successful_refresh: events.updatedAt, ...events.data }, null, 2)} />}</div>
  </section>;
}
