"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, ArrowRight, CircleAlert, Clock3, Plus, Radar, ScanLine, ShieldCheck, Square, Target } from "lucide-react";
import { api, date, human, number, useApi } from "@/lib/api";
import type { Finding, Page, Project, Scan } from "@/lib/types";
import { Badge, Empty, ErrorBox, Loading, Modal, Pagination } from "./ui";
import { PageHeading } from "./workspace";
import AIActivity from "./ai-progress";
import LiveLog from "./live-log";

export default function Scans() {
  const [offset, setOffset] = useState(0);
  const [launch, setLaunch] = useState(false);
  const scans = useApi<Page<Scan>>(`/scans?limit=20&offset=${offset}`, 5000);
  return <><PageHeading title="Scans" description="Launch controlled assessments and follow every request."><Link className="btn btn-ghost" href="/page-review"><ScanLine size={15} />Review a page</Link><button className="btn btn-primary" onClick={() => setLaunch(true)}><Plus size={16} />New scan</button></PageHeading>
    {scans.error && <ErrorBox message={scans.error} retry={scans.refresh} />}
    <section className="panel panel-flush"><div className="panel-header"><div><h2>Scan history</h2><p>{scans.data ? `${number(scans.data.total)} assessments in this workspace` : "Your assessment activity"}</p></div><span className="status-metric muted"><Clock3 size={13} />Updates every 5 seconds</span></div>
    {scans.loading ? <Loading /> : scans.data?.items.length ? <><div className="table-wrap"><table><thead><tr><th>Target</th><th>Profile</th><th>Status</th><th>Requests</th><th>Findings</th><th>Started</th><th /></tr></thead><tbody>{scans.data.items.map((scan) => <tr key={scan.id}><td><Link className="cell-title mono" href={`/scans/${scan.id}`}>{scan.target}</Link><span className="cell-sub">{scan.id.slice(0, 8)}</span></td><td>{human(scan.scan_profile)}</td><td><Badge value={scan.status} /></td><td>{number(scan.requests_sent)}</td><td>{number(scan.findings_found)}</td><td className="muted small">{date(scan.created_at)}</td><td><Link href={`/scans/${scan.id}`} className="text-link" aria-label={`View scan of ${scan.target}`}><ArrowRight size={15} /></Link></td></tr>)}</tbody></table></div><Pagination total={scans.data.total} offset={offset} onChange={setOffset} /></> : !scans.error && <Empty title="Start your first assessment" detail="Choose an authorized project, enter a target URL, and select a scan profile." action={<button className="btn btn-primary" onClick={() => setLaunch(true)}><Radar size={15} />Launch a scan</button>} />}</section>
    {launch && <LaunchScan onClose={() => setLaunch(false)} />}</>;
}

