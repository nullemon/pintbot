"use client";
import { ArrowDownToLine, ArrowLeft, ArrowRight, CheckCircle2, CircleAlert, Inbox, LoaderCircle, RefreshCw, X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { human } from "@/lib/api";

export function Badge({ value, children }: { value?: string; children?: ReactNode }) {
  return <span className={`badge badge-${value || "neutral"}`}><span className="badge-dot" />{children || human(value || "unknown")}</span>;
}
export function Empty({ title = "Nothing here yet", detail, action }: { title?: string; detail: string; action?: ReactNode }) {
  return <div className="empty"><span className="empty-icon"><Inbox size={24} /></span><h3>{title}</h3><p>{detail}</p>{action}</div>;
}
export function Loading() { return <div className="loading"><LoaderCircle size={20} className="spin" /><span>Loading workspace data…</span></div>; }
export function ErrorBox({ message, retry }: { message: string; retry?: () => void }) {
  return <div role="alert" className="notice notice-error"><CircleAlert size={18} /><span>{message}</span>{retry && <button className="btn btn-ghost btn-small" onClick={retry}><RefreshCw size={14} />Retry</button>}</div>;
}
export function Success({ children }: { children: ReactNode }) { return <div role="status" className="notice notice-success"><CheckCircle2 size={18} />{children}</div>; }
export function Pagination({ total, offset, limit = 20, onChange }: { total: number; offset: number; limit?: number; onChange: (offset: number) => void }) {
  if (total === 0) return null;
  return <div className="pagination"><span>{offset + 1}–{Math.min(total, offset + limit)} of {total}</span><div className="button-row"><button className="btn btn-ghost btn-small" disabled={offset === 0} onClick={() => onChange(Math.max(0, offset - limit))}><ArrowLeft size={14} />Previous</button><button className="btn btn-ghost btn-small" disabled={offset + limit >= total} onClick={() => onChange(offset + limit)}>Next<ArrowRight size={14} /></button></div></div>;
}
export function Modal({ title, children, onClose, wide = false }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  const dialog = useRef<HTMLElement>(null);
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; }, [onClose]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") { event.preventDefault(); close.current(); }
      if (event.key !== "Tab") return;
      const controls = Array.from(dialog.current?.querySelectorAll<HTMLElement>('a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]') || []);
      const first = controls[0]; const last = controls[controls.length - 1];
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog.current)) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = overflow; document.removeEventListener("keydown", onKey); previous?.focus(); };
  }, []);
  return <div className="modal-backdrop" onClick={onClose}><section ref={dialog} tabIndex={-1} className={`modal ${wide ? "modal-wide" : ""}`} role="dialog" aria-modal="true" aria-label={title} onClick={(event) => event.stopPropagation()}><div className="modal-header"><h2>{title}</h2><button className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={18} /></button></div>{children}</section></div>;
}
export function Download({ content, name, format = "text/markdown" }: { content: string; name: string; format?: string }) {
  function download() {
    const url = URL.createObjectURL(new Blob([content], { type: format }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = name; anchor.click(); URL.revokeObjectURL(url);
  }
  return <button className="btn btn-primary" onClick={download}><ArrowDownToLine size={16} />Download report</button>;
}
