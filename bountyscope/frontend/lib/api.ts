"use client";
import { useCallback, useEffect, useState } from "react";

export const TOKEN_KEY = "bountyscope.apiToken";
class ApiError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  let token: string | null = null;
  try { if (typeof window !== "undefined") token = localStorage.getItem(TOKEN_KEY); } catch { /* Unauthenticated APIs also work when browser storage is unavailable. */ }
  const response = await fetch(`/api${path}`, {
    ...options,
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const detail = body?.detail;
    throw new ApiError(typeof body?.error?.message === "string" ? body.error.message : typeof detail === "string" ? detail : Array.isArray(detail) ? detail.map((item: {msg?:string}) => item.msg).join("; ") : `Request failed (${response.status}). Check API connectivity and your access token in Settings.`, response.status);
  }
  if (response.status === 204) return undefined as T;
  return response.json();
}

export function useApi<T>(path: string | null, poll = 0) {
  const [result, setResult] = useState<{ path: string | null; data: T | null; error: string; updatedAt: string | null }>({ path: null, data: null, error: "", updatedAt: null });
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => {
    let active = true;
    let reading = false;
    const controller = new AbortController();
    const read = async () => {
      if (!path) { if (active) setLoading(false); return; }
      if (reading) return;
      reading = true;
      try {
        const result = await api<T>(path, { signal: controller.signal });
        if (active) setResult({ path, data: result, error: "", updatedAt: new Date().toISOString() });
      } catch (cause) {
        const transient = !(cause instanceof ApiError) || cause.status === 429 || cause.status >= 500;
        if (active && !controller.signal.aborted) setResult((current) => ({ path, data: transient && current.path === path ? current.data : null, error: cause instanceof Error ? cause.message : "Could not load data.", updatedAt: current.path === path ? current.updatedAt : null }));
      } finally { reading = false; if (active) setLoading(false); }
    };
    void read();
    const timer = poll ? window.setInterval(read, poll) : undefined;
    return () => { active = false; controller.abort(); window.clearInterval(timer); };
  }, [path, poll, revision]);
  useEffect(() => {
    function authChanged() { setResult({ path: null, data: null, error: "", updatedAt: null }); refresh(); }
    window.addEventListener("bountyscope:auth-changed", authChanged);
    return () => window.removeEventListener("bountyscope:auth-changed", authChanged);
  }, [refresh]);
  const current = result.path === path;
  return { data: current ? result.data : null, error: current ? result.error : "", updatedAt: current ? result.updatedAt : null, loading: Boolean(path) && (loading || !current), refresh };
}

export function query(values: Record<string, string | number | undefined>) {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => { if (value !== undefined && value !== "") params.set(key, String(value)); });
  return params.toString();
}

export const human = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
export const date = (value?: string) => value ? new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value)) : "—";
export const number = (value?: number) => new Intl.NumberFormat("en").format(value ?? 0);