export function LaunchScan({ onClose, projectId }: { onClose: () => void; projectId?: string }) {
  const router = useRouter();
  const projects = useApi<Page<Project>>("/projects?limit=200&offset=0");
  const [selected, setSelected] = useState(projectId || "");
  const [target, setTarget] = useState("");
  const [profile, setProfile] = useState<Scan["scan_profile"]>("exposure");
  const [extended, setExtended] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const activeId = selected || projects.data?.items[0]?.id || "";
  const pinnedProject = useApi<Project>(projectId ? `/projects/${projectId}` : null);
  const projectOptions = [...(projects.data?.items || []), ...(pinnedProject.data && !projects.data?.items.some((item) => item.id === projectId) ? [pinnedProject.data] : [])];
  const project = projects.data?.items.find((item) => item.id === activeId) || (pinnedProject.data?.id === activeId ? pinnedProject.data : null);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try { const scan = await api<Scan>("/scans", { method: "POST", body: JSON.stringify({ project_id: activeId, target, scan_profile: profile, extended_confirmed: profile === "extended" && extended }) }); onClose(); router.push(`/scans/${scan.id}`); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not start scan."); }
    finally { setBusy(false); }
  }
  return <Modal title="Launch a scan" onClose={onClose}><form onSubmit={submit} className="stack"><p className="muted small">Every target and redirect is checked against your project scope before a request is sent.</p>
    {projects.loading ? <Loading /> : projects.error ? <ErrorBox message={projects.error} /> : !projects.data?.items.length ? <Empty title="Create a project first" detail="A project defines the authorization and scope required for a scan." action={<Link href="/projects/new" className="btn btn-primary" onClick={onClose}>Create project<ArrowRight size={14} /></Link>} /> : <>
      <label className="field"><span className="label">Project</span><select className="select" value={activeId} onChange={(event) => setSelected(event.target.value)}>{projectOptions.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
      <label className="field"><span className="label">Target URL</span><input className="input mono" type="url" required value={target} onChange={(event) => setTarget(event.target.value)} placeholder="https://app.your-domain.com" /><span className="field-hint">Include the protocol and any nonstandard port.</span></label>
      <label className="field"><span className="label">Scan profile</span><select className="select" value={profile} onChange={(event) => { setProfile(event.target.value as Scan["scan_profile"]); setExtended(false); }}><option value="exposure">Exposure — directories, files and media (recommended)</option><option value="passive">Passive — discovery and response inspection</option><option value="standard">Standard — discovery and controlled checks</option><option value="extended">Extended — additional active checks</option></select>{profile === "exposure" && <span className="field-hint">Focuses discovery and checks on directory listings, exposed files, JavaScript, and media references.</span>}</label>
      {profile === "extended" && <div className="notice notice-warning"><CircleAlert size={17} /><label className="checkbox"><input type="checkbox" required checked={extended} onChange={(event) => setExtended(event.target.checked)} /><span>I explicitly authorize the additional active checks in the extended profile.</span></label></div>}
      {project && <div className="panel" style={{ padding: 16 }}><div className="section-heading" style={{ marginBottom: 12 }}><span className="eyebrow">Project limits</span><ShieldCheck size={15} className="muted" /></div><div className="grid-3 small"><div><strong>{project.max_rps}</strong><div className="muted">requests / second</div></div><div><strong>{number(project.request_budget)}</strong><div className="muted">request budget</div></div><div><strong>{project.max_concurrency}</strong><div className="muted">concurrent requests</div></div></div></div>}
      {project && !project.authorization_confirmed && <div className="notice notice-warning"><CircleAlert size={17} />This project needs authorization confirmation before scanning.</div>}
      {error && <ErrorBox message={error} />}
      <div className="modal-footer"><button className="btn btn-ghost" type="button" onClick={onClose}>Cancel</button><button className="btn btn-primary" type="submit" disabled={busy || !project?.authorization_confirmed || (profile === "extended" && !extended)}><Radar size={15} />{busy ? "Starting…" : "Launch scan"}</button></div>
    </>}</form></Modal>;
}

export function ScanDetail({ id }: { id: string }) {
  const scan = useApi<Scan>(`/scans/${id}`, 2500);
  const [findingOffset, setFindingOffset] = useState(0);
  const findings = useApi<Page<Finding>>(`/findings?scan_id=${id}&focus=all&sort=priority&limit=20&offset=${findingOffset}`, ["complete", "failed", "cancelled"].includes(scan.data?.status || "") ? 0 : 5000);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function cancel() {
    setBusy(true); setError("");
    try { await api(`/scans/${id}/cancel`, { method: "POST" }); scan.refresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not cancel scan."); }
    finally { setBusy(false); }
  }
  if (scan.loading) return <Loading />;
  if (!scan.data) return <ErrorBox message={scan.error || "Scan not found."} retry={scan.refresh} />;
  const item = scan.data;
  const finished = ["complete", "completed", "cancelled", "failed"].includes(item.status);
  const budget = item.limits?.request_budget || 10000;
  const progress = Math.min(100, item.requests_sent / budget * 100);
  return <><Link className="text-link" href="/scans"><ArrowLeft size={13} />All scans</Link><PageHeading title={item.page_review ? "Page review" : "Scan details"} description={item.target}><Badge value={item.status} />{!finished && <button className="btn btn-danger" disabled={busy} onClick={cancel}><Square size={13} />{busy ? "Cancelling…" : "Cancel scan"}</button>}</PageHeading>
    {(error || scan.error) && <ErrorBox message={error || scan.error} />}
    {item.page_review && <section className="notice page-review-summary" style={{ marginBottom: 22 }}><ScanLine size={18} /><div><strong>Single-page review</strong><p>Bounded to the selected page and permitted nearby references. Requests use a public session and do not inherit your browser login.</p>{item.page_review.focus && <p><strong>Research focus:</strong> {item.page_review.focus}</p>}{item.page_review.context_summary?.browser_snapshot && <p>Browser snapshot: {number(item.page_review.context_summary.references)} URL references · {number(item.page_review.context_summary.forms)} forms · structure only, without field values.</p>}</div></section>}
    <section className="panel" style={{ marginBottom: 22 }}><div className="section-heading"><div className="button-row"><span className="project-icon"><Radar size={20} /></span><div><h2 className="mono" style={{ fontSize: 14 }}>{item.target}</h2><p>{human(item.scan_profile)} profile · Scan {item.id.slice(0, 8)}</p></div></div><Link href={`/projects/${item.project_id}`} className="text-link">View project<ArrowRight size={13} /></Link></div><div className="scan-metrics">{[["Requests sent", item.requests_sent], ["Assets discovered", item.assets_found], ["Endpoints found", item.endpoints_found], ["Findings", item.findings_found]].map(([label, value]) => <div className="scan-metric" key={String(label)}><strong>{number(Number(value))}</strong><span>{label}</span></div>)}</div><div className="progress-track"><div className="progress-fill" style={{ width: `${progress}%` }} /></div><div className="section-heading small muted" style={{ marginBottom: 0 }}><span>{number(item.requests_sent)} / {number(budget)} request budget used ({progress.toFixed(1)}%)</span><span>{finished ? `Finished ${date(item.finished_at)}` : `Started ${date(item.started_at || item.created_at)}`}</span></div></section>
    <AIActivity progress={item.ai_progress} finished={finished} stale={Boolean(scan.error)} />
    {item.completion && <section className="panel" style={{ marginBottom: 22 }}><h2>Why this scan finished</h2><p className="muted small" style={{ marginTop: 12 }}>{item.completion.message}</p><div className="button-row" style={{ marginTop: 14, flexWrap: "wrap" }}>{Object.entries(item.completion.response_status_counts || {}).map(([status, count]) => <Badge key={status}>HTTP {status}: {number(count)}</Badge>)}</div>{!!((item.completion.response_status_counts?.["401"] || 0) + (item.completion.response_status_counts?.["403"] || 0)) && <p className="field-hint">Some requests were denied or required authentication. That can limit what public scanning can verify.</p>}{item.completion.reason !== "legacy_complete" && <p className="field-hint">URL-cap admission skips: {number(item.completion.skipped_url_admissions)} · Depth admission skips: {number(item.completion.skipped_depth_admissions)} · Out-of-scope discoveries: {number(item.completion.scope_skips)}</p>}</section>}
    <section className="panel panel-flush" style={{ marginBottom: 22 }}><div className="panel-header"><div><h2>Findings from this scan</h2><p>{number(findings.data?.total)} observations awaiting researcher review</p></div><Link className="text-link" href="/reports">{item.autopilot ? "Automatic report drafts" : "Reports"}<ArrowRight size={13} /></Link></div>{findings.error ? <ErrorBox message={findings.error} retry={findings.refresh} /> : findings.loading ? <Loading /> : findings.data?.items.length ? <><div className="table-wrap"><table><thead><tr><th>Finding</th><th>Severity</th><th>Confidence</th><th>Status</th></tr></thead><tbody>{findings.data.items.map(f => <tr key={f.id}><td><Link className="cell-title" href={`/findings/${f.id}`}>{f.title}</Link><span className="cell-sub mono">{f.affected_url}</span></td><td><Badge value={f.severity} /></td><td>{f.confidence}%</td><td><Badge value={f.status} /></td></tr>)}</tbody></table></div><Pagination total={findings.data.total} offset={findingOffset} limit={20} onChange={setFindingOffset} /></> : <Empty title={finished ? "No confirmed findings in this scan" : "No findings recorded yet"} detail="This means the checks have not established an exposure. It does not prove the site is free of vulnerabilities. Review response statuses, scope skips and AI activity to understand coverage." />}</section>
    <div className="detail-grid"><LiveLog key={id} scanId={id} finished={finished} />
    <aside className="stack"><section className="panel"><h3 style={{ marginBottom: 19 }}>Scan configuration</h3><dl className="metadata"><div><dt>Profile</dt><dd>{human(item.scan_profile)}</dd></div><div><dt>Created</dt><dd>{date(item.created_at)}</dd></div>{Object.entries(item.limits || {}).map(([key, value]) => <div key={key}><dt>{human(key)}</dt><dd>{number(value)}</dd></div>)}</dl></section><section className="panel"><div className="button-row" style={{ marginBottom: 13 }}><Target size={16} className="muted" /><h3>Scope snapshot</h3></div><p className="muted small" style={{ marginBottom: 12 }}>The scan uses the rules captured at launch.</p>{item.scope_snapshot?.length ? item.scope_snapshot.map((rule, index) => <div key={index} className="review-rule"><span className="muted small">{human(rule.rule_type)}</span><span className="mono">{rule.value}</span>{!rule.enabled && <span className="muted">Disabled</span>}</div>) : <p className="muted small">No snapshot details returned.</p>}</section>{!!item.errors?.length && <section className="panel"><h3 style={{ color: "#e9acb9", marginBottom: 12 }}>Scan errors</h3><pre className="code-block">{JSON.stringify(item.errors, null, 2)}</pre></section>}</aside></div>
  </>;
}
