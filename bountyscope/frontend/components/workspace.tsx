"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Activity, ArrowRight, ChevronDown, ChevronRight, CircleHelp, Command, FileText, Fingerprint, FolderKanban, Globe2, LayoutDashboard, LockKeyhole, Menu, Plus, Radar, Route, ScanLine, Settings2, Shield, ShieldCheck, Target, X } from "lucide-react";
import { date, human, number, useApi } from "@/lib/api";
import type { Dashboard, Finding, Page, Scan } from "@/lib/types";
import { Badge, Empty, ErrorBox, Loading } from "./ui";
import Projects, { ProjectDetail } from "./projects";
import ProjectWizard from "./project-wizard";
import Scans, { ScanDetail } from "./scans";
import Findings, { FindingDetail } from "./findings";
import Inventory from "./inventory";
import Settings from "./settings";
import Reports from "./reports";
import Autopilot from "./autopilot";
import PageReview from "./page-review";

const navigation = [
  { label: "Overview", href: "/", icon: LayoutDashboard },
  { label: "Projects", href: "/projects", icon: FolderKanban },
  { label: "Autopilot", href: "/autopilot", icon: Activity },
  { label: "Scans", href: "/scans", icon: Radar },
  { label: "Page review", href: "/page-review", icon: ScanLine },
  { label: "Assets", href: "/assets", icon: Globe2 },
  { label: "Endpoints", href: "/endpoints", icon: Route },
  { label: "Findings", href: "/findings", icon: Fingerprint },
  { label: "Reports", href: "/reports", icon: FileText },
];

export default function Workspace() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);
  const [menu, setMenu] = useState(false);
  useEffect(() => {
    if (!menu) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setMenu(false); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [menu]);
  const health = useApi<Record<string, unknown>>("/settings", 30000);
  const section = segments[0] || "Overview";
  let page;
  if (!segments.length) page = <Overview />;
  else if (section === "projects" && segments[1] === "new") page = <ProjectWizard />;
  else if (section === "projects" && segments[1]) page = <ProjectDetail id={segments[1]} />;
  else if (section === "projects") page = <Projects />;
  else if (section === "scans" && segments[1]) page = <ScanDetail id={segments[1]} />;
  else if (section === "scans") page = <Scans />;
  else if (section === "page-review") page = <PageReview />;
  else if (section === "findings" && segments[1]) page = <FindingDetail key={segments[1]} id={segments[1]} />;
  else if (section === "findings") page = <Findings />;
  else if (section === "assets" || section === "endpoints") page = <Inventory key={section} kind={section} />;
  else if (section === "settings") page = <Settings />;
  else if (section === "reports") page = <Reports />;
  else if (section === "autopilot") page = <Autopilot />;
  else page = <Empty title="Page not found" detail="Choose a section from your workspace navigation." action={<Link href="/" className="btn btn-primary">Back to overview</Link>} />;
  return <div className="shell">
    {menu && <button className="sidebar-backdrop" aria-label="Close navigation backdrop" onClick={() => setMenu(false)} />}
    {menu && <button className="icon-button sidebar-close" aria-label="Dismiss navigation" onClick={() => setMenu(false)}><X size={18} /></button>}
    <aside className={`sidebar ${menu ? "sidebar-open" : ""}`}>
      <Link href="/" className="brand" onClick={() => setMenu(false)}><span className="brand-mark"><Shield size={20} /></span>BountyScope</Link>
      <div className="workspace-chip"><span className="workspace-avatar">WS</span><div><div>Research workspace</div><div className="muted">Local environment</div></div><ChevronDown size={12} className="spacer" /></div>
      <p className="nav-caption">Workspace</p>
      <nav className="nav-links" aria-label="Main navigation">{navigation.map(({ label, href, icon: Icon }) => <Link key={href} href={href} onClick={() => setMenu(false)} className={`nav-link ${(href === "/" ? !segments.length : pathname.startsWith(href)) ? "active" : ""}`}><Icon />{label}</Link>)}</nav>
      <div style={{ marginTop: 25 }}><p className="nav-caption">Configuration</p><nav className="nav-links"><Link href="/settings" onClick={() => setMenu(false)} className={`nav-link ${section === "settings" ? "active" : ""}`}><Settings2 size={16} />Settings</Link></nav></div>
      <div className="sidebar-bottom"><div className="scope-reminder"><ShieldCheck size={17} /><h4>Research with boundaries.</h4><p>Every request is checked against your project’s explicit scope.</p></div><div className="sidebar-footer"><Command size={15} /><span>BountyScope</span><span>v1.0</span></div></div>
    </aside>
    <div className="main-shell"><header className="topbar"><div className="button-row"><button className="icon-button mobile-menu" aria-label={menu ? "Close navigation" : "Open navigation"} onClick={() => setMenu(!menu)}>{menu ? <X size={18} /> : <Menu size={18} />}</button><div className="breadcrumbs"><span>Workspace</span><ChevronRight size={12} /><span>{human(section)}</span>{segments[1] && <><ChevronRight size={12} /><span>{segments[1] === "new" ? "New project" : "Details"}</span></>}</div></div><div className="topbar-right"><span className="connection-status"><span className={`connection-dot ${health.error ? "connection-offline" : ""}`} />{health.loading ? "Connecting to API" : health.error ? "API unavailable" : "API connected"}</span><Link href="/settings" className="icon-button" aria-label="Workspace settings"><CircleHelp size={17} /></Link><div className="avatar" aria-label="Local researcher">R</div></div></header>
      <main className="content">{page}<footer className="footer-note"><span>BountyScope · Security research workspace</span><span className="safe-tag"><LockKeyhole size={10} />Authorized assets. Controlled requests.</span></footer></main>
    </div>
  </div>;
}

