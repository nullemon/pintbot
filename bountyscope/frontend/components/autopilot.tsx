"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Radar } from "lucide-react";
import { api, useApi } from "@/lib/api";
import type { Page, Project, Scan } from "@/lib/types";
import { ErrorBox } from "./ui";
import { PageHeading } from "./workspace";

export default function Autopilot() {
  const router = useRouter();
  const projects = useApi<Page<Project>>("/projects?limit=200");
  const [target, setTarget] = useState("");
  const [project, setProject] = useState("");
  const [profile, setProfile] = useState("exposure");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const scan = await api<Scan>("/autopilot", { method: "POST", body: JSON.stringify({ target: target.trim(), scan_profile: profile, ...(project ? { project_id: project } : {}) }) });
      router.push(`/scans/${scan.id}`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not start autopilot."); }
    finally { setBusy(false); }
  }
  return <>
    <PageHeading title="Autopilot" description="Enter an authorized URL. Discovery, safe checks, AI follow-ups and local report drafts run automatically." />
    <section className="panel" style={{ maxWidth: 850 }}>
      <form className="stack" onSubmit={submit}>
        <div className="field"><label htmlFor="autopilot-url" className="label">Target URL</label><input id="autopilot-url" className="input mono" type="url" required maxLength={2048} placeholder="https://your-authorized-site.com/" value={target} onChange={e => setTarget(e.target.value)} /></div>
        <div className="field"><label htmlFor="autopilot-project" className="label">Project</label><select id="autopilot-project" className="select" value={project} onChange={e => setProject(e.target.value)}><option value="">Automatically match an authorized project</option>{projects.data?.items.filter(p => p.authorization_confirmed).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select><span className="field-hint">Authorization must already be confirmed in a matching project. <Link className="text-link" href="/projects/new">Create a project</Link></span></div>
        <div className="field"><label htmlFor="autopilot-profile" className="label">Checks</label><select id="autopilot-profile" className="select" value={profile} onChange={e => setProfile(e.target.value)}><option value="exposure">Directories, exposed files, media and source maps</option><option value="standard">All implemented safe checks</option></select></div>
        <div className="notice"><span>The scan explores new in-scope references within the project’s rate, depth, URL and request limits. AI is optional and has at most three rounds. Eligible findings receive Markdown and HTML drafts in Reports; researcher verification is required before submission.</span></div>
        {(error || projects.error) && <ErrorBox message={error || projects.error} />}
        <button className="btn btn-primary" type="submit" disabled={busy || !target.trim()}><Radar size={16} />{busy ? "Starting…" : "Start autopilot"}</button>
        <p className="field-hint">No scanner can guarantee every vulnerability. Public backend requests do not inherit browser logins. No destructive exploitation or automatic bounty submissions.</p>
      </form>
    </section>
  </>;
}
