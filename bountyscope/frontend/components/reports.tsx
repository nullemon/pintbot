"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowUpRight, Eye, FileText, RefreshCw } from "lucide-react";
import { date, human, useApi } from "@/lib/api";
import type { Page, Report } from "@/lib/types";
import { Badge, Download, Empty, ErrorBox, Loading, Modal, Pagination } from "./ui";

const limit = 20;

export default function Reports() {
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const reports = useApi<Page<Report>>(`/reports?limit=${limit}&offset=${offset}`);
  const detail = useApi<Report>(selected ? `/reports/${encodeURIComponent(selected)}` : null);
  const report = detail.data?.id === selected ? detail.data : null;

  useEffect(() => {
    if (!selected) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setSelected(null);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [selected]);

  return <>
    <div className="page-heading"><div><div className="eyebrow" style={{ marginBottom: 8 }}>Research deliverables</div><h1>Reports</h1><p>Review and download the reports generated from your findings.</p></div><button className="btn btn-ghost" onClick={reports.refresh}><RefreshCw size={15} />Refresh reports</button></div>

    <section className="panel panel-flush">
      <div className="panel-header"><div><h2>Generated reports</h2><p>{reports.data ? `${reports.data.total.toLocaleString()} reports in your workspace` : "Markdown and HTML exports"}</p></div><FileText size={18} className="muted" /></div>
      {reports.error ? <div style={{ padding: 22 }}><ErrorBox message={reports.error} retry={reports.refresh} /></div> : reports.loading || (reports.data && reports.data.offset !== offset) ? <Loading /> : reports.data?.items.length ? <>
        <div className="table-wrap"><table><thead><tr><th>Report</th><th>Format</th><th>Source finding</th><th>Generated</th><th><span className="muted">Preview</span></th></tr></thead><tbody>{reports.data.items.map((item) => <tr key={item.id}>
          <td><button className="text-link" style={{ background: "none", border: 0, padding: 0, textAlign: "left" }} onClick={() => setSelected(item.id)}><FileText size={15} />{human(item.format)} report</button><span className="cell-sub mono">{item.id.slice(0, 12)}</span></td>
          <td><Badge>{item.format.toUpperCase()}</Badge></td>
          <td><Link className="text-link" href={`/findings/${item.finding_id}`}>Finding {item.finding_id.slice(0, 8)}<ArrowUpRight size={13} /></Link></td>
          <td className="muted small">{date(item.created_at)}</td>
          <td><button className="btn btn-ghost btn-small" onClick={() => setSelected(item.id)} aria-label={`Preview ${item.format} report ${item.id.slice(0, 8)}`}><Eye size={14} />Preview</button></td>
        </tr>)}</tbody></table></div>
        <Pagination total={reports.data.total} offset={offset} limit={limit} onChange={setOffset} />
      </> : <Empty title="No reports generated yet" detail="Open a finding to generate a Markdown or HTML report with its evidence and recommendations." action={<Link href="/findings" className="btn btn-primary">Explore findings<ArrowUpRight size={15} /></Link>} />}
    </section>

    {selected && <Modal title="Report preview" onClose={() => setSelected(null)} wide>
      {detail.error ? <ErrorBox message={detail.error} retry={detail.refresh} /> : !report ? <Loading /> : <>
        <div className="button-row" style={{ justifyContent: "space-between", marginBottom: 18 }}><div className="button-row"><Badge>{report.format.toUpperCase()}</Badge><span className="muted small">Generated {date(report.created_at)}</span></div><Link href={`/findings/${report.finding_id}`} className="text-link">Open finding<ArrowUpRight size={14} /></Link></div>
        {report.format === "html" && <p className="field-hint" style={{ marginBottom: 12 }}>HTML is displayed as source text. Download the report to view its formatted document.</p>}
        <pre className="code-block report-preview" aria-label="Report content">{report.content}</pre>
        <div className="modal-footer"><button className="btn btn-ghost" onClick={() => setSelected(null)}>Close</button><Download content={report.content} name={`bountyscope-report-${report.id}.${report.format === "html" ? "html" : "md"}`} format={report.format === "html" ? "text/html;charset=utf-8" : "text/markdown;charset=utf-8"} /></div>
      </>}
    </Modal>}
  </>;
}