export function PageHeading({ title, description, children }: { title: string; description: string; children?: React.ReactNode }) {
  return <div className="page-heading"><div><div className="eyebrow" style={{ marginBottom: 8 }}>Research workspace</div><h1>{title}</h1><p>{description}</p></div>{children && <div className="button-row">{children}</div>}</div>;
}

function Overview() {
  const dashboard = useApi<Dashboard>("/dashboard", 10000);
  const scans = useApi<Page<Scan>>("/scans?limit=5&offset=0", 8000);
  const findings = useApi<Page<Finding>>("/findings?limit=5&offset=0", 10000);
  const data = dashboard.data;
  const severities = ["critical", "high", "medium", "low", "informational"];
  const colors = ["#e27990", "#ed9b80", "#e3c17e", "#88adf4", "#a59ac8"];
  const counts = severities.map((severity) => data?.severity_counts?.[severity] || 0);
  const total = counts.reduce((sum, count) => sum + count, 0);
  let cursor = 0;
  const stops = counts.map((count, index) => { const start = cursor; cursor += total ? count / total * 100 : 0; return `${colors[index]} ${start}% ${cursor}%`; });
  return <>
    <PageHeading title="Workspace overview" description="A clear view of your attack surface and research activity."><Link className="btn btn-ghost" href="/scans"><Radar size={15} />View scans</Link><Link className="btn btn-primary" href="/projects/new"><Plus size={16} />New project</Link></PageHeading>
    {dashboard.error && <div style={{ marginBottom: 20 }}><ErrorBox message={dashboard.error} retry={dashboard.refresh} /></div>}
    <div className="stats-grid">{[
      { label: "Projects", value: data?.projects, icon: FolderKanban, note: "Defined research environments" },
      { label: "Discovered assets", value: data?.assets, icon: Globe2, note: "Hosts across your projects" },
      { label: "Total findings", value: data?.findings, icon: Fingerprint, note: "Evidence ready for review" },
      { label: "Active scans", value: data?.active_scans, icon: Activity, note: `${number(data?.scans)} scans in your workspace` },
    ].map(({ label, value, icon: Icon, note }) => <div className="stat-card" key={label}><div className="stat-top"><span>{label}</span><Icon size={17} /></div><div className="stat-number">{value === undefined ? "—" : number(value)}</div><div className="stat-bottom">{label === "Active scans" && !!value && <span className="connection-dot" />}{note}</div></div>)}</div>
    <div className="workflow-banner"><span className="banner-icon"><Target size={21} /></span><div><h3>Your scope is the starting point.</h3><p>Define authorized assets, set request limits, and start a controlled assessment.</p></div><Link className="btn btn-ghost btn-small" href="/projects/new">Set up a project<ArrowRight size={14} /></Link></div>
    <div className="dashboard-grid"><section className="panel panel-flush"><div className="panel-header"><div><h2>Recent scans</h2><p>Live activity across your projects</p></div><Link className="text-link" href="/scans">All scans<ArrowRight size={13} /></Link></div>{scans.loading ? <Loading /> : scans.error ? <div style={{ padding: 20 }}><ErrorBox message={scans.error} /></div> : scans.data?.items.length ? scans.data.items.map((scan) => <Link href={`/scans/${scan.id}`} className="list-item" key={scan.id}><span className="item-icon"><Radar size={16} /></span><div className="list-main"><strong className="truncate">{scan.target}</strong><p>{human(scan.scan_profile)} profile <span style={{ padding: "0 5px" }}>·</span>{date(scan.created_at)}</p></div><Badge value={scan.status} /><ChevronRight size={14} className="muted" /></Link>) : <Empty title="Ready when you are" detail="Create a project to define your scope and launch your first scan." action={<Link href="/projects/new" className="text-link">Create a project<ArrowRight size={13} /></Link>} />}</section>
    <section className="panel panel-flush"><div className="panel-header"><div><h2>Finding severity</h2><p>Prioritize your next review</p></div><Fingerprint size={17} className="muted" /></div><div className="severity-chart"><div className="donut" role="img" aria-label={`${total} total findings by severity`} style={{ background: total ? `conic-gradient(${stops.join(",")})` : "#253044" }}><div className="donut-center"><strong>{data ? number(total) : "—"}</strong><span>TOTAL FINDINGS</span></div></div><div className="severity-legend">{severities.map((severity, index) => <div className="legend-row" key={severity}><span className="legend-dot" style={{ background: colors[index] }} /><span>{human(severity)}</span><strong>{data ? number(counts[index]) : "—"}</strong></div>)}</div></div><div style={{ padding: "0 24px 20px" }}><div className="notice" style={{ fontSize: 10, padding: "10px 12px" }}><ShieldCheck size={14} />Scanner observations require researcher verification before reporting.</div></div></section></div>
    <section className="panel panel-flush"><div className="panel-header"><div><h2>Latest findings</h2><p>New observations awaiting your attention</p></div><Link className="text-link" href="/findings">Explore findings<ArrowRight size={13} /></Link></div>{findings.loading ? <Loading /> : findings.error ? <div style={{ padding: 20 }}><ErrorBox message={findings.error} /></div> : findings.data?.items.length ? <div className="table-wrap"><table><thead><tr><th>Finding</th><th>Severity</th><th>Confidence</th><th>Status</th><th>Discovered</th></tr></thead><tbody>{findings.data.items.map((finding) => <tr key={finding.id}><td><Link href={`/findings/${finding.id}`} className="cell-title">{finding.title}</Link><span className="cell-sub mono">{finding.affected_url}</span></td><td><Badge value={finding.severity} /></td><td>{finding.confidence}%</td><td><Badge value={finding.status} /></td><td className="muted small">{date(finding.created_at)}</td></tr>)}</tbody></table></div> : <Empty title="Your findings will appear here" detail="Completed scans surface evidence and confidence scores to help you verify each observation." />}</section>
  </>;
}
