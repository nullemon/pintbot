"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ArrowRight, BrainCircuit, CircleAlert, Columns2, PanelRight, ScanLine, ShieldCheck } from "lucide-react";
import { api, number, useApi } from "@/lib/api";
import type { Page, Project, Scan } from "@/lib/types";
import { Badge, Empty, ErrorBox, Loading, Pagination } from "./ui";
import { PageHeading } from "./workspace";

type ReviewProfile = "standard" | "exposure" | "passive";

export default function PageReview() {
  const router = useRouter();
  const [offset, setOffset] = useState(0);
  const projects = useApi<Page<Project>>(`/projects?limit=20&offset=${offset}`);
  const [selected, setSelected] = useState("");
  const selectedProject = useApi<Project>(selected ? `/projects/${selected}` : null);
  const [target, setTarget] = useState("");
  const [profile, setProfile] = useState<ReviewProfile>("standard");
  const [focus, setFocus] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const authorized = projects.data?.items.filter((project) => project.authorization_confirmed) || [];
  const options = [...authorized];
  if (selectedProject.data?.authorization_confirmed && !options.some((project) => project.id === selectedProject.data?.id)) options.unshift(selectedProject.data);
  const activeId = selected || authorized[0]?.id || "";
  const project = options.find((item) => item.id === activeId);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!confirmed || !project?.authorization_confirmed || busy) return;
    setBusy(true);
    setError("");
    try {
      const scan = await api<Scan>("/page-reviews", {
        method: "POST",
        body: JSON.stringify({ project_id: activeId, target: target.trim(), scan_profile: profile, focus: focus.trim(), authorization_confirmed: true }),
      });
      router.push(`/scans/${scan.id}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not start the page review.");
    } finally {
      setBusy(false);
    }
  }

  return <>
    <PageHeading title="Review a page" description="Review one authorized page while you browse, with live evidence and optional AI triage."><Link className="btn btn-ghost" href="/scans">View reviews and scans<ArrowRight size={15} /></Link></PageHeading>
    <div className="page-review-layout">
      <section className="panel">
        <div className="section-heading"><div className="button-row"><ScanLine size={20} className="muted" /><div><h2>Start a page review</h2><p>Enter the full URL of the page open in your other tab.</p></div></div><Badge value="low">Single page</Badge></div>
        {projects.error && <ErrorBox message={projects.error} retry={projects.refresh} />}
        {selectedProject.error && <ErrorBox message={selectedProject.error} retry={selectedProject.refresh} />}
        {projects.loading ? <Loading /> : projects.data?.total === 0 ? <Empty title="Create an authorized project first" detail="Your project defines the hosts, ports and paths this review may request." action={<Link href="/projects/new" className="btn btn-primary">Create project<ArrowRight size={14} /></Link>} /> : <form className="stack" onSubmit={submit}>
          <div className="field"><label className="label" htmlFor="review-project">Authorized project</label><select id="review-project" className="select" required value={activeId} disabled={busy || !options.length} onChange={(event) => { setSelected(event.target.value); setConfirmed(false); }}>{!options.length && <option value="">No authorized projects on this page</option>}{options.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><span className="field-hint">Only projects with confirmed authorization can be selected. <Link className="text-link" href="/projects">Manage scope</Link></span></div>
          {!options.length && !projects.error && <div className="notice notice-warning"><CircleAlert size={16} /><span>Projects on this page need authorization confirmation. Check another project page or update the project’s authorization.</span></div>}
          {!!projects.data?.total && projects.data.total > 20 && <Pagination total={projects.data.total} offset={offset} onChange={setOffset} />}
          <label className="field"><span className="label">Page URL</span><input className="input mono" type="url" required maxLength={2048} placeholder="https://app.your-domain.com/gallery/" value={target} disabled={busy} onChange={(event) => { setTarget(event.target.value); setConfirmed(false); }} /><span className="field-hint">Use http:// or https://. The hostname, path, port, DNS result and every redirect must pass the project’s scope checks.</span></label>
          <label className="field"><span className="label">Checks</span><select className="select" value={profile} disabled={busy} onChange={(event) => setProfile(event.target.value as ReviewProfile)}><option value="standard">Standard — page configuration and safe exposure checks</option><option value="exposure">Exposure — directories, files, media and source maps</option><option value="passive">Passive — discovery and response inspection</option></select></label>
          <label className="field"><span className="label">Research focus <span className="muted">(optional)</span></span><textarea className="textarea" maxLength={1000} rows={4} value={focus} disabled={busy} onChange={(event) => setFocus(event.target.value)} placeholder="For example: prioritize enumerable media directories and source-map exposure linked from this page." /><span className="field-hint">{focus.length} / 1,000 characters. Focus guides analysis within the allowed checks; it cannot expand scope or request invasive actions.</span></label>
          <div className="page-review-limits"><div><strong>{number(Math.min(project?.request_budget ?? 200, 200))}</strong><span>maximum requests</span></div><div><strong>{number(Math.min(project?.url_cap ?? 80, 80))}</strong><span>maximum URLs</span></div><div><strong>{Math.min(project?.max_depth ?? 1, 1)}</strong><span>maximum link depth</span></div></div>
          <div className="notice"><ShieldCheck size={17} /><span>Reviews share the project’s scope and request limits. Discovered third-party URLs are recorded and skipped unless explicitly authorized.</span></div>
          <label className="checkbox"><input type="checkbox" checked={confirmed} required disabled={busy} onChange={(event) => setConfirmed(event.target.checked)} /><span>I am authorized to test this page and the assets permitted by this project’s scope.</span></label>
          {error && <ErrorBox message={error} />}
          <div className="button-row"><button className="btn btn-primary" type="submit" disabled={busy || !project?.authorization_confirmed || !confirmed || !target.trim()}><ScanLine size={16} />{busy ? "Starting review…" : "Review this page"}</button><span className="field-hint">Opens live progress, findings and the activity log.</span></div>
        </form>}
      </section>
      <aside className="stack">
        <section className="panel"><div className="button-row" style={{ marginBottom: 14 }}><BrainCircuit size={18} className="muted" /><h2>What gets checked</h2></div><p className="muted small">Standard reviews inspect public HTTP headers, cookie configuration, TLS metadata, disclosures, directory and media indexes, source maps and safe CORS behavior where applicable.</p><p className="muted small" style={{ marginTop: 13 }}>AI can prioritize sanitized evidence and propose permitted follow-up checks when enabled. The live log shows provider failures or refusals; deterministic checks remain available.</p><div className="notice notice-warning" style={{ marginTop: 18 }}><CircleAlert size={16} /><span>A review cannot find every vulnerability. Verify observations and program rules before reporting.</span></div></section>
        <section className="panel"><div className="button-row" style={{ marginBottom: 14 }}><ShieldCheck size={18} className="muted" /><h2>Public requests</h2></div><p className="muted small">The scanner uses a separate public HTTP session. It does not inherit your Edge login, cookies or browser storage. Pasting a URL does not give the dashboard access to the other tab.</p><p className="field-hint" style={{ marginTop: 13 }}>Use the optional extension to share a limited page snapshot containing structure and URL references. Input values and credentials are excluded.</p></section>
      </aside>
    </div>
    <div className="grid-2" style={{ marginTop: 22 }}>
      <section className="panel"><div className="button-row" style={{ marginBottom: 15 }}><Columns2 size={18} className="muted" /><h2>Use Edge side by side</h2></div><ol className="page-review-steps"><li>Open your authorized target in an Edge tab.</li><li>Open BountyScope in a second tab, then use Edge’s Split screen option, or place two browser windows side by side.</li><li>Copy the target page’s URL into the review form above and select its authorized project.</li><li>Start the review, then follow the live log and findings while keeping the target visible.</li></ol></section>
      <section className="panel"><div className="button-row" style={{ marginBottom: 15 }}><PanelRight size={18} className="muted" /><h2>Optional Edge side panel</h2></div><ol className="page-review-steps"><li>Update your repository, then open <code>edge://extensions</code>.</li><li>Enable <strong>Developer mode</strong>, choose <strong>Load unpacked</strong>, and select <code>bountyscope\browser-extension</code> inside your local <code>pintbot</code> folder.</li><li>On an authorized target page, click the BountyScope extension button to open its side panel.</li><li>Enter your local BountyScope address and <code>API_TOKEN</code>, choose the project, and select <strong>Review this tab</strong>.</li></ol><p className="field-hint" style={{ marginTop: 14 }}>Use the BountyScope API token, never an Anthropic or OpenAI key. The extension keeps its token only for the browser session. <Link href="/settings" className="text-link">Connection settings<ArrowRight size={12} /></Link></p></section>
    </div>
  </>;
}
