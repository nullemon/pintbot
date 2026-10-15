"use client";
import { BrainCircuit, CircleAlert, LoaderCircle } from "lucide-react";
import { date, number } from "@/lib/api";
import type { AIProgress } from "@/lib/types";
import { Badge } from "./ui";

const labels = {
  disabled: "Disabled",
  waiting: "Waiting for observations",
  analyzing: "Analyzing observations",
  complete: "Complete",
  unavailable: "Unavailable",
};

const messages = {
  disabled: "AI is disabled for this scan. No provider analysis is running.",
  waiting: "Waiting for a bounded batch of scan observations to analyze.",
  analyzing: "The server is processing a bounded AI round during this scan.",
  complete: "AI processing has finished for this scan.",
  unavailable: "Provider analysis is unavailable. See the activity log for details.",
};

export default function AIActivity({ progress, finished, stale = false }: { progress?: AIProgress | null; finished: boolean; stale?: boolean }) {
  const status = progress?.enabled === false ? "disabled" : progress?.status;
  const stopped = finished && (status === "waiting" || status === "analyzing");
  const active = status === "analyzing" && !finished && !stale;
  const metrics = progress ? [
    ["Findings analyzed", progress.findings_analyzed],
    ["Findings prioritized", progress.findings_prioritized],
    ["Actions proposed", progress.actions_proposed],
    ["Actions approved", progress.actions_approved],
    ["Actions denied", progress.actions_denied],
    ["Actions executed", progress.actions_executed],
  ] as const : [];

  return <section className="panel ai-activity" aria-labelledby="ai-activity-heading">
    <div className="section-heading">
      <div className="button-row"><BrainCircuit size={20} className="ai-icon" /><div><h2 id="ai-activity-heading">AI activity</h2><p>Live analysis and bounded follow-up decisions</p></div></div>
      <span role="status" aria-live="polite" className="button-row">
        {active && <LoaderCircle size={15} className="spin ai-icon" aria-hidden="true" />}
        <Badge value={stale || status === "unavailable" ? "needs_verification" : status === "complete" ? "complete" : active ? "running" : "neutral"}>
          {stale ? "Updates unavailable" : stopped ? "Scan ended" : status ? labels[status] : "Progress unavailable"}
        </Badge>
      </span>
    </div>
    <div className={stale || status === "unavailable" ? "notice notice-warning" : "ai-message"} role="status" aria-live="polite">
      {(stale || status === "unavailable") && <CircleAlert size={16} aria-hidden="true" />}
      <span>{stale ? `Could not refresh AI activity. ${status ? `Last reported state: ${labels[status]}.` : "No provider activity can be confirmed."} Counters show the last successful update.` : !progress || !status ? "This API has not returned AI progress for this scan. No provider activity can be confirmed." : stopped ? "The scan has ended. No AI activity is currently running." : status === "disabled" ? messages.disabled : progress.message || messages[status]}</span>
    </div>
    {!!metrics.length && <dl className="ai-metrics">{metrics.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{number(value)}</dd></div>)}</dl>}
    {progress && <div className="ai-activity-footer muted small">
      <span>{progress.enabled ? `AI rounds: ${number(progress.round)} / ${number(progress.max_rounds)} maximum` : "AI provider calls disabled"}</span>
      <span>Last AI update: {date(progress.last_updated || undefined)}</span>
    </div>}
  </section>;
}
