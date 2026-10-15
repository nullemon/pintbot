"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Globe2, Loader2, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import type { Project, ScopeRule } from "@/lib/types";

const steps = ["Identity", "Authorization", "Scope", "Exclusions", "Limits", "Review"];
const descriptions = [
  "Give this engagement a home.",
  "Record the permission and program rules behind your research.",
  "Define exactly which assets this project can test.",
  "Keep sensitive hosts and paths outside the boundary.",
  "Set a predictable budget for every scan.",
  "Check the complete boundary before creating your project.",
];
const limitFields = [
  { key: "max_rps", label: "Requests per second", min: 0.1, max: 10, step: 0.1, help: "Per host · 0.1–10 requests / second" },
  { key: "max_concurrency", label: "Concurrent requests", min: 1, max: 3, step: 1, help: "1–3 simultaneous requests" },
  { key: "max_depth", label: "Crawl depth", min: 0, max: 10, step: 1, help: "0–10 links from the starting URL" },
  { key: "url_cap", label: "URL limit", min: 1, max: 5000, step: 1, help: "1–5,000 unique URLs" },
  { key: "request_budget", label: "Request budget", min: 1, max: 10000, step: 1, help: "1–10,000 total requests per scan" },
] as const;
type LimitKey = (typeof limitFields)[number]["key"];
type Limits = Record<LimitKey, string>;

function entries(value: string) {
  return Array.from(new Set(value.split(/[\s,]+/).map((item) => item.trim()).filter(Boolean)));
}

function lines(value: string) {
  return Array.from(new Set(value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean)));
}

function normalizedHost(value: string) {
  return value.toLowerCase().replace(/\.$/, "");
}

function hosts(value: string) {
  return Array.from(new Set(entries(value).map(normalizedHost)));
}

function validHost(value: string, wildcard = false) {
  const host = wildcard ? value.replace(/^\*\./, "") : value;
  if (!host || /[\s\/@?#:*\\]/.test(host)) return false;
  try {
    const parsed = new URL(`https://${host}`);
    return Boolean(parsed.hostname) && !parsed.port && !parsed.username && !parsed.password;
  } catch {
    return false;
  }
}

function validUrl(value: string) {
  try {
    const parsed = new URL(value);
    return ["http:", "https:"].includes(parsed.protocol) && Boolean(parsed.hostname)
      && !parsed.username && !parsed.password && !parsed.hash && !/[\s\\]/.test(value);
  } catch {
    return false;
  }
}

function RuleList({ rules, empty }: { rules: ScopeRule[]; empty: string }) {
  if (!rules.length) return <p className="muted" style={{ fontSize: 13 }}>{empty}</p>;
  return <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 9 }}>
    {rules.map((rule) => <li key={`${rule.rule_type}:${rule.value}`} style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap", fontSize: 13 }}>
      <span className="badge">{rule.rule_type.replaceAll("_", " ")}</span>
      <code style={{ overflowWrap: "anywhere" }}>{rule.value}</code>
    </li>)}
  </ul>;
}

