"use client";

import { useEffect, useState, type FormEvent } from "react";
import { BrainCircuit, Check, Eye, EyeOff, KeyRound, LockKeyhole, RefreshCw, Save, Server, ShieldCheck, Trash2 } from "lucide-react";
import { TOKEN_KEY, human, useApi } from "@/lib/api";
import { Badge, ErrorBox, Loading, Success } from "./ui";

type RuntimeSettings = {
  authentication_enabled: boolean;
  ai_enabled: boolean;
  ai_provider: string;
  ai_model: string;
  ai_max_rounds: number;
  ai_max_actions_per_round: number;
  evidence_retention_days: number;
  user_agent: string;
};

export default function Settings() {
  const runtime = useApi<RuntimeSettings>("/settings");
  const [token, setToken] = useState("");
  const [stored, setStored] = useState(false);
  const [ready, setReady] = useState(false);
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState("");
  const [storageError, setStorageError] = useState("");

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      try {
        const saved = window.localStorage.getItem(TOKEN_KEY) || "";
        setToken(saved);
        setStored(Boolean(saved));
      } catch {
        setStorageError("Browser storage is unavailable. Enable local storage to save an API token.");
      } finally {
        setReady(true);
      }
    });
    return () => { active = false; };
  }, []);

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token.trim()) return;
    try {
      window.localStorage.setItem(TOKEN_KEY, token.trim());
      setToken(token.trim());
      setStored(true);
      setVisible(false);
      setStorageError("");
      setMessage("API token saved in this browser.");
      window.dispatchEvent(new Event("bountyscope:auth-changed"));
    } catch {
      setMessage("");
      setStorageError("Could not save the token. Check that browser storage is available.");
    }
  }

  function clear() {
    try {
      window.localStorage.removeItem(TOKEN_KEY);
      setToken("");
      setStored(false);
      setVisible(false);
      setStorageError("");
      setMessage("API token cleared from this browser.");
      window.dispatchEvent(new Event("bountyscope:auth-changed"));
    } catch {
      setMessage("");
      setStorageError("Could not clear the token. Check that browser storage is available.");
    }
  }

  const data = runtime.data;

  return <>
    <div className="page-heading"><div><div className="eyebrow" style={{ marginBottom: 8 }}>Workspace configuration</div><h1>Settings</h1><p>Manage your browser connection and inspect the server’s active configuration.</p></div><button className="btn btn-ghost" onClick={runtime.refresh}><RefreshCw size={15} />Refresh settings</button></div>

    <div className="stack">
      <section className="panel">
        <div className="section-heading"><div><h2 style={{ display: "flex", alignItems: "center", gap: 10 }}><KeyRound size={18} className="muted" />API connection</h2><p>Connect this browser to a server that requires an API token.</p></div><Badge value={stored ? "confirmed" : "neutral"}>{stored ? "Token saved" : "No saved token"}</Badge></div>
        <form onSubmit={save} style={{ maxWidth: 680 }}>
          <div className="field"><label className="label" htmlFor="api-token">API bearer token</label><div style={{ display: "flex", gap: 9 }}><input className="input" id="api-token" type={visible ? "text" : "password"} autoComplete="off" spellCheck={false} autoCapitalize="none" disabled={!ready} value={token} onChange={(event) => { setToken(event.target.value); setMessage(""); }} placeholder="Enter your server API token" aria-describedby="api-token-help" /><button type="button" className="btn btn-ghost" aria-label={visible ? "Hide API token" : "Reveal API token"} aria-pressed={visible} onClick={() => setVisible((current) => !current)} disabled={!ready || !token}>{visible ? <EyeOff size={17} /> : <Eye size={17} />}</button></div><p className="field-hint" id="api-token-help">Saved in this browser’s local storage and sent as a Bearer credential with API requests.</p></div>
          <div className="button-row" style={{ marginTop: 18 }}><button type="submit" className="btn btn-primary" disabled={!ready || !token.trim()}><Save size={15} />Save token</button><button type="button" className="btn btn-ghost" onClick={clear} disabled={!ready || (!stored && !token)}><Trash2 size={14} />Clear token</button></div>
          {storageError && <div style={{ marginTop: 18 }}><ErrorBox message={storageError} /></div>}
          {message && <div style={{ marginTop: 18 }}><Success>{message}</Success></div>}
        </form>
      </section>

      {runtime.error && <ErrorBox message={runtime.error} retry={runtime.refresh} />}
      {runtime.loading ? <section className="panel"><Loading /></section> : data && !runtime.error ? <>
        <div className="grid-2">
          <section className="panel">
            <div className="section-heading"><div><h2 style={{ display: "flex", alignItems: "center", gap: 10 }}><ShieldCheck size={18} className="muted" />Authentication</h2><p>Server access policy</p></div><Badge value={data.authentication_enabled ? "confirmed" : "neutral"}>{data.authentication_enabled ? "Enabled" : "Disabled"}</Badge></div>
            <div className="notice"><LockKeyhole size={16} /><span>{data.authentication_enabled ? "The server requires an API bearer token. Save the configured token above to authenticate your browser." : "The server is running without API token authentication."}</span></div>
            <p className="field-hint" style={{ marginTop: 16 }}>The server’s API_TOKEN environment variable controls this policy.</p>
          </section>

          <section className="panel">
            <div className="section-heading"><div><h2 style={{ display: "flex", alignItems: "center", gap: 10 }}><Server size={18} className="muted" />Evidence &amp; requests</h2><p>Active runtime settings</p></div><Badge>Read only</Badge></div>
            <dl className="metadata"><div><dt>Evidence retention</dt><dd>{data.evidence_retention_days} days</dd></div><div><dt>Request user agent</dt><dd className="mono">{data.user_agent || "Not configured"}</dd></div></dl>
            <p className="field-hint" style={{ marginTop: 20 }}>Configured by EVIDENCE_RETENTION_DAYS and USER_AGENT on the server.</p>
          </section>
        </div>

        <section className="panel">
          <div className="section-heading"><div><h2 style={{ display: "flex", alignItems: "center", gap: 10 }}><BrainCircuit size={18} className="muted" />AI analysis</h2><p>Optional evidence analysis configured by your server.</p></div><Badge value={data.ai_enabled ? "confirmed" : "neutral"}>{data.ai_enabled ? "Enabled" : "Disabled"}</Badge></div>
          <dl className="metadata" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}><div><dt>Provider</dt><dd>{data.ai_provider === "openai" ? "OpenAI" : data.ai_provider === "anthropic" ? "Anthropic" : data.ai_provider ? human(data.ai_provider) : "Not configured"}</dd></div><div><dt>Model</dt><dd className="mono">{data.ai_model || "Not configured"}</dd></div><div><dt>Regular scan maximum rounds</dt><dd>{data.ai_max_rounds}</dd></div><div><dt>Actions per round</dt><dd>{data.ai_max_actions_per_round}</dd></div></dl>
          <div className="notice" style={{ marginTop: 22 }}><Check size={16} /><span>{data.ai_enabled ? "AI analysis is enabled. Findings can be analyzed from their detail page." : "AI analysis is disabled. Scanner findings and report generation remain available."}</span></div>
          <p className="field-hint" style={{ marginTop: 16 }}>AI_MAX_ROUNDS limits regular scans and page reviews. Autopilot continues while fresh completed checks provide observations and the project’s scan budget remains, stopping after three consecutive rounds without a new completed check or a provider refusal. AI_MAX_ACTIONS_PER_ROUND still limits each round. Configure these settings, AI_ENABLED, AI_PROVIDER, the model and API key in the server environment. Provider API keys stay on the server.</p>
        </section>
      </> : null}

      <div className="notice"><Server size={16} /><span>Runtime configuration is read only here. Change server environment variables and restart the affected services to apply updates. Project scope and scan limits are managed within each project.</span></div>
    </div>
  </>;
}