export default function ProjectWizard() {
  const router = useRouter();
  const heading = useRef<HTMLHeadingElement>(null);
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [organization, setOrganization] = useState("");
  const [notes, setNotes] = useState("");
  const [programName, setProgramName] = useState("");
  const [programUrl, setProgramUrl] = useState("");
  const [authorizationType, setAuthorizationType] = useState("owned");
  const [rulesText, setRulesText] = useState("");
  const [rootDomains, setRootDomains] = useState("");
  const [domains, setDomains] = useState("");
  const [ports, setPorts] = useState("80, 443");
  const [privateNetwork, setPrivateNetwork] = useState(false);
  const [deniedDomains, setDeniedDomains] = useState("");
  const [deniedPaths, setDeniedPaths] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [limits, setLimits] = useState<Limits>({ max_rps: "2", max_concurrency: "3", max_depth: "4", url_cap: "5000", request_budget: "10000" });

  useEffect(() => { heading.current?.focus(); }, [step]);

  const allowRules: ScopeRule[] = [
    ...hosts(domains).map((value) => ({ rule_type: value.startsWith("*.") ? "allow_wildcard" : "allow_domain", value: normalizedHost(value), enabled: true })),
    ...entries(ports).map((value) => ({ rule_type: "allow_port", value, enabled: true })),
    ...(privateNetwork ? [{ rule_type: "allow_private_network", value: "true", enabled: true }] : []),
  ];
  const denyRules: ScopeRule[] = [
    ...hosts(deniedDomains).map((value) => ({ rule_type: "deny_domain", value: normalizedHost(value), enabled: true })),
    ...lines(deniedPaths).map((value) => ({ rule_type: "deny_path", value, enabled: true })),
  ];

  function validate(index: number): string {
    if (index === 0 && !name.trim()) return "Enter a project name to continue.";
    if (index === 1 && programUrl.trim() && !validUrl(programUrl.trim())) return "Enter a valid HTTP or HTTPS program URL without credentials or a fragment.";
    if (index === 2) {
      if (!entries(domains).length) return "Add at least one allowed domain or wildcard.";
      if (entries(rootDomains).length > 100) return "Use no more than 100 root domains.";
      if (entries(rootDomains).some((value) => !validHost(value))) return "Root domains must be hostnames without a scheme, port, path, or wildcard.";
      if (entries(domains).some((value) => !validHost(value, true))) return "Allowed domains must be hostnames, such as app.example.com or *.example.com, without a scheme, port, or path.";
      if (!entries(ports).length || entries(ports).some((value) => !/^\d+$/.test(value) || Number(value) < 1 || Number(value) > 65535)) return "Add allowed ports as whole numbers from 1 to 65,535.";
      if (allowRules.length > 500) return "A project can have at most 500 scope rules.";
    }
    if (index === 3) {
      if (entries(deniedDomains).some((value) => !validHost(value, true))) return "Excluded domains must be hostnames without a scheme, port, or path.";
      if (lines(deniedPaths).some((value) => value.length > 1000)) return "Each excluded path can contain at most 1,000 characters.";
      if (lines(deniedPaths).some((value) => !value.startsWith("/") || /[\s?#\\]/.test(value))) return "Excluded paths must start with / and contain no spaces, query strings, fragments, or backslashes.";
      if (allowRules.length + denyRules.length > 500) return "A project can have at most 500 scope rules, including exclusions.";
    }
    if (index === 4) {
      for (const field of limitFields) {
        const value = Number(limits[field.key]);
        if (!limits[field.key].trim() || !Number.isFinite(value) || value < field.min || value > field.max || (field.step === 1 && !Number.isInteger(value))) return `${field.label} must be ${field.step === 1 ? "a whole number" : "a number"} between ${field.min} and ${field.max.toLocaleString()}.`;
      }
    }
    return "";
  }

  function goTo(index: number) {
    setError("");
    setStep(index);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (saving) return;
    if (step < steps.length - 1) {
      const issue = validate(step);
      if (issue) { setError(issue); return; }
      setStep((current) => current + 1);
      return;
    }
    for (let index = 0; index < 5; index++) {
      const issue = validate(index);
      if (issue) { setStep(index); setError(issue); return; }
    }
    if (!confirmed) { setError("Confirm that you are authorized to test these assets before creating the project."); return; }
    setSaving(true);
    try {
      const result = await api<Project>("/projects", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(), organization: organization.trim(), notes: notes.trim(),
          program_name: programName.trim(), program_url: programUrl.trim(), rules_text: rulesText.trim(),
          authorization_type: authorizationType, authorization_confirmed: confirmed,
          root_domains: hosts(rootDomains),
          ...Object.fromEntries(limitFields.map(({ key }) => [key, Number(limits[key])])),
          scope: [...allowRules, ...denyRules],
        }),
      });
      router.push(`/projects/${result.id}`);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create the project. Please try again.");
      setSaving(false);
    }
  }

  return <div style={{ maxWidth: 1060, margin: "0 auto" }}>
    <div style={{ marginBottom: 26 }}>
      <p className="eyebrow">A CLEAR BOUNDARY. BETTER RESEARCH.</p>
      <h1 style={{ margin: "8px 0", fontSize: "clamp(26px, 3vw, 34px)", letterSpacing: "-0.04em" }}>Create a project</h1>
      <p className="muted" style={{ margin: 0 }}>Set up your engagement, define your scope, and start with confidence.</p>
    </div>

    <ol aria-label="Project setup progress" style={{ listStyle: "none", padding: 0, margin: "0 0 25px", display: "flex", flexWrap: "wrap", gap: 8 }}>
      {steps.map((title, index) => <li key={title} style={{ flex: "1 1 130px" }}>
        <button type="button" className="btn btn-ghost" aria-current={index === step ? "step" : undefined} disabled={saving || index > step} onClick={() => goTo(index)} style={{ width: "100%", justifyContent: "flex-start", gap: 9, padding: "12px 10px", border: index === step ? "1px solid var(--accent, #8bb7ff)" : "1px solid var(--line, #222c3b)", background: index === step ? "rgba(139,183,255,.07)" : "transparent", opacity: index > step ? 0.45 : 1 }}>
          <span aria-hidden="true" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", height: 23, width: 23, borderRadius: "50%", fontSize: 11, background: index <= step ? "rgba(139,183,255,.16)" : "var(--line, #222c3b)", color: index <= step ? "var(--accent, #8bb7ff)" : "inherit" }}>{index < step ? <Check size={13} /> : String(index + 1).padStart(2, "0")}</span>
          <span>{title}</span>
        </button>
      </li>)}
    </ol>

    <form onSubmit={submit} noValidate aria-busy={saving}>
      <div className="panel" style={{ padding: "clamp(20px, 4vw, 36px)" }}>
        <div style={{ paddingBottom: 25, marginBottom: 27, borderBottom: "1px solid var(--line, #222c3b)" }}>
          <p className="eyebrow" style={{ margin: "0 0 9px" }}>STEP {String(step + 1).padStart(2, "0")} / 06</p>
          <h2 ref={heading} tabIndex={-1} className="section-heading" style={{ margin: "0 0 8px", outline: "none" }}>{steps[step]}</h2>
          <p className="muted" style={{ margin: 0, fontSize: 14 }}>{descriptions[step]}</p>
        </div>

        {step === 0 && <div style={{ display: "grid", gap: 22 }}>
          <div className="grid-2">
            <div className="field"><label className="label" htmlFor="project-name">Project name <span aria-hidden="true">*</span></label><input className="input" id="project-name" autoComplete="off" maxLength={200} required value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Customer portal assessment" /></div>
            <div className="field"><label className="label" htmlFor="project-organization">Organization <span className="muted">(optional)</span></label><input className="input" id="project-organization" autoComplete="organization" maxLength={200} value={organization} onChange={(event) => setOrganization(event.target.value)} placeholder="Organization or client" /></div>
          </div>
          <div className="field"><label className="label" htmlFor="project-notes">Engagement notes <span className="muted">(optional)</span></label><textarea className="textarea" id="project-notes" rows={5} maxLength={30000} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Context, contacts, or anything useful for your research." /></div>
          <div className="notice" style={{ display: "flex", gap: 12 }}><ShieldCheck size={19} style={{ flexShrink: 0, marginTop: 2 }} /><span>Every scan inherits this project’s scope, exclusions, and request limits.</span></div>
        </div>}

        {step === 1 && <div style={{ display: "grid", gap: 22 }}>
          <div className="grid-2">
            <div className="field"><label className="label" htmlFor="project-authorization">Authorization basis</label><select className="select" id="project-authorization" value={authorizationType} onChange={(event) => setAuthorizationType(event.target.value)}><option value="owned">Assets I own</option><option value="bug_bounty">Bug bounty program</option><option value="written_permission">Written permission</option><option value="contract">Contracted assessment</option></select></div>
            <div className="field"><label className="label" htmlFor="project-program">Program name <span className="muted">(optional)</span></label><input className="input" id="project-program" maxLength={200} value={programName} onChange={(event) => setProgramName(event.target.value)} placeholder="Program or engagement name" /></div>
          </div>
          <div className="field"><label className="label" htmlFor="project-program-url">Program or authorization URL <span className="muted">(optional)</span></label><input className="input" id="project-program-url" type="url" maxLength={2000} value={programUrl} onChange={(event) => setProgramUrl(event.target.value)} placeholder="https://" /></div>
          <div className="field"><label className="label" htmlFor="project-rules">Program rules <span className="muted">(optional)</span></label><textarea className="textarea" id="project-rules" rows={6} maxLength={30000} value={rulesText} onChange={(event) => setRulesText(event.target.value)} placeholder="Record the testing policy, restrictions, and any requirements from the asset owner." /><p className="muted" style={{ fontSize: 12, margin: "7px 0 0" }}>Rules are retained as engagement context. Configure enforceable boundaries in Scope and Exclusions.</p></div>
        </div>}

        {step === 2 && <div style={{ display: "grid", gap: 22 }}>
          <div>
            <div className="field"><label className="label" htmlFor="project-domains">Allowed domains &amp; wildcards</label><textarea className="textarea" id="project-domains" rows={5} value={domains} onChange={(event) => setDomains(event.target.value)} placeholder={"app.example.com\n*.example.com"} aria-describedby="project-domain-help" /><p className="muted" id="project-domain-help" style={{ fontSize: 12, margin: "7px 0 0" }}>One per line or comma separated. A wildcard allows subdomains; add the root domain separately to include it.</p></div>
          </div>
          <div className="grid-2">
            <div className="field"><label className="label" htmlFor="project-roots">Root domains <span className="muted">(optional)</span></label><input className="input" id="project-roots" value={rootDomains} onChange={(event) => setRootDomains(event.target.value)} placeholder="example.com" /><p className="muted" style={{ fontSize: 12, margin: "7px 0 0" }}>Engagement reference domains. These do not grant scope by themselves.</p></div>
            <div className="field"><label className="label" htmlFor="project-ports">Allowed ports <span aria-hidden="true">*</span></label><input className="input" id="project-ports" required value={ports} onChange={(event) => setPorts(event.target.value)} placeholder="80, 443, 8080" /><p className="muted" style={{ fontSize: 12, margin: "7px 0 0" }}>Every target URL must match an allowed host and port.</p></div>
          </div>
          <label style={{ display: "flex", alignItems: "flex-start", gap: 11, padding: 17, border: "1px solid var(--line, #222c3b)", borderRadius: 8, cursor: "pointer" }}><input type="checkbox" checked={privateNetwork} onChange={(event) => setPrivateNetwork(event.target.checked)} style={{ marginTop: 4, accentColor: "var(--accent, #8bb7ff)" }} /><span><strong style={{ display: "block", fontSize: 14 }}>Allow authorized private infrastructure</strong><span className="muted" style={{ display: "block", fontSize: 12, marginTop: 5 }}>Explicitly permit private network destinations for this project. Localhost, loopback, link-local, and unsafe addresses remain blocked.</span></span></label>
          <div className="notice" style={{ display: "flex", gap: 12 }}><Globe2 size={18} style={{ flexShrink: 0, marginTop: 2 }} /><span>For the local fixture at <code>http://example.test:8080</code>, allow domain <code>example.test</code>, add port <code>8080</code>, and enable private infrastructure.</span></div>
        </div>}

        {step === 3 && <div style={{ display: "grid", gap: 22 }}>
          <div className="notice">Exclusions take precedence over every allow rule. Leave these empty if no additional exclusions are needed.</div>
          <div>
            <div className="field"><label className="label" htmlFor="project-denied-domains">Excluded domains</label><textarea className="textarea" id="project-denied-domains" rows={5} value={deniedDomains} onChange={(event) => setDeniedDomains(event.target.value)} placeholder="sensitive.example.com" /><p className="muted" style={{ fontSize: 12, margin: "7px 0 0" }}>One per line or comma separated. Each excluded host also excludes its subdomains.</p></div>
          </div>
          <div className="field"><label className="label" htmlFor="project-denied-paths">Excluded path prefixes</label><textarea className="textarea" id="project-denied-paths" rows={4} value={deniedPaths} onChange={(event) => setDeniedPaths(event.target.value)} placeholder={"/admin\n/internal"} /><p className="muted" style={{ fontSize: 12, margin: "7px 0 0" }}>One path per line, starting with /. A prefix applies to every allowed host.</p></div>
        </div>}

        {step === 4 && <div style={{ display: "grid", gap: 24 }}>
          <div className="notice">Start with the defaults and adjust to your authorization. Limits apply to every scan in this project.</div>
          <div className="grid-3">{limitFields.map((field) => <div className="field" key={field.key}><label className="label" htmlFor={`project-${field.key}`}>{field.label}</label><input className="input" id={`project-${field.key}`} type="number" inputMode={field.step === 1 ? "numeric" : "decimal"} required min={field.min} max={field.max} step={field.step} value={limits[field.key]} onChange={(event) => setLimits((current) => ({ ...current, [field.key]: event.target.value }))} aria-describedby={`help-${field.key}`} /><p className="muted" id={`help-${field.key}`} style={{ fontSize: 12, margin: "7px 0 0" }}>{field.help}</p></div>)}</div>
        </div>}

        {step === 5 && <div style={{ display: "grid", gap: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 15, alignItems: "flex-start" }}><div><h3 style={{ margin: "0 0 6px", fontSize: 20 }}>{name}</h3><p className="muted" style={{ margin: 0, fontSize: 13 }}>{[organization, programName].filter(Boolean).join(" · ") || "Independent engagement"}</p></div><button type="button" className="btn btn-ghost" onClick={() => goTo(0)}>Edit identity</button></div>
          <div style={{ padding: 18, border: "1px solid var(--line, #222c3b)", borderRadius: 8 }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 13 }}><strong style={{ fontSize: 14 }}>Authorization &amp; program</strong><button className="btn btn-ghost" type="button" disabled={saving} onClick={() => goTo(1)}>Edit</button></div><p style={{ fontSize: 13, margin: "0 0 7px" }}>{authorizationType.replaceAll("_", " ")}</p>{programUrl && <p style={{ fontSize: 13, margin: "0 0 7px", overflowWrap: "anywhere" }}>{programUrl}</p>}<p className="muted" style={{ margin: 0, fontSize: 13, whiteSpace: "pre-wrap", maxHeight: 130, overflowY: "auto" }}>{rulesText || "No additional program rules recorded."}</p></div>
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>Target URLs must match an allowed domain or wildcard and an allowed port. Domain rules authorize paths on that host; excluded domains and path prefixes take precedence.</p>
          <div className="grid-2">
            <div style={{ padding: 18, border: "1px solid var(--line, #222c3b)", borderRadius: 8 }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 15 }}><strong style={{ fontSize: 14 }}>Allowed scope <span className="muted">({allowRules.length})</span></strong><button className="btn btn-ghost" type="button" disabled={saving} onClick={() => goTo(2)}>Edit</button></div><RuleList rules={allowRules} empty="No allow rules." />{rootDomains && <p className="muted" style={{ fontSize: 12, margin: "16px 0 0", overflowWrap: "anywhere" }}>Root domains: {entries(rootDomains).join(", ")}</p>}</div>
            <div style={{ padding: 18, border: "1px solid var(--line, #222c3b)", borderRadius: 8 }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 15 }}><strong style={{ fontSize: 14 }}>Exclusions <span className="muted">({denyRules.length})</span></strong><button className="btn btn-ghost" type="button" disabled={saving} onClick={() => goTo(3)}>Edit</button></div><RuleList rules={denyRules} empty="No additional exclusions configured." /></div>
          </div>
          <div><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}><strong style={{ fontSize: 14 }}>Scan limits</strong><button className="btn btn-ghost" type="button" disabled={saving} onClick={() => goTo(4)}>Edit</button></div><dl style={{ margin: 0, display: "flex", flexWrap: "wrap", gap: "16px 30px" }}>{limitFields.map((field) => <div key={field.key}><dt className="muted" style={{ fontSize: 11, marginBottom: 6 }}>{field.label}</dt><dd style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>{Number(limits[field.key]).toLocaleString()}</dd></div>)}</dl></div>
          <label style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: 20, border: "1px solid rgba(139,183,255,.4)", background: "rgba(139,183,255,.05)", borderRadius: 8, cursor: "pointer" }}><input type="checkbox" required checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} style={{ marginTop: 4, accentColor: "var(--accent, #8bb7ff)" }} /><span><strong style={{ fontSize: 14, display: "block" }}>I am authorized to test these assets.</strong><span className="muted" style={{ display: "block", marginTop: 6, fontSize: 12 }}>I have reviewed the scope, exclusions, and testing limits for this engagement.</span></span></label>
        </div>}

        {error && <div className="notice" role="alert" style={{ marginTop: 24, borderColor: "#ab625f", color: "#f3b5b0" }}>{error}</div>}

        <div style={{ borderTop: "1px solid var(--line, #222c3b)", marginTop: 32, paddingTop: 24, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 15 }}>
          {step > 0 ? <button className="btn btn-ghost" type="button" disabled={saving} onClick={() => goTo(step - 1)}><ArrowLeft size={16} /> Back</button> : <span className="muted" style={{ fontSize: 12 }}>All changes are saved when you create the project.</span>}
          <button className="btn btn-primary" type="submit" disabled={saving || (step === 5 && !confirmed)}>{saving ? <Loader2 size={16} className="spin" /> : step === 5 ? <CheckCircle2 size={16} /> : null}{saving ? "Creating project…" : step === 5 ? "Create project" : "Continue"}{step < 5 && <ArrowRight size={16} />}</button>
        </div>
      </div>
      <p className="muted" style={{ textAlign: "center", fontSize: 12, marginTop: 18 }}><ShieldCheck size={13} style={{ verticalAlign: "-2px", marginRight: 6 }} />Explicit scope. Bounded requests. Your authorization comes first.</p>
    </form>
  </div>;
}
